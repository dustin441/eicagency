# PrePass Monthly Snapshot Integrity Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Keep every PrePass reporting page on `master_marketing_performance` as the canonical source while publishing the Monthly Report as an immutable, versioned snapshot of that source.

**Architecture:** Operational pages continue querying the live materialized view. A protected server-side publisher builds all monthly focus variants through the existing analytics service, binds them to the exact-month narrative, records deterministic source and payload hashes, and stores an immutable publication revision. A small mutable pointer selects the active revision without rewriting historical publications.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16.2.2, TypeScript, n8n Cloud, Node test runner.

---

### Task 1: Add the immutable publication schema

**Files:**
- Create: `supabase/prepass_monthly_publications.sql`
- Create: `supabase/prepass_monthly_publications_rollback.sql`
- Create: `scripts/check-prepass-monthly-publications.mjs`
- Modify: `package.json`

**Steps:**
1. Add publication and active-pointer tables, strict checks, immutable publication trigger, service-role-only grants, and a transactional publish RPC.
2. Make identical payload/source publication idempotent and corrections append a new revision.
3. Add a read view joining active pointers to immutable publications.
4. Add deterministic static SQL checks and rollback guards.
5. Run the SQL check and PostgreSQL validation before applying production DDL.

### Task 2: Make monthly aggregation deterministic and publishable

**Files:**
- Modify: `src/services/analytics.ts`
- Create: `src/services/prepass-monthly-publication.ts`
- Create: `src/services/prepass-monthly-publication.test.mts`

**Steps:**
1. Add explicit report-month calculation and validation.
2. Replace the six unpaginated, error-discarding MMP reads with deterministic fail-closed pagination.
3. Normalize `fb`/`ig` into Meta and preserve Unattributed outcomes.
4. Build all four focus variants from the canonical MMP source.
5. Select the narrative by exact reporting month.
6. Compute deterministic source and payload hashes.
7. Publish through the protected Supabase RPC.
8. Add tests for stable hashes, exact-month selection, focus payloads, and validation failures.

### Task 3: Serve the Monthly Report from the active publication

**Files:**
- Modify: `src/app/dashboard/monthly-report/page.tsx`
- Modify: `src/components/MonthlyReportClient.tsx`
- Modify: `src/services/analytics.ts`

**Steps:**
1. Read the active immutable publication for the latest completed month.
2. Fail closed if no matching publication exists rather than falling back to mutable live metrics.
3. Correct the Cost/Lead comparison direction.
4. Rename the mixed metric to `Platform Conversions` and `Cost per Platform Conversion`.
5. Display revision, published time, and source cutoff metadata.
6. Keep Overall, SMB, ABM, and FD360 code paths unchanged.

### Task 4: Add a protected monthly publication endpoint

**Files:**
- Create: `src/app/api/internal/prepass-monthly/publish/route.ts`
- Create: `src/app/api/internal/prepass-monthly/publish/route-handler.test.mts`
- Modify: `src/proxy.ts`

**Steps:**
1. Authenticate with the existing constant-time `N8N_TRANSFORM_BRIDGE_TOKEN` pattern.
2. Accept only a valid completed `monthStart` and optional correction reason.
3. Build, validate, and publish one atomic snapshot revision.
4. Return publication ID, revision, hashes, counts, and idempotency status.
5. Add authorization, validation, and success tests.

### Task 5: Apply, backfill, automate, and verify

**Steps:**
1. Run lint, targeted tests, SQL checks, and production build.
2. Apply the reviewed additive Supabase migration and read back schema/grants/functions.
3. Push application code to `main`, wait for exact-SHA production readiness, and smoke-test the protected route.
4. Back up and update workflow `gqC5gEuLJVCzYYMH` to call the publication endpoint only after the readout save.
5. Run a fresh controlled September 1/August publication, verify the canonical workflow execution and database readback.
6. Verify the Monthly Report is frozen while live performance still reads MMP.
7. Post evidence and closeout status to ClickUp task `86b1b4axh`.
