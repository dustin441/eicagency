# PrePass Marketo Mirror Operations

## Ownership and invariant

- Marketo is authoritative for people, current fields, and lifecycle dates; native ad platforms remain authoritative for spend and delivery.
- Every scheduled Reporting v2 run is a **complete full-population export** selected by one reviewed Marketo smart-list ID. Incremental and `updatedAt` exports are forbidden.
- Existing PrePass workflows, legacy tables, pages, and `master_marketing_performance` remain unchanged during comparison.
- Published rows are keyed by `run_id + marketo_id` and cannot be updated. `prepass_marketo_active_snapshot` is the singleton pointer to the only run visible through current reporting views. A successful run deletes the prior raw snapshot in the same transaction. Run receipts, checksums, and immutable added/changed/removed payload history remain available for audit.

## Required secrets and configuration

Provide these only to the scheduled runtime; never commit them:

- `PREPASS_MARKETO_BASE_URL`
- `PREPASS_MARKETO_CLIENT_ID`
- `PREPASS_MARKETO_CLIENT_SECRET`
- `PREPASS_MARKETO_FULL_SMART_LIST_ID` — used only for provider-only dry-run discovery before the source contract is approved
- `PREPASS_SUPABASE_URL`
- `PREPASS_SUPABASE_SERVICE_ROLE_KEY`

`--smart-list-id <positive-id>` is accepted only with `--dry-run`. Publishing always reads the operator-approved identity, rules checksum, minimum count, and maximum population-drop fraction from `prepass_marketo_source_contract`. The service role can read but cannot modify that contract. There are no start/end window arguments.

## Initial rollout

1. Confirm the chosen smart list represents the complete Reporting v2 Marketo population, not a fleet segment or paid-attribution subset.
2. Apply `supabase/prepass_marketo_mirror.sql` after explicit SQL approval.
3. Run a provider-only full export with `--dry-run`. Reconcile its population to Marketo Database > All People and review the returned list name, rules checksum, export ID, count, and CSV checksum.
4. In an explicitly approved SQL change, insert the singleton `prepass_marketo_source_contract` row with that exact ID/name/rules checksum, a positive minimum population, a conservative maximum drop fraction such as `0.2000`, approver, and notes. Do not grant runtime credentials permission to alter this row.
5. Seed reviewed campaign identities with `supabase/prepass_marketo_campaign_map_seed.sql`.
6. Refresh active validated-call attribution with `supabase/prepass_marketo_call_evidence_seed.sql`; calls add attribution evidence, never lifecycle events.
7. Run the publish command and reconcile current, 30-day, 90-day, and YTD stage-date totals before enabling the daily schedule.

## Commands

Provider-only validation (does not begin or publish a database run):

```bash
node scripts/prepass-marketo-mirror-sync.mjs --dry-run
```

Daily full replacement:

```bash
node scripts/prepass-marketo-mirror-sync.mjs
```

Controlled list override:

```bash
node scripts/prepass-marketo-mirror-sync.mjs --smart-list-id 12345 --dry-run
```

## Atomic publication gates

The writer creates one staging run, reads Marketo's live lead-field dictionary, requests one Marketo bulk export with `filter.smartListId` and every accessible field, downloads the completed CSV, and fails closed unless:

- Marketo reports `Completed` and a nonblank export ID.
- The smart-list name/rules and complete field dictionary are checksummed in the run receipt.
- The live smart-list ID, exact name, and rules checksum match the database-approved source contract.
- Every required identity, lifecycle, attribution, and exact-case field, including `FBCLID`, exists in the live dictionary.
- Provider `numberOfRecords == parsed CSV rows == unique Marketo IDs == staged IDs`.
- The population is nonzero, is not below the approved absolute minimum, and has not fallen beyond the approved fraction from the preceding successful run.
- Every ID is positive and every `updatedAt` value parses as a timestamp.
- A SHA-256 checksum of the exact provider CSV is recorded.

Finalization is one database transaction: it revalidates the source contract, receipt, count, and population gates; inserts the complete new dataset; records immutable payload history only for people added, changed, or removed; switches the singleton active pointer; deletes the prior raw snapshot and duplicate staging rows; and completes the receipt. A blocked or failed run cannot change the active pointer or current raw dataset. Consequently, a person omitted from the next successful full snapshot disappears immediately, yesterday's values cannot leak into today's reporting, and row-level changes remain auditable without storing a second complete raw snapshot every day.

## Schedule and lease

Use one canonical scheduler at 05:00 Arizona time (12:00 UTC). Do not overlap manual and scheduled runs. A partial unique index allows one `staging` run; the begin RPC marks a lease older than two hours `failed` with `STALE_LEASE` before admitting a replacement.

## Reconciliation

For every successful run verify:

1. Provider, parsed, unique, and staged counts agree.
2. `prepass_marketo_active_snapshot.active_run_id` equals the completed run.
3. Active snapshot row count equals the receipt count.
4. Lifecycle events have at most one row per active person and stage.
5. Paid-mapped plus paid-unmapped equals the paid-evidence population.
6. Calls can change attribution but never create lifecycle events.
7. Prior raw snapshot rows no longer exist, while prior run receipts, checksums, and change-only payload history remain available for audit.
8. Existing MMP totals remain unchanged and `/dashboard/reporting-v2/reconciliation` exposes variances.

## Failure and rollback

- Stop the scheduler before intervention.
- Preserve failed/blocked run receipts and inspect `error_code` / `error_detail`.
- Fix the source/configuration issue and run a new complete export; never replay an incremental window.
- Confirm the active pointer and active row count did not change after a failure.
- Before production use, the additive model can be removed with `supabase/prepass_marketo_mirror_rollback.sql` after exporting receipts and the current snapshot if required.
- Rollback does not touch legacy PrePass tables, pages, or MMP.
