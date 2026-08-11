# Spartaco Brand Health P0 Implementation Plan

> **For Hermes:** Execute this plan task by task with deterministic checks, independent review, and exact production verification.

**Goal:** Replace page/product-grained GA4 headline calculations with authoritative property-level coverage facts and exact-window snapshots, repair broken ingestion, backfill 24 completed months, and prove all four scorecards reconcile to native GA4.

**Architecture:** Use `spartaco_ga4_property_daily`, keyed by brand/property/date, only for coverage, freshness, and daily diagnostics. Use `spartaco_ga4_property_period`, keyed by brand/property/start/end, for dimensionless native calendar-month and rolling-12 snapshots. Separate canonical n8n workflows refresh both facts idempotently. Brand Health requires complete daily coverage and a matching exact-period snapshot before exposing website metrics. `spartaco_master_products` remains directional channel/product context only.

**Tech stack:** Next.js 16, TypeScript, Supabase/Postgres, n8n Cloud, GA4 Data API, deterministic Node checks.

## Acceptance criteria

1. Four property mappings and time zones are explicit and immutable.
2. Daily and period facts have idempotent primary/unique keys.
3. Required metric columns have no silent database defaults that can turn omitted values into zero performance.
4. Headline sessions, engaged sessions, engagement rate, and total revenue do not come from `spartaco_master_products` or sums of daily/property-dimensional rows.
5. Daily `total_users` remains diagnostic and is never summed into a multi-day distinct-user KPI.
6. Missing expected daily coverage or a missing exact-period snapshot makes the relevant website metric unavailable.
7. Latest completed month, current 12 months, previous 12 months, and 24 monthly snapshots reconcile to dimensionless native GA4 within 1% for additive metrics.
8. Exactly one canonical daily coverage writer and one canonical exact-period writer are active after rollout.
9. Broken or duplicate workflows are retired only after backup, destination comparison, and verified replacements.
10. Production database changes are applied only through Supabase SQL Editor with stepwise validation.
11. No production UI deployment occurs until backfill, reconciliation, build, independent review, and authenticated preview QA pass.

## Task 1: Establish the fact contracts

**Files:**

- `supabase/spartaco_ga4_property_daily.sql`
- `supabase/spartaco_ga4_property_period.sql`
- `src/services/spartaco-brand-health-math.ts`
- `scripts/check-spartaco-brand-health.mjs`

**Steps:**

1. Add deterministic fixtures for complete and incomplete months, legitimate complete zero months, invalid dates, duplicate dates, and non-additive users.
2. Create the daily fact with locked mappings and `(brand, date)` / `(property_id, date)` keys.
3. Create the period fact with locked mappings, `month` / `rolling_12` date-shape checks, and `(brand, start_date, end_date)` / `(property_id, start_date, end_date)` keys.
4. Require explicit metric values. Do not use database metric defaults.
5. Revoke public, anonymous, and authenticated access; grant scoped service-role access.
6. Add postflight column, constraint, privilege, coverage, and duplicate checks.

## Task 2: Read facts in Brand Health

**Files:**

- `src/services/spartaco-brand-health.ts`
- `src/services/spartaco-brand-health-math.ts`
- `src/components/SpartacoBrandHealthClient.tsx`
- `scripts/check-spartaco-brand-health.mjs`

**Steps:**

1. Read all daily rows with deterministic pagination.
2. Convert daily rows only into monthly coverage/completeness state.
3. Read exact-period snapshots with deterministic ordering and pagination.
4. Use exact monthly snapshots for the 24-month website trend.
5. Use exact adjacent rolling-12 snapshots for current versus previous website scorecards.
6. Require all expected daily dates plus the exact snapshot before exposing a website metric.
7. Use full-window paid-media numerators and denominators only when all 12 expected source months are present.
8. Keep channel and product data directional and remove unsafe product share-of-property claims.
9. Bump the cache key.

## Task 3: Prepare canonical n8n writers

**Artifacts:**

- Workflow backups under `/opt/data/backups/n8n/spartaco-brand-health-p0/2026-08-11/`
- Execution evidence under `/opt/data/reports/spartaco-brand-health-qa/2026-08-11-p0/`

**Steps:**

1. Back up every implicated workflow before mutation.
2. Build one canonical daily workflow and one canonical exact-period workflow with four explicit property configs.
3. Query daily `sessions`, `engagedSessions`, diagnostic `totalUsers`, and `totalRevenue` by date.
4. Query dimensionless `sessions`, `engagedSessions`, `totalUsers`, `engagementRate`, and `totalRevenue` for completed months and rolling windows.
5. Validate metric headers, metric-value cardinality, dates, mappings, finite values, and nonnegative counts before writes.
6. Treat no headers plus no rows as a legitimate zero period only. A partial/malformed row is an error.
7. Upsert daily rows by `(brand, date)` and period rows by `(brand, start_date, end_date)`.
8. Keep writers inactive until their destination SQL postflights pass.

## Task 4: Apply production SQL

1. Run daily and period preflights separately.
2. Apply each table DDL independently.
3. Run postflight column, constraint, privilege, and duplicate checks.
4. Apply only reviewed legacy constraints whose null/duplicate preflights pass.
5. Do not activate a writer until its exact runtime credential completes a controlled write.

## Task 5: Backfill and repair ingestion

1. Backfill daily coverage from 2024-08-01 through 2026-07-31.
2. Backfill 24 exact calendar-month snapshots and two adjacent rolling-12 snapshots per brand.
3. Verify 730 daily dates and 26 period rows per brand with zero duplicate keys.
4. Run overlapping daily and period refreshes twice and prove row counts do not increase.
5. Activate both canonical workflows only after idempotency passes.
6. Repair the required Ronin channel unique constraint and verify its original writer succeeds.
7. Deactivate the failed corporate-property writer only after verified property replacements are active.
8. Compare same-name workflows before retirement; different refresh windows are not duplicates.

## Task 6: Native reconciliation gate

1. Query native GA4 for current 12 months, previous 12 months, latest completed month, and each monthly snapshot.
2. Compare native values with exact-period facts for sessions, engaged sessions, engagement rate, and total revenue.
3. Record native value, stored value, absolute variance, percentage variance, and disposition.
4. Require all additive headline checks to pass the 1% threshold.
5. Keep exact-period users separate from daily diagnostics.

## Task 7: Software and authenticated QA

**Commands:**

- `node --no-warnings --experimental-strip-types scripts/check-spartaco-brand-health.mjs`
- `npx tsc --noEmit`
- `npx eslint src/services/spartaco-brand-health.ts src/services/spartaco-brand-health-math.ts src/components/SpartacoBrandHealthClient.tsx scripts/check-spartaco-brand-health.mjs`
- `npm run build`
- `git diff --check`

**QA:**

1. Verify all-brand and four brand routes with a Spartaco-scoped client.
2. Verify desktop and mobile screenshots, console, overflow, source warnings, and product links.
3. Verify current window `2025-08-01..2026-07-31` and previous window `2024-08-01..2025-07-31`.
4. Verify headline website values match exact native snapshots.
5. Verify incomplete paid-media windows display unavailable rather than zero.

## Task 8: Review and PR

1. Run independent architecture and code reviews.
2. Resolve all high/important findings and request focused re-review.
3. Re-run deterministic checks, typecheck, lint, build, diff check, integration reads, and secret scan.
4. Commit focused changes and push `fix/spartaco-brand-health-p0-20260811`.
5. Open a PR for Dustin approval.
6. Verify the exact Vercel preview SHA and complete authenticated preview QA.
7. Do not merge or deploy to production without explicit approval.
