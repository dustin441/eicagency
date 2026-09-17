# Why Meta ad previews break, and how to fix them per client

Runbook for the "some ad previews don't show / broke again" report. Worked
through end-to-end for Bloom Aesthetics on 2026-09-16/17; use this to
diagnose the same symptom for any other client.

## Why it happens (root cause, not a bug in the dashboard)

`final_creative_link` (and any raw `url` field returned by Meta's
`/adimages` or `/{video_id}` endpoints) is a **signed, temporary** Facebook
CDN link. It carries an `oe=<hex unix timestamp>` expiry param and goes dead
~5-6 days after it was fetched. A `<img>` tag pointed straight at it will
render fine the day it's synced, then silently 404 once it expires — this
looks random ("some ads have previews, some don't") but it's just age.
`AdPreviews.tsx` already has an `onError` handler that swallows this into a
gradient fallback, so a broken link never crashes the page, it just shows no
image.

Video ads have a second, independent gap: `/{ad_id}` creative objects for a
video usually have **no `image_hash`** (that field only exists for static
image creatives), so any pipeline that looks up permanence purely by
`image_hash` silently skips every video ad.

**The only durable fix is self-hosting the asset** — download the image (or
the video's poster thumbnail) once and re-serve it from Supabase Storage,
never from a Meta-signed URL. `resolveMetaImageUrl()` in
[`src/lib/creative-deep-dive.ts`](../src/lib/creative-deep-dive.ts) already
scores a first-party Supabase URL far above a Meta CDN link — the app side
is ready, the gap is always upstream (the value never got cached).

## Two caching pipelines exist today — check both

There are currently **two separate systems** that both write to the same
`permanent_image_url` column, on overlapping client tables, into two
**different** Supabase Storage buckets. This is duplicated effort, not by
design — flagged here so nobody "fixes" one and is confused when the other
overwrites it (or vice versa):

| | n8n: `EIC Clients - Cache Meta Ad Images` (`ICrvekDtRxPGSQIn`) | Repo script: `scripts/sync-meta-creative-previews.mjs` |
|---|---|---|
| Trigger | n8n Schedule Trigger, daily 07:00 | GitHub Action `.github/workflows/sync-meta-creative-previews.yml`, daily 09:15 UTC, `workflow_dispatch` too |
| Storage bucket | `ad-images/{client}/{ad_id}.jpg` | `meta-creative-previews/...` (content-hashed name) |
| Selection query | Raw SQL per client, `WHERE permanent_image_url IS NULL AND final_creative_link IS NOT NULL` (+ `is_video = false` for every client **except Bloom**, see below) | `CLIENTS` map in the script; per-client `META_ACCOUNT_ID_<CLIENT>` + `META_ACCESS_TOKEN_<CLIENT>` secrets required |
| Video handling | Falls through to `Use Original Link` (`direct_url \|\| final_creative_link`) when there's no `image_hash` — works for video once the `is_video` filter doesn't block it | Documented to keep `video_url` and use "the durable poster" as fallback |
| Status for Bloom (2026-09-17) | **Confirmed working** — verified 15/15 image + 151/151 video ads have `permanent_image_url` after a manual run | Bloom is in the `CLIENTS` map and the workflow file exists on `main`, but nothing in `bloom_meta_ads` was ever written to the `meta-creative-previews` bucket before this fix — worth checking whether `META_ACCESS_TOKEN_BLOOM` / `META_ACCOUNT_ID_BLOOM` are actually set as repo secrets/vars, since a missing one would fail this job silently for Bloom only |

**When debugging another client**, check `permanent_image_url` values in
that client's table first — the bucket name in the URL tells you which of
the two pipelines is actually the one working for that client.

## What was fixed for Bloom (reference — same steps apply elsewhere)

1. **Bloom's own daily puller**, workflow `U9IeCU0HIdYQunST`
   (`Bloom Aesthetics Meta Ads → Supabase`): node `Fetch Image URLs` only
   requested `fields=hash,url` from `/adimages` (the temporary link). Added
   `permalink_url` to the request and had `Inject Image URLs` also populate
   `permanent_image_url` from it. This keeps `bloom_meta_ads` self-healing
   for *new* rows even if the caching pipelines below ever stall.
2. **Shared cache workflow** `ICrvekDtRxPGSQIn`: node `Fetch Uncached Ads`
   had `AND is_video = false` in **every** client's CTE, permanently
   excluding video ads from ever getting cached. Removed that clause from
   the `bloom` CTE only — every other client's CTE is untouched. The
   existing fallback branch (`Has Effective Hash?` → false →
   `Use Original Link` → `download_url = direct_url || final_creative_link`)
   already handled the no-`image_hash` case correctly, so no new nodes were
   needed.
3. Both edits were applied via `curl.exe` GET → raw-text edit → PUT with a
   **minimal** `{name, nodes, connections, settings}` body (see
   `../N8N_POWERSHELL_FIX.md`) so the 4 Meta bearer + 2 Postgres credentials
   on both workflows stayed connected — the SDK-based update path would have
   disconnected all of them.
4. Ran each workflow manually once after patching (`Test workflow` in the
   n8n UI — the public API has no execute endpoint for a schedule-triggered
   workflow, confirmed with a 405 on `POST /workflows/{id}/run`) to backfill
   existing rows instead of waiting for the next scheduled run.

## Checklist for the next client with this symptom

1. Confirm the symptom is real: query `permanent_image_url` on that client's
   ads table. If it's non-null for basically everything, the dashboard issue
   is elsewhere (image dimensions, catalog/DCO ad with no static asset,
   `onError` firing on a genuinely dead first-party URL).
2. If it's null for a meaningful chunk of rows, check which pipeline (table
   above) is supposed to be covering that client, and whether its
   `is_video`/selection filter is silently excluding the affected rows.
3. If the client's own daily puller only requests `hash,url` from
   `/adimages` (not `permalink_url`), that's the same expiring-link bug as
   Bloom's — same fix.
4. Edit via raw-text + minimal PUT body, never the SDK-based node builder,
   to avoid the credential-disconnect trap.
5. Trigger a manual run and verify row-by-row in Supabase before declaring
   it fixed — "the PUT returned 200" only proves the workflow definition
   changed, not that data flowed.
