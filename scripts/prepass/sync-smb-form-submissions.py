#!/usr/bin/env python3
"""Sync PrePass Mobile-App form submissions from Marketo to EIC Supabase.

Required environment variables:
  MARKETO_CLIENT_ID
  MARKETO_CLIENT_SECRET
  EIC_SUPABASE_SERVICE_ROLE_KEY

Optional environment variables:
  PREPASS_SMB_LOOKBACK_DAYS (default: 7, allowed: 1-31)
  PREPASS_SMB_BACKFILL_START (YYYY-MM-DD, up to 370 days)

The default overlap is safe because marketo_guid is immutable and the Supabase
write uses an idempotent upsert. Backfills run in Marketo-safe 30-day windows.
"""
import csv
import io
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import requests

MARKETO_HOST = "https://692-LGB-398.mktorest.com"
SUPABASE_HOST = "https://hdaftbqteexugqakgdbx.supabase.co"
FORM_ID = "1040"
LANDING_PATH = "/Mobile-App.html"
LANDING_PAGE = LANDING_PATH.lstrip("/")
ALLOWED_LANDING_HOSTS = {"pages.prepass.com"}
LOOKBACK_DAYS = int(os.environ.get("PREPASS_SMB_LOOKBACK_DAYS", "7"))
if not 1 <= LOOKBACK_DAYS <= 31:
    raise RuntimeError("PREPASS_SMB_LOOKBACK_DAYS must be between 1 and 31")


def require(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def checked_response(response, action):
    if 300 <= response.status_code < 400:
        raise RuntimeError(f"{action} refused redirect to {response.headers.get('Location', '(missing)')}")
    response.raise_for_status()
    return response


def marketo_payload(response, action, require_result=True):
    checked_response(response, action)
    try:
        payload = response.json()
    except (ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"{action} returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"{action} returned an invalid payload")
    if payload.get("success") is not True:
        raise RuntimeError(f"{action} failed: {payload.get('errors') or 'missing or invalid Marketo success flag'}")
    if require_result and not isinstance(payload.get("result"), list):
        raise RuntimeError(f"{action} returned no result list")
    return payload


def marketo_headers():
    response = requests.post(
        MARKETO_HOST + "/identity/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": require("MARKETO_CLIENT_ID"),
            "client_secret": require("MARKETO_CLIENT_SECRET"),
        },
        timeout=30,
        allow_redirects=False,
    )
    checked_response(response, "Marketo token request")
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError("Marketo token request returned invalid JSON") from exc
    token = payload.get("access_token") if isinstance(payload, dict) else None
    if not isinstance(token, str) or not token:
        raise RuntimeError(f"Marketo token request failed: {payload.get('error_description') if isinstance(payload, dict) else 'invalid payload'}")
    return {"Authorization": "Bearer " + token}


def create_export(headers, start_at, end_at):
    response = requests.post(
        MARKETO_HOST + "/bulk/v1/activities/export/create.json",
        headers={**headers, "Content-Type": "application/json"},
        json={
            "format": "CSV",
            "filter": {
                "createdAt": {"startAt": start_at, "endAt": end_at},
                "activityTypeIds": [2],
            },
        },
        timeout=60,
        allow_redirects=False,
    )
    payload = marketo_payload(response, "Marketo export creation")
    if not payload["result"] or not payload["result"][0].get("exportId"):
        raise RuntimeError("Marketo export creation returned no exportId")
    export_id = payload["result"][0]["exportId"]
    enqueue = requests.post(
        MARKETO_HOST + f"/bulk/v1/activities/export/{export_id}/enqueue.json",
        headers=headers,
        timeout=60,
        allow_redirects=False,
    )
    marketo_payload(enqueue, "Marketo export enqueue", require_result=False)
    return export_id


def wait_for_export(headers, export_id):
    for attempt in range(180):
        if attempt:
            time.sleep(2)
        response = requests.get(
            MARKETO_HOST + f"/bulk/v1/activities/export/{export_id}/status.json",
            headers=headers,
            timeout=60,
            allow_redirects=False,
        )
        payload = marketo_payload(response, "Marketo export status")
        if not payload["result"] or not payload["result"][0].get("status"):
            raise RuntimeError("Marketo export status returned no status")
        status = payload["result"][0]["status"]
        if status == "Completed":
            return
        if status in {"Failed", "Cancelled"}:
            raise RuntimeError(f"Marketo export {export_id}: {status}")
    raise TimeoutError(f"Marketo export {export_id} did not complete")


def download_export(headers, export_id):
    response = requests.get(
        MARKETO_HOST + f"/bulk/v1/activities/export/{export_id}/file.json",
        headers=headers,
        timeout=180,
        allow_redirects=False,
    )
    checked_response(response, "Marketo export download")
    if "json" in response.headers.get("Content-Type", "").lower() or response.text.lstrip().startswith("{"):
        payload = marketo_payload(response, "Marketo export download", require_result=False)
        raise RuntimeError(f"Marketo export download returned JSON instead of CSV: {payload}")
    return response.text


def parse_rows(text):
    output = []
    for raw in csv.DictReader(io.StringIO(text)):
        try:
            attributes = json.loads(raw.get("attributes") or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(attributes, list):
            attributes = {
                item.get("name"): item.get("value")
                for item in attributes
                if isinstance(item, dict)
            }
        if not isinstance(attributes, dict):
            continue

        form_id = str(raw.get("primaryAttributeValueId") or raw.get("primaryAttributeValue") or "")
        # In this Marketo tenant, audited Fill Out Form exports expose the form
        # page in Referrer URL; Webpage URL variants are accepted if Marketo
        # adds them later. Require the target page from explicit URL evidence.
        url_candidates = [
            str(attributes.get("Webpage URL") or ""),
            str(attributes.get("Web Page URL") or ""),
            str(attributes.get("Referrer URL") or ""),
        ]
        parsed_candidates = [urlparse(value) for value in url_candidates if value]
        parsed = next(
            (candidate for candidate in parsed_candidates
             if candidate.scheme.lower() == "https"
             and (candidate.hostname or "").lower() in ALLOWED_LANDING_HOSTS
             and candidate.path == LANDING_PATH),
            None,
        )
        if form_id != FORM_ID or parsed is None:
            continue
        page = LANDING_PAGE

        query = {key.lower(): values[-1] for key, values in parse_qs(parsed.query, keep_blank_values=True).items()}
        raw_query_parameters = str(attributes.get("Query Parameters") or "").lstrip("?")
        query.update({key.lower(): values[-1] for key, values in parse_qs(raw_query_parameters, keep_blank_values=True).items()})
        form_fields = str(attributes.get("Form Fields") or "")
        fleet_match = re.search(r's:\d+:\\?"pp_fleetsize\\?";s:\d+:\\?"([^\\"]*)\\?"', form_fields)

        def first(*names):
            for name in names:
                value = query.get(name.lower())
                if value not in (None, ""):
                    return value
            return None

        row = {
            "marketo_guid": str(raw.get("marketoGUID") or ""),
            "id_marketo": str(raw.get("leadId") or ""),
            "activity_date": raw.get("activityDate"),
            "form_id": form_id,
            "landing_page": page,
            "fleet_size": fleet_match.group(1) if fleet_match else None,
            "utm_source": first("utm_source"),
            "utm_medium": first("utm_medium"),
            "utm_campaign": first("utm_campaign"),
            "utm_content": first("utm_content"),
            "utm_term": first("utm_term"),
            "utm_adgroup_name": first("utm_adgroup_name", "utm_adgroup"),
            "utm_campaign_id": first("utm_campaign_id", "utm_campaignid", "gad_campaignid"),
            "utm_adset_id": first("utm_adset_id", "utm_adsetid"),
            "utm_ad_id": first("utm_ad_id", "utm_adid"),
        }
        if row["marketo_guid"] and row["id_marketo"] and row["activity_date"]:
            output.append(row)
    return list({row["marketo_guid"]: row for row in output}.values())


def fetch_created_dates(headers, rows):
    ids = sorted({row["id_marketo"] for row in rows}, key=int)
    created_dates = {}
    for offset in range(0, len(ids), 300):
        batch = ids[offset:offset + 300]
        response = requests.get(
            MARKETO_HOST + "/rest/v1/leads.json",
            headers=headers,
            params={
                "filterType": "id",
                "filterValues": ",".join(batch),
                "fields": "id,createdAt",
                "batchSize": 300,
            },
            timeout=60,
            allow_redirects=False,
        )
        payload = marketo_payload(response, "Marketo lead enrichment")
        for lead in payload["result"]:
            if isinstance(lead, dict) and lead.get("id") is not None and lead.get("createdAt"):
                created_dates[str(lead["id"])] = lead["createdAt"]
    for row in rows:
        created_at = created_dates.get(row["id_marketo"])
        if created_at:
            row["marketo_created_at"] = created_at


def upsert_supabase(rows):
    if not rows:
        return
    key = require("EIC_SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    # Keep payload keys uniform per PostgREST batch. Rows without enrichment do
    # not send marketo_created_at, so a transient Marketo miss cannot erase a
    # previously stored non-null value during ON CONFLICT UPDATE.
    groups = [
        [row for row in rows if "marketo_created_at" in row],
        [row for row in rows if "marketo_created_at" not in row],
    ]
    for group in groups:
        for offset in range(0, len(group), 200):
            response = requests.post(
                SUPABASE_HOST + "/rest/v1/prepass_smb_form_submissions?on_conflict=marketo_guid",
                headers=headers,
                json=group[offset:offset + 200],
                timeout=60,
                allow_redirects=False,
            )
            checked_response(response, "Supabase submission upsert")


def sync_window(start, end):
    start_at = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_at = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    headers = marketo_headers()
    export_id = create_export(headers, start_at, end_at)
    wait_for_export(headers, export_id)
    rows = parse_rows(download_export(headers, export_id))
    fetch_created_dates(headers, rows)
    synced_at = datetime.now(timezone.utc).isoformat()
    for row in rows:
        row["updated_at"] = synced_at
    upsert_supabase(rows)
    return rows


def main():
    end = datetime.now(timezone.utc)
    backfill_start = os.environ.get("PREPASS_SMB_BACKFILL_START")
    if backfill_start:
        try:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", backfill_start):
                raise ValueError("invalid date shape")
            start = datetime.strptime(backfill_start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError as exc:
            raise RuntimeError("PREPASS_SMB_BACKFILL_START must be YYYY-MM-DD") from exc
        if start > end or end - start > timedelta(days=370):
            raise RuntimeError("PREPASS_SMB_BACKFILL_START must be within the previous 370 days")
    else:
        start = end - timedelta(days=LOOKBACK_DAYS)

    cursor = start
    total_rows = 0
    contact_ids = set()
    windows = 0
    while cursor < end:
        window_end = min(cursor + timedelta(days=30), end)
        rows = sync_window(cursor, window_end)
        total_rows += len(rows)
        contact_ids.update(row["id_marketo"] for row in rows)
        windows += 1
        cursor = window_end

    print(json.dumps({
        "start": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "windows": windows,
        "qualifying_activities": total_rows,
        "unique_contacts": len(contact_ids),
        "upserted": total_rows,
    }))


if __name__ == "__main__":
    main()
