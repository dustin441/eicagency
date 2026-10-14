# PrePass Reporting v2, Daily Full Marketo Snapshot

## Decision

Reporting v2 is additive. Existing PrePass tables, workflows, pages, and navigation stay unchanged. The only new PrePass left-navigation entry is `Reporting v2`, which opens a hub for the v2 Overview, SMB, ABM, FD360, Campaign Performance, and Reconciliation pages.

Marketo is authoritative for the current person population, current person fields, and lifecycle dates. Native ad platforms remain authoritative for spend and delivery.

## Daily source contract

Each scheduled run must export the complete current Marketo population from a dedicated full-population smart list. Incremental `updatedAt` exports and merges with yesterday's published dataset are not allowed for Reporting v2.

At the start of every run, the writer must:

1. Read Marketo's current lead-field dictionary.
2. Export every accessible Marketo person in the approved full-population smart list with every accessible field.
3. Preserve the raw field names and values returned by the export.
4. Record the smart-list ID/name/rules checksum, field count/dictionary checksum, provider export ID, provider row count, parsed row count, unique Marketo ID count, and raw-file SHA-256 checksum.
5. Stage the complete export without changing the published snapshot.
6. Publish only when all receipt and row-integrity checks pass.
7. Atomically replace the entire published current dataset. A failed or blocked run must leave the previously published snapshot intact and visibly stale.

Prior run receipts and changed payload history are audit data only. They must never be unioned into the current Reporting v2 population.

## Marketo prerequisite

The October 14 API inventory found 309 accessible smart lists, but none represented the complete Marketo person population. `All People` is not available as a Bulk Lead Export smart-list name. Existing lists such as inbound calls, online enrollments, and landing-page forms are filtered subsets and are not acceptable.

Create one dedicated Marketo smart list named `Reporting v2 | Full Marketo Snapshot`. Its qualification must include every current Marketo person without attribution, lifecycle, fleet-size, activity-date, email, or campaign filters. Prefer a current-state system field rule such as `Created At is not empty`, then verify its People count equals Marketo Database > All People before approving its ID for automation.

The production writer must require that approved smart-list ID through `PREPASS_MARKETO_FULL_SMART_LIST_ID`; it must not silently fall back to a partial list.

## Schedule

Target schedule after production approval: daily at 5:00 AM America/Phoenix, which is 12:00 UTC year-round. Use one canonical scheduler only. Do not overlap manual, backfill, preview, and scheduled writers.

## Publication gates

A snapshot can become current only when:

- Marketo reports the bulk export as `Completed`.
- The source is the configured full-population smart list.
- The field dictionary contains the required identity and lifecycle fields.
- Provider rows equal parsed rows, staged rows, and unique positive Marketo IDs.
- Every row has a valid `updatedAt` value.
- The field dictionary and source file have valid SHA-256 checksums.
- Final publication and current-snapshot replacement complete atomically.

## Reporting contract

- Lead/person population comes from the current published Marketo snapshot.
- MQL uses Marketo `dateMQL`.
- SQL uses Marketo `dateSQL`.
- Closed Won uses Marketo `dateClosedWon`.
- Each Marketo ID is counted at most once per lifecycle stage.
- Paid attribution is a classification applied after ingestion, never an ingestion filter.
- Paid evidence with no reviewed campaign/focus mapping remains visible as paid-unmapped.
- Platform conversion actions remain separate from unique Marketo people.
- Acquisition-cohort reporting remains distinct from outcome-period stage-date reporting.

## Release gates

1. Update and review draft PR #38 against current `main`.
2. Verify migration and rollback on disposable PostgreSQL.
3. Verify the writer against a non-production smart-list export.
4. Create and count-reconcile the full-population Marketo smart list.
5. Obtain explicit approval before applying additive production SQL.
6. Publish the first full snapshot and reconcile current month, prior month, 30-day, 90-day, and YTD windows.
7. Keep legacy and v2 pages side by side until an independently reviewed cutover is approved.
