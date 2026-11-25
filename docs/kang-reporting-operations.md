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

## Creative performance and metadata

- Metadata: `public.kang_meta_creatives`, primary key `(account_id, ad_id)`, RLS enabled and service-role access only.
- Metadata workflow: `Kang Foods | Meta Creative Metadata Daily to Supabase`, ID `YJKDahN8xV3QPP1Y`, daily at 4:45 a.m. America/Los_Angeles, after the traffic import.
- It enumerates distinct Kang ad IDs from the authoritative facts, validates each native ad/account response, reads dynamic asset-feed copy/headlines/CTA/destination, resolves the square asset hash through Meta adimages, and reads the source Page identity/profile image. Source Page is Buffalo Wild Wings Go Fremont.
- High-resolution CDN image URLs are refreshed daily. They are not permanent assets. Missing or failed images must show an explicit fallback rather than invented imagery.
- The UI joins metadata by account and ad ID, never by duplicate ad names. All creative performance comes from the existing selected-date daily facts. Metadata failures must not alter headline totals or hide an ad's performance.
- These are current representative assets for each ad, not historical or placement-level creative snapshots. Dynamic square/portrait assets and multiple copy variants do not have separately measured performance in this view.
- Initial verified coverage: 10 ad IDs, 5 unique high-resolution square images, 10 copy/headline/destination/preview records. Both controlled imports wrote exactly 10 metadata rows, leaving the original 38 performance facts and their totals unchanged. No current ads have video references. The metadata retains video IDs if future ads supply them; MP4 availability must not be assumed.
- Initial executions: `226454` and `226457`, both successful. Final schedule-only workflow has nine nodes, active published version, existing shared error handler, no public QA webhook. The first natural scheduled creative refresh remains a separate acceptance check.

## Security and verification

The fact, receipt, and creative metadata tables have RLS enabled with no anon/authenticated table grants. Analytics reads use the server-only reporting service client after `requireClientAccess('kang')`. Client dropdown and post-login mappings use the same client ID. Never add Kang access to unrelated users or expose service keys in browser bundles.

Before declaring a recurring pipeline healthy, inspect the latest **scheduled** execution as well as its matching receipt and latest data date. Enabled state and a manual test alone do not prove the next schedule fired.

For manual QA, back up the definition, add a random temporary webhook, capture trigger time, and require a fresh execution of this exact workflow. Preserve complete execution evidence before removing the hook. Republish/read back the five-node canonical schedule graph, require activeVersionId = versionId, and verify the temporary webhook is absent.

Do not restore the legacy reporting URL as the current client destination. HighLevel access is separate from the EIC portal login. Provision only the verified client identity, preserve existing passwords if a user already exists, and keep credentials out of ClickUp/comments/repo.
