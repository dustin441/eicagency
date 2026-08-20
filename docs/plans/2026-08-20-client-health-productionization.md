# Client Health Dashboard Productionization Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Preserve Mike's internal client-health dashboard experience while replacing its unsafe page-time source queries with a consolidated, auditable, fail-closed health data layer whose headline metrics reconcile to raw source APIs before release.

**Architecture:** Store client configuration, source-run evidence, daily health snapshots, and a latest-snapshot view in the EIC Clients Supabase project. Read PrePass and EIC reporting through explicit server-only adapters, retrieve ClickUp and Google margin data through authenticated APIs, and calculate one deterministic snapshot per client. Canary remains isolated and is not a runtime source for this page.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, Supabase Management API for controlled migrations, ClickUp API, Google Sheets API, n8n for scheduled collection/retry, Node test runner, ESLint, and Vercel previews.

---

## Release gates

1. **Schema approval gate:** No production DDL until Dustin approves the exact migration and rollback.
2. **Source-definition gate:** No client can display Healthy until its budget source, north-star outcome, campaign/product scope, monthly hours source, ClickUp mapping, and margin alias are approved.
3. **Missingness gate:** Any missing required source produces Incomplete, never zero or Healthy.
4. **Native-source gate:** Every active client's headline metrics must reconcile to the raw authoritative API for the exact account/property, time zone, date window, and metric definition.
5. **Review gate:** A fresh independent review must approve the exact final SHA after all fixes.
6. **Deployment gate:** Protected `main` remains unchanged until the reviewed preview passes authenticated UI QA.

## Task 1: Inventory current source contracts

**Objective:** Establish the exact live schemas, source grains, keys, coverage windows, and current configurations before writing DDL or application code.

**Files:**
- Read: `src/services/analytics.ts`
- Read: `src/services/client-health-sources.ts`
- Read: existing client-specific services under `src/services/`
- Create: `docs/client-health/source-inventory.md`

**Steps:**
1. Query `information_schema.columns`, constraints, and row coverage for every candidate table in PrePass and EIC Clients using read-only Management API SQL.
2. Record each table's project, source grain, date column, stable ordering key, spend field, result numerator, campaign/product fields, and freshness field.
3. Inventory current PrePass and EIC budget tables separately.
4. Inventory ClickUp list IDs, current-month time-entry pagination, task pagination, and task-to-list mapping.
5. Read the current margin workbook through the authenticated Sheets API and document the current-month tab, aliases, and numeric columns without copying confidential row values into the repository.
6. Mark every unresolved client definition as Configuration Required.

**Verification:**
- Every source in the proposed client mapping has a real live table or API endpoint.
- Every paged source has a deterministic key.
- No source credential or confidential financial value appears in Git.

## Task 2: Approve the client metric mapping matrix

**Objective:** Turn ambiguous prototype labels into approved business definitions.

**Files:**
- Create: `docs/client-health/client-metric-matrix.md`

**Required fields per client:**
- Client ID and display name
- Active/inactive status
- Dashboard route
- Budget source and aliases
- North-star outcome and numerator
- Approved campaign/product scope
- Comparison window
- Monthly hours source
- ClickUp list IDs
- Margin-sheet aliases
- Required/optional dimensions
- Green/yellow/red thresholds

**Known corrections to resolve:**
- PrePass prioritizes SQL/Won and must preserve focus scope.
- Good Game online purchase efficiency excludes retail/foot-traffic spend.
- IHH uses lead/scheduled-appointment outcomes rather than purchase unless Dustin explicitly approves otherwise.
- Spartaco preserves Brand Health, Lead Gen, and eCommerce scope distinctions.
- Bridgeway must confirm the exact 60-second-visit source field.
- Missing or inactive clients remain Configuration Required rather than receiving guessed scores.

**Verification:**
- Dustin approves the complete matrix.
- Every active client has exactly one unambiguous north-star definition.

## Task 3: Create the EIC client-health schema migration

**Objective:** Add the minimum normalized and auditable schema to EIC Clients only.

**Files:**
- Create: `supabase/client_health_foundation.sql`
- Create: `supabase/client_health_foundation_rollback.sql`
- Test: `src/services/client-health-schema.test.mts`

**Objects:**
1. `public.client_health_clients`
   - Stable client identity and approved configuration
2. `public.client_health_metric_config`
   - Approved adapter key, metric definition, thresholds, weight, and required status
3. `public.client_health_source_runs`
   - Run status, row count, latest source timestamp, sanitized error, and evidence metadata
4. `public.client_health_snapshots`
   - Daily raw inputs, dimension ratings, overall status, reasons, and source freshness
5. `public.client_health_snapshot_tasks`
   - Top overdue ClickUp task references for drill-through without storing task bodies
6. `public.client_health_latest`
   - Latest valid snapshot per active client

**Security:**
- Enable RLS on all tables.
- Add no browser-access policies.
- Runtime reads and writes use server-side service-role credentials only after application authorization.
- Do not store Supabase, ClickUp, Google, Meta, or Google Ads credentials in tables.
- Restrict function execution and set explicit search paths where functions are needed.

**Indexes and constraints:**
- Unique client slug
- Unique `(client_id, metric_key)` configuration
- Unique `(client_id, snapshot_date)` snapshot
- Unique `(snapshot_id, clickup_task_id)` task reference
- Check constraints for status enums, finite nonnegative metrics, and valid threshold ranges
- Indexes supporting latest-client lookups and source-run freshness checks

**Verification:**
1. Run migration in a transaction against a disposable/local database when practical.
2. Verify rollback restores the pre-migration state.
3. After Dustin approval, apply through the Management API to EIC Clients only.
4. Read back columns, constraints, indexes, RLS, grants, and view definition.
5. Confirm PrePass and Canary have zero schema changes.

## Task 4: Implement explicit source adapters

**Objective:** Replace arbitrary table/column configuration and the single wrong Supabase client with typed source adapters.

**Files:**
- Create: `src/services/client-health/adapters/types.ts`
- Create: `src/services/client-health/adapters/prepass.ts`
- Create: `src/services/client-health/adapters/eic-clients.ts`
- Create: `src/services/client-health/adapters/clickup.ts`
- Create: `src/services/client-health/adapters/margin-sheet.ts`
- Create: `src/services/client-health/supabase-clients.ts`
- Test: `src/services/client-health/adapters/*.test.mts`
- Remove client-health data fetching from: `src/services/analytics.ts`

**Rules:**
- PrePass adapter uses the PrePass server client only.
- EIC adapters use the EIC Clients server client only.
- Margin adapter uses authenticated Google Sheets API access; remove the anonymous `gviz` fetch and hardcoded public access path.
- ClickUp adapter paginates all required endpoints and maps by stable list/task IDs.
- Supabase reads use database-side aggregation or deterministic ordering by date plus a unique key.
- Adapters return value, coverage, data-through date, and structured error state separately.

**Verification fixtures:**
- More than 1,000 rows sharing the same date
- Empty source versus true zero
- Missing prior period
- Partial ClickUp page failure
- Duplicate ClickUp entry/task IDs
- Sheet alias mismatch
- Stale source date

## Task 5: Implement deterministic scoring and snapshot writes

**Objective:** Calculate explainable statuses and persist idempotent daily snapshots.

**Files:**
- Create: `src/services/client-health/scoring.ts`
- Create: `src/services/client-health/build-snapshot.ts`
- Create: `src/services/client-health/store-snapshot.ts`
- Modify: `src/lib/client-health-rating.ts`
- Test: `src/services/client-health/scoring.test.mts`
- Test: `src/services/client-health/store-snapshot.test.mts`

**Rules:**
- Missing required dimensions produce `incomplete`.
- Optional missing dimensions remain visible and cannot silently improve the score.
- True zeros remain distinguishable from unavailable values.
- Weights and thresholds come from approved configuration.
- Critical red dimensions can cap the overall status.
- Snapshot upserts are idempotent on `(client_id, snapshot_date)`.
- Source runs and snapshot writes retain enough metadata to reproduce the calculation.

**Verification:**
- Boundary fixtures for every threshold.
- Current-month day-one and month-end pacing fixtures.
- Leap year and America/Phoenix date-boundary fixtures.
- Retry produces one snapshot, not duplicates.

## Task 6: Add the scheduled collection workflow

**Objective:** Populate snapshots reliably without making dashboard users wait for every upstream system.

**Artifacts:**
- Create an n8n workflow backup before changes.
- Create the client-health collector workflow.
- Document credential references, schedule, retry policy, and alert path.
- Create: `docs/client-health/collector-operations.md`

**Workflow:**
1. Load active approved clients.
2. Run adapters with bounded concurrency.
3. Record one source-run row per source/client.
4. Calculate and upsert snapshots only from validated inputs.
5. Record incomplete snapshots when required sources fail.
6. Alert on stale sources, failed runs, and native-reconciliation variance.

**Verification:**
- Controlled run for one client in each source pattern.
- Retry and partial-failure tests.
- Exact execution output reconciles to database rows.
- Backup and rollback tested.

## Task 7: Integrate Mike's UI with the consolidated contract

**Objective:** Preserve the useful dashboard presentation while reading one server-side latest-snapshot contract.

**Files:**
- Modify: `src/services/client-health.ts`
- Modify: `src/app/dashboard/client-health/page.tsx`
- Modify: `src/components/ClientHealthDashboardClient.tsx`
- Keep: `src/lib/auth-guard.ts` server-side agency/super-admin gate
- Test: `src/services/client-health.test.mts`
- Test: `src/components/ClientHealthDashboardClient.test.tsx` if the project test stack supports it

**UI requirements:**
- Show Healthy, Watch, At Risk, Incomplete, and Configuration Required distinctly.
- Put exact reporting date/window in labels.
- Show source freshness and missing-source explanations.
- Never render tokens, raw internal errors, or confidential source payloads.
- Preserve links to client dashboards and top overdue ClickUp tasks.
- Support desktop and mobile layouts.

**Verification:**
- Unauthorized users are rejected server-side.
- Authorized internal users can load the page.
- No direct browser calls to Supabase service-role, ClickUp, or Google APIs.

## Task 8: Execute raw-source reconciliation QA

**Objective:** Prove the dashboard values against authoritative APIs rather than only against warehouse tables.

**Artifacts:**
- Create: `scripts/qa/client-health-reconcile.mts`
- Create: `docs/client-health/qa-evidence/README.md`
- Generate one machine-readable JSON evidence file per QA run outside Git when it includes confidential values.

**Required comparisons for every active client:**
1. Current MTD through the last complete source day.
2. The current north-star comparison window.
3. The previous comparison window.
4. At least three sampled daily records, including a zero-result day when available.
5. ClickUp current-month time entries by stable entry ID and total duration.
6. ClickUp overdue tasks by stable task ID.
7. Budget and hours allotment against the approved source.
8. Margin fields against the authenticated Sheets API.

**Variance rules:**
- Currency/spend: exact to source precision; maximum absolute variance $0.01 after documented rounding.
- Integer outcomes/tasks: exact match.
- ClickUp time: exact milliseconds before display rounding.
- Rates and costs: recomputed from matched raw numerators and denominators; display variance only from documented rounding.
- Date coverage: exact source-day set; missing days are unavailable, not zero.
- Any unexplained variance fails release.

**Evidence fields:**
- QA run ID and timestamp
- Client and metric
- Native account/property ID
- Exact metric API name
- Time zone and date range
- Native value and row/record IDs or aggregate request fingerprint
- Source-table value
- Snapshot value
- Absolute and percentage variance
- Pass/fail disposition
- Data-through timestamp and source-run ID

**Verification:**
- 100% of active clients pass every required headline metric.
- A second independent reviewer can reproduce the aggregate requests.

## Task 9: Complete release verification

**Objective:** Deliver a protected preview that is safe to approve.

**Commands:**
- `npm ci`
- Targeted client-health tests
- `npx tsc --noEmit`
- Targeted and full ESLint as practical
- `npm run build`
- `npm audit --omit=dev --json`
- `git diff --check`

**Authenticated QA:**
- Agency user allowed
- Super-admin allowed
- Other roles denied
- Desktop and mobile screenshots
- No console errors or failed requests
- All client cards agree with signed QA evidence

**Git workflow:**
- Work only on `review/hermes/20260820-client-health-productionization`, based on Mike's exact reviewed SHA.
- Push the task-specific branch only after local verification.
- Open a fresh PR into protected `main`.
- Obtain spec-compliance review, code-quality review, and final integration review.
- Merge only after Dustin's approval of the exact final SHA and Vercel preview.
