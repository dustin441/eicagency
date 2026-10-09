# PrePass Marketo Mirror Comparison

## Goal

Add a side-by-side reporting path without modifying or replacing existing PrePass tables, views, workflows, routes, or metrics. Marketo remains authoritative for people and lifecycle dates. Native ad platforms remain authoritative for spend and delivery.

## Data contract

1. Mirror every Marketo person returned by the approved full-population export, even when attribution fields are blank.
2. Preserve the latest raw payload and append changed payloads to history.
3. Derive exactly one lifecycle event per `marketo_id + stage` from `dateMQL`, `dateSQL`, and `dateClosedWon`.
4. Attribute a lifecycle event only through valid paid UTM/click evidence or an active validated call match.
5. Keep paid evidence with unknown campaign/focus visible as paid-unmapped.
6. Keep CRM totals, paid outcome-period totals, legacy MMP totals, and acquisition-cohort metrics separate.
7. Publish a mirror run only after provider count, parsed count, unique ID count, checksum, and staged-row validation pass.
8. Daily incrementals update fields to the current Marketo value, including clearing values that became blank. Periodic full snapshots can mark absent people without deleting history.

## Additive objects

- `prepass_marketo_mirror_runs`
- `prepass_marketo_mirror_staging`
- `prepass_marketo_mirror_contacts`
- `prepass_marketo_mirror_history`
- `prepass_marketo_campaign_map`
- `prepass_marketo_lifecycle_events`
- `prepass_marketo_person_attribution`
- `prepass_marketo_paid_lifecycle_events`
- `prepass_marketo_mirror_comparison(start,end)`
- `prepass_marketo_focus_comparison(start,end)`
- `/dashboard/marketo-mirror`

## Release sequence

1. Land schema and workflow artifacts in a review branch.
2. Validate migration and rollback on disposable PostgreSQL.
3. Apply additive SQL only after approval.
4. Run a bounded full backfill, then compare provider and mirror counts.
5. Deploy the dashboard page to preview only.
6. Reconcile current, prior, 30-day, 90-day, and YTD windows.
7. Keep both paths visible until Dustin approves a later cutover.

## Non-goals

- No changes to `master_marketing_performance`, `_mmp_source`, or existing focus pages.
- No deletion or repurposing of existing source tables.
- No merge to `main` or production dashboard promotion in this change.
- No campaign or advertising-platform changes.
