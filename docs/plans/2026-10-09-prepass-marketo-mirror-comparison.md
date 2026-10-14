# PrePass Marketo Atomic Snapshot Implementation Plan

> **For Hermes:** Implement task-by-task with RED-GREEN-REFACTOR and verify both Node and PostgreSQL fixtures.

**Goal:** Make each scheduled Reporting v2 Marketo run an atomic, full-population replacement while preserving immutable audit history and leaving legacy PrePass reporting untouched.

**Architecture:** Select the complete population with a required Marketo smart-list ID, stage and reconcile the full export, then publish immutable `run_id + marketo_id` rows and switch a singleton active-run pointer in the same transaction. All current reporting views join through that pointer; prior snapshots remain queryable only as history.

**Tech Stack:** Node.js Marketo Bulk Extract writer, PostgreSQL/Supabase SQL, Node test runner, disposable PostgreSQL fixture.

---

## Task 1: Lock the provider contract with Node tests

**Files:**
- Modify: `scripts/prepass-marketo-mirror-sync.test.mjs`
- Modify: `scripts/prepass-marketo-mirror-sync.mjs`

1. Add failing tests for required `PREPASS_MARKETO_FULL_SMART_LIST_ID`, explicit `--smart-list-id`, `filter.smartListId`, and rejection of old window arguments.
2. Verify failure with `npm run test:prepass-marketo-mirror`.
3. Replace the incremental request with one full-list export and validate provider, parsed, and unique counts independently.
4. Verify Node tests pass.

## Task 2: Implement immutable snapshots and atomic activation

**Files:**
- Modify: `supabase/prepass_marketo_mirror.sql`
- Modify: `scripts/test-prepass-marketo-mirror.sql`

1. Add SQL fixtures proving: a person omitted from snapshot two disappears from current views; snapshot one remains; a blocked snapshot leaves pointer/data unchanged.
2. Redesign additive objects: full-snapshot receipts, staging, immutable composite-key snapshot rows, singleton active pointer.
3. Make finalization validate export ID/checksum and `provider == parsed == unique == staged`, insert the complete snapshot, switch the pointer, and complete the run in one transaction.
4. Route all current lifecycle/attribution views through active rows only.
5. Retain RLS, narrow service-role grants, and fixed security-definer search paths.
6. Run the disposable PostgreSQL fixture.

## Task 3: Update safety checks, rollback, and operations

**Files:**
- Modify: `scripts/check-prepass-marketo-mirror.mjs`
- Modify: `supabase/prepass_marketo_mirror_rollback.sql`
- Modify: `docs/prepass-marketo-mirror-operations.md`

1. Update static checks for smart-list-only export, no `updatedAt` filter, immutable composite key, active pointer, and active-only views.
2. Order rollback so views/pointer/FKs are removed without touching legacy objects.
3. Document configuration, daily command, atomic gates, audit history, reconciliation, and failure behavior.
4. Run Node tests, rollout checks, SQL fixture, and inspect the final diff for security and legacy-table isolation.
5. Commit once with a focused conventional commit; do not push.
