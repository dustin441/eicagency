import csv
import importlib.util
import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "sync-smb-form-submissions.py"
SPEC = importlib.util.spec_from_file_location("sync_smb_form_submissions", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
SYNC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC)


def activity(guid="1", lead_id="10", form_id="1040", attributes=None, activity_date="2026-08-01T12:00:00Z"):
    return {
        "marketoGUID": guid,
        "leadId": lead_id,
        "activityDate": activity_date,
        "primaryAttributeValueId": form_id,
        "attributes": json.dumps(attributes or []),
    }


def export_csv(rows):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=["marketoGUID", "leadId", "activityDate", "primaryAttributeValueId", "attributes"])
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


class ParseRowsTest(unittest.TestCase):
    def test_accepts_audited_referrer_url_field(self):
        rows = SYNC.parse_rows(export_csv([activity(attributes=[
            {"name": "Referrer URL", "value": "https://pages.prepass.com/Mobile-App.html"},
        ])]))
        self.assertEqual(1, len(rows))
        self.assertEqual("Mobile-App.html", rows[0]["landing_page"])

    def test_accepts_webpage_url_and_query_parameters(self):
        rows = SYNC.parse_rows(export_csv([activity(attributes=[
            {"name": "Webpage URL", "value": "https://pages.prepass.com/Mobile-App.html"},
            {"name": "Query Parameters", "value": "utm_source=google&utm_campaign=mobile-app"},
        ])]))
        self.assertEqual("google", rows[0]["utm_source"])
        self.assertEqual("mobile-app", rows[0]["utm_campaign"])

    def test_accepts_all_historical_fd360_submissions(self):
        rows = SYNC.parse_rows(export_csv([
            activity(guid="fd-historical", attributes=[{"name": "Referrer URL", "value": "https://pages.prepass.com/FD360.html"}], activity_date="2025-01-15T10:00:00Z"),
            activity(guid="fd-recent", attributes=[{"name": "Referrer URL", "value": "https://pages.prepass.com/FD360.html?utm_source=google"}], activity_date="2026-06-01T12:00:00Z"),
        ]))
        self.assertEqual(["fd-historical", "fd-recent"], [row["marketo_guid"] for row in rows])
        self.assertEqual(["FD360.html", "FD360.html"], [row["landing_page"] for row in rows])

    def test_rejects_wrong_form_page_or_host(self):
        rows = SYNC.parse_rows(export_csv([
            activity(guid="1", form_id="9999", attributes=[{"name": "Referrer URL", "value": "https://pages.prepass.com/Mobile-App.html"}]),
            activity(guid="2", attributes=[{"name": "Referrer URL", "value": "https://pages.prepass.com/Other.html"}]),
            activity(guid="3", attributes=[{"name": "Referrer URL", "value": "Mobile-App.html"}]),
            activity(guid="4", attributes=[{"name": "Referrer URL", "value": "https://example.com/Mobile-App.html"}]),
            activity(guid="5", attributes=[{"name": "Referrer URL", "value": "http://pages.prepass.com/Mobile-App.html"}]),
            activity(guid="6", attributes=[{"name": "Referrer URL", "value": "https://pages.prepass.com/unrelated/Mobile-App.html"}]),
        ]))
        self.assertEqual([], rows)

    def test_preserves_repeated_contact_activities_for_guid_upsert(self):
        attrs = [{"name": "Referrer URL", "value": "https://pages.prepass.com/Mobile-App.html"}]
        rows = SYNC.parse_rows(export_csv([
            activity(guid="1", lead_id="10", attributes=attrs),
            activity(guid="2", lead_id="10", attributes=attrs, activity_date="2026-08-02T12:00:00Z"),
        ]))
        self.assertEqual(["1", "2"], [row["marketo_guid"] for row in rows])
        self.assertEqual({"10"}, {row["id_marketo"] for row in rows})

    def test_skips_malformed_attributes(self):
        row = activity()
        row["attributes"] = "not-json"
        self.assertEqual([], SYNC.parse_rows(export_csv([row])))


class FakeResponse:
    def __init__(self, status_code=200, payload=None, headers=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}
        self.text = text

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class SecurityAndUpsertTest(unittest.TestCase):
    def test_rejects_redirect_and_marketo_error_envelope(self):
        with self.assertRaisesRegex(RuntimeError, "refused redirect"):
            SYNC.checked_response(FakeResponse(307, headers={"Location": "https://evil.example"}), "test request")
        malformed = [
            {"success": False, "errors": [{"code": "x"}]},
            {"result": []},
            {"success": None, "result": []},
            {"success": "true", "result": []},
        ]
        for payload in malformed:
            with self.subTest(payload=payload), self.assertRaisesRegex(RuntimeError, "Marketo test failed"):
                SYNC.marketo_payload(FakeResponse(payload=payload), "Marketo test")

    def test_upsert_uses_fixed_host_and_preserves_missing_enrichment(self):
        rows = [
            {"marketo_guid": "1", "id_marketo": "10", "marketo_created_at": "2026-01-01T00:00:00Z"},
            {"marketo_guid": "2", "id_marketo": "20"},
        ]
        with patch.dict(SYNC.os.environ, {"EIC_SUPABASE_SERVICE_ROLE_KEY": "test-service-key"}), \
             patch.object(SYNC.requests, "post", return_value=FakeResponse(status_code=201)) as post:
            SYNC.upsert_supabase(rows)
        self.assertEqual(2, post.call_count)
        payloads = [call.kwargs["json"] for call in post.call_args_list]
        self.assertTrue(all(call.args[0].startswith(SYNC.SUPABASE_HOST) for call in post.call_args_list))
        self.assertTrue(all(call.kwargs["allow_redirects"] is False for call in post.call_args_list))
        self.assertIn("marketo_created_at", payloads[0][0])
        self.assertNotIn("marketo_created_at", payloads[1][0])

    def test_enrichment_miss_does_not_erase_existing_value(self):
        rows = [
            {"id_marketo": "10", "marketo_created_at": "2026-01-01T00:00:00Z"},
            {"id_marketo": "20"},
        ]
        response = FakeResponse(payload={"success": True, "result": []})
        with patch.object(SYNC.requests, "get", return_value=response) as get:
            SYNC.fetch_created_dates({"Authorization": "Bearer test"}, rows)
        self.assertEqual("2026-01-01T00:00:00Z", rows[0]["marketo_created_at"])
        self.assertNotIn("marketo_created_at", rows[1])
        self.assertFalse(get.call_args.kwargs["allow_redirects"])


if __name__ == "__main__":
    unittest.main()
