# Kang Foods reporting operations

## Identity and scope

- Portal: `https://analytics.eic.agency/dashboard/kang`
- Access-control client ID: `kang`
- Meta account: BWW, `1683292242584249`, USD, America/Los_Angeles.
- Reporting Supabase project: `lozgnyxixzfxokllevtb`.
- Facts: `public.kang_meta_daily`, one account/date/ad row.
- Successful import receipts: `public.kang_meta_sync_runs`.
- Coverage starts November 19, 2026, the current Fremont launch. Older campaign history has not been imported.
- Google account `7214578617` remains paused. Google campaign status was verified November 24, 2026; the page's status is a dated verification, not a live Google connection.

## Canonical ingestion

Workflow: `Kang Foods | Meta Traffic Daily to Supabase`, ID `K1XD9Q55fnAlfekb`.

Daily schedule: 4:37 a.m. America/Los_Angeles. Pulls the previous 14 completed account-local dates, clamped to November 19, 2026. This overlap refreshes late attribution without repeatedly fetching full history.

The workflow uses the existing EIC Facebook Data Puller credential and reporting-project Postgres credential. Credentials are references, not embedded secrets. It does not mutate ad campaigns, budgets, destinations, or the old Sheet.

Meta Insights uses ad-level daily rows, `7d_click` action attribution, bounded cursor pagination, JSON responses, and three bounded retries. Validation rejects provider errors, non-array responses, unfinished pagination, wrong accounts, duplicate keys, out-of-window dates, and invalid numeric values before any write.

One bound-parameter SQL statement upserts the validated rows and writes a successful receipt, including a valid zero-row response. The primary key prevents duplicates on overlapping runs. `updated_at` changes on every successful returned-row refresh. A provider error must fail rather than publish a success receipt.

The old Sheet pullers `Dy0FsrOKmw7DxQaa` and `NCWEpMVNCABhvHs5` remain inactive. They are historical assets, not additional scheduled writers.

## Metric semantics

- Spend: sum of Meta `spend`, stored as `cost`.
- All clicks: sum of Meta `clicks`, kept separate from link clicks.
- Link clicks: sum of `inline_link_clicks`.
- Link CTR: total link clicks / total impressions.
- Cost per link click: total spend / total link clicks.
- Landing page views: the single canonical `landing_page_view` action. Never add `omni_landing_page_view`, a duplicate representation.
- Cost per LPV: total spend / total LPVs.
- Rates are ratios of summed numerators and denominators, not averages of ad-level rates. Zero denominators are unavailable.
- Reach is not summed across ads/days and is not shown.
- Corporate BWW traffic cannot establish completed orders, revenue, ROAS, or verified store visits. These are not dashboard claims.

## Security and verification

Both tables have RLS enabled with no anon/authenticated table grants. Analytics reads use the server-only reporting service client after `requireClientAccess('kang')`. Client dropdown and post-login mappings use the same client ID. Never add Kang access to unrelated users or expose service keys in browser bundles.

Before declaring a recurring pipeline healthy, inspect the latest **scheduled** execution as well as its matching receipt and latest data date. Enabled state and a manual test alone do not prove the next schedule fired.

For manual QA, back up the definition, add a random temporary webhook, capture trigger time, and require a fresh execution of this exact workflow. Preserve complete execution evidence before removing the hook. Republish/read back the five-node canonical schedule graph, require activeVersionId = versionId, and verify the temporary webhook is absent.

Do not restore the legacy reporting URL as the current client destination. HighLevel access is separate from the EIC portal login. Provision only the verified client identity, preserve existing passwords if a user already exists, and keep credentials out of ClickUp/comments/repo.
