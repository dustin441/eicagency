# PrePass Marketo Atomic Snapshot Implementation Plan

> **For Hermes:** Implement task-by-task with RED-GREEN-REFACTOR and verify both Node and PostgreSQL fixtures.

**Goal:** Make each scheduled Reporting v2 Marketo run an atomic, full-population replacement while preserving immutable run receipts and change-only payload history and leaving legacy PrePass reporting untouched.

**Architecture:** Select the complete population with an operator-approved database source contract, stage and reconcile the full export, then publish the complete `run_id + marketo_id` dataset and switch a singleton active-run pointer in the same transaction. The same transaction records added/changed/removed payload history and deletes the prior raw snapshot and duplicate staging rows. Current reporting views join through the pointer; prior run receipts, checksums, and change history remain queryable for audit.

**Tech Stack:** Node.js Marketo Bulk Extract writer, PostgreSQL/Supabase SQL, Node test runner, disposable PostgreSQL fixture.

---

## Task 1: Lock the provider contract with Node tests

**Files:**
- Modify: `scripts/prepass-marketo-mirror-sync.test.mjs`
- Modify: `scripts/prepass-marketo-mirror-sync.mjs`

1. Add failing tests for dry-run smart-list discovery, database-approved publish contracts, `filter.smartListId`, source-definition mismatch, empty/under-minimum populations, and rejection of old window arguments.
2. Verify failure with `npm run test:prepass-marketo-mirror`.
3. Replace the incremental request with one full-list export and validate provider, parsed, and unique counts independently.
4. Verify Node tests pass.

## Task 2: Implement atomic full-snapshot replacement

**Files:**
- Modify: `supabase/prepass_marketo_mirror.sql`
- Modify: `scripts/test-prepass-marketo-mirror.sql`

1. Add SQL fixtures proving: a person omitted from snapshot two disappears from current views and is retained in immutable change history; a blocked snapshot leaves pointer/data unchanged.
2. Redesign additive objects: approved source contract, full-snapshot receipts, staging, composite-key current snapshot rows, immutable change history, and singleton active pointer.
3. Make finalization validate source identity/rules, absolute and relative population floors, export ID/checksum, and `provider == parsed == unique == staged`; insert the complete snapshot, preserve change history, switch the pointer, and complete the run in one transaction.
4. Route all current lifecycle/attribution views through active rows only.
5. Retain RLS, narrow service-role grants, and fixed security-definer search paths.
6. Run the disposable PostgreSQL fixture.

## Task 3: Update safety checks, rollback, and operations

**Files:**
- Modify: `scripts/check-prepass-marketo-mirror.mjs`
- Modify: `supabase/prepass_marketo_mirror_rollback.sql`
- Modify: `docs/prepass-marketo-mirror-operations.md`

1. Update static checks for smart-list-only export, no `updatedAt` filter, composite snapshot key, active pointer, prior-row replacement, and active-only views.
2. Order rollback so views/pointer/FKs are removed without touching legacy objects.
3. Document configuration, daily command, atomic gates, audit history, reconciliation, and failure behavior.
4. Run Node tests, rollout checks, SQL fixture, and inspect the final diff for security and legacy-table isolation.
5. Commit once with a focused conventional commit; do not push.
