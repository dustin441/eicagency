# PrePass Marketo Mirror Operations

## Ownership

- Marketo is authoritative for people, current fields, and lifecycle dates.
- The mirror admits every person returned by the selected `updatedAt` population before attribution filtering. It mirrors the versioned PrePass reporting-field allowlist, not every field in Marketo's 292-field account dictionary. Expanding that allowlist is a schema/version change and must be recorded in run metadata.
- Native ad platforms are authoritative for spend and delivery.
- The mirror writer is the only process allowed to mutate `prepass_marketo_mirror_contacts`.
- Existing PrePass workflows and reporting tables remain active during comparison.

## Existing workflow relationship

Workflow `HXeWYUVZRjkMllty` (`PrePass 100+ Fleet Marketo Raw Sync`) already contains useful snapshot-lease, checksum, provider-count, and finalization patterns, but it is scoped to 100+ fleet smart lists and had no recorded executions at the time of review. Keep it unchanged during comparison. It is not the full-population source of truth. Reuse its proven control pattern, then derive its fleet-only projection from the full mirror in a later, separately approved cutover.

Workflow `7GtYRkrdICcNp9YR` remains the compatibility writer for `campaign_leads`. That table is attribution-filtered and must not be treated as the raw Marketo mirror.

## Required secrets

Provide these only to the scheduled runtime. Do not commit them.

- `PREPASS_MARKETO_BASE_URL`
- `PREPASS_MARKETO_CLIENT_ID`
- `PREPASS_MARKETO_CLIENT_SECRET`
- `PREPASS_SUPABASE_URL`
- `PREPASS_SUPABASE_SERVICE_ROLE_KEY`

## Initial rollout

1. Apply `supabase/prepass_marketo_mirror.sql` after explicit SQL approval.
2. Seed reviewed campaign identities with `supabase/prepass_marketo_campaign_map_seed.sql`.
3. After the campaign map is reviewed, refresh active validated-call attribution with `supabase/prepass_marketo_call_evidence_seed.sql`. This imports evidence only and does not create lifecycle events.
4. Run bounded historical `updatedAt` windows of at most 31 days using `scripts/prepass-marketo-mirror-sync.mjs --start ... --end ...`.
5. Reconcile the union of unique Marketo IDs against a full-population provider export before declaring the backfill complete.
6. Enable the daily incremental only after current, 30-day, 90-day, and YTD stage-date parity passes.

Historical windows are incremental runs, not full snapshots. Do not mark contacts absent from one historical window. A true `full_snapshot` run may mark absent people only when the provider export is proven to contain the entire current Marketo population in one reconciled run.

## Daily command

Once a completed run exists, the writer resumes from the latest completed `window_end` with a three-day overlap:

```bash
node scripts/prepass-marketo-mirror-sync.mjs
```

For a controlled read-only provider test:

```bash
node scripts/prepass-marketo-mirror-sync.mjs \
  --start 2026-10-08T00:00:00Z \
  --end 2026-10-09T00:00:00Z \
  --dry-run
```

## Publish gates

A run is published only when:

- Marketo reports `Completed`.
- Provider record count equals parsed record count.
- Every staged row has a positive Marketo ID and valid `updatedAt`.
- Unique staged IDs equal parsed IDs.
- A SHA-256 checksum is recorded.
- Finalization completes atomically.

A count mismatch leaves the run `blocked` and cannot mutate the current mirror.

## Schedule

Use one canonical scheduler. Recommended cadence is daily at 01:00 UTC, before the existing MMP refresh. Do not activate a second scheduled copy for testing or backfill. Manual and scheduled runs must not overlap. The database admits only one staging run and automatically marks leases older than two hours as failed with `STALE_LEASE` before admitting a replacement.

## Reconciliation

For every run, verify:

1. Provider, parsed, and staged counts agree.
2. `prepass_marketo_lifecycle_events` has at most one row per person and stage.
3. Stage-date counts match a direct Marketo aggregate for the same window.
4. Paid-mapped plus paid-unmapped equals the paid-evidence population.
5. Calls can change attribution but never create another lifecycle event.
6. Existing MMP totals remain unchanged.
7. `/dashboard/marketo-mirror` exposes every variance rather than forcing it to zero.

## Failure and rollback

- Stop the single scheduler.
- Preserve failed and blocked run receipts.
- Fix the source failure, then replay the exact bounded window.
- The three-day overlap makes replay idempotent.
- To remove the additive model before production use, run `supabase/prepass_marketo_mirror_rollback.sql` after exporting run receipts and history.
- The rollback does not touch MMP or existing PrePass tables.
