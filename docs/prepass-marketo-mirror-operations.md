# PrePass Marketo Mirror Operations

## Ownership and invariant

- Marketo is authoritative for people, current fields, and lifecycle dates; native ad platforms remain authoritative for spend and delivery.
- Every scheduled Reporting v2 run is a **complete full-population export** selected by one reviewed Marketo smart-list ID. Incremental and `updatedAt` exports are forbidden.
- Existing PrePass workflows, legacy tables, pages, and `master_marketing_performance` remain unchanged during comparison.
- Published rows are keyed by `run_id + marketo_id` and cannot be updated. `prepass_marketo_active_snapshot` is the singleton pointer to the only run visible through current reporting views. A successful run deletes the prior raw snapshot in the same transaction, while completed run receipts and checksums remain audit history.

## Required secrets and configuration

Provide these only to the scheduled runtime; never commit them:

- `PREPASS_MARKETO_BASE_URL`
- `PREPASS_MARKETO_CLIENT_ID`
- `PREPASS_MARKETO_CLIENT_SECRET`
- `PREPASS_MARKETO_FULL_SMART_LIST_ID` — required positive ID of the approved full-population smart list
- `PREPASS_SUPABASE_URL`
- `PREPASS_SUPABASE_SERVICE_ROLE_KEY`

A controlled invocation may override only the list selection with `--smart-list-id <positive-id>`. There are no start/end window arguments.

## Initial rollout

1. Confirm the chosen smart list represents the complete Reporting v2 Marketo population, not a fleet segment or paid-attribution subset.
2. Apply `supabase/prepass_marketo_mirror.sql` after explicit SQL approval.
3. Seed reviewed campaign identities with `supabase/prepass_marketo_campaign_map_seed.sql`.
4. Refresh active validated-call attribution with `supabase/prepass_marketo_call_evidence_seed.sql`; calls add attribution evidence, never lifecycle events.
5. Run a provider-only full export with `--dry-run`, review export ID/count/checksum, then run the publish command.
6. Reconcile current, 30-day, 90-day, and YTD stage-date totals before enabling the daily schedule.

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
- Every required identity, lifecycle, attribution, and exact-case field, including `FBCLID`, exists in the live dictionary.
- Provider `numberOfRecords == parsed CSV rows == unique Marketo IDs == staged IDs`.
- Every ID is positive and every `updatedAt` value parses as a timestamp.
- A SHA-256 checksum of the exact provider CSV is recorded.

Finalization is one database transaction: it revalidates the receipt/count gates, inserts the complete new dataset, switches the singleton active pointer, deletes the prior raw snapshot and duplicate staging rows, and completes the receipt. A blocked or failed run cannot change the active pointer or current raw dataset. Consequently, a person omitted from the next successful full snapshot disappears immediately, and yesterday's values cannot leak into today's reporting.

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
7. Prior raw snapshot rows no longer exist, while prior run receipts and checksums remain available for audit.
8. Existing MMP totals remain unchanged and `/dashboard/reporting-v2/reconciliation` exposes variances.

## Failure and rollback

- Stop the scheduler before intervention.
- Preserve failed/blocked run receipts and inspect `error_code` / `error_detail`.
- Fix the source/configuration issue and run a new complete export; never replay an incremental window.
- Confirm the active pointer and active row count did not change after a failure.
- Before production use, the additive model can be removed with `supabase/prepass_marketo_mirror_rollback.sql` after exporting receipts and the current snapshot if required.
- Rollback does not touch legacy PrePass tables, pages, or MMP.
