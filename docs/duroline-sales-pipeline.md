# Duro Line sales pipeline reporting

## Scope and source authority

- Page: `/dashboard/durodyne/sales-pipeline`, protected by `requireClientAccess('durodyne')`.
- HighLevel HVAC location: `KU4RlCj1mDVF6eNxwqcZ`.
- HighLevel pipeline: `DAtuQG1i9iWE5JGvK0a5` (Duro-Line 50% Off).
- MMC organization `75`, funnel `14159165` (DuroLine / Line Sets).
- Storage: `public.duroline_pipeline_snapshots` in the existing Durodyne reporting database, configured by `SPARTACO_SUPABASE_*`. Despite the legacy variable names, this is the generalized client reporting project, not the auth project.
- Only complete, scope-validated source collections are inserted. A failed or partial pull never replaces the last valid report with empty data.
- Source CRM data and the existing HighLevel-to-MMC handoff automation are read-only to this feature.

## Metric semantics

HighLevel lead counts use distinct opportunity IDs. Current quality is membership in Interested - Small, Interested, Finding Distributor, or Sent To Sales, not a reconstruction of historical qualification. All source statuses are retained and displayed.

The complete MMC pipeline is an all-time current-state source view. It includes legacy and unmatched deals, so it is not a claim of marketing attribution. The separate connected view credits outcomes only to unique, non-conflicting identifier matches. Date cohorts use HighLevel creation date in UTC, not close date, activity date, or qualification date.

- Lead Generated: awaiting recorded contact.
- Contacted: recorded sales contact stage.
- Negotiating: recorded pipeline progression.
- Qualified: legacy/default automated handoff stage, **not evidence of salesperson activity**.
- Won/lost: MMC stage type is authoritative.
- Empty activity object: unavailable, not a contact timestamp.
- Updated timestamp: not evidence of contact or a close date.
- Missing amounts remain missing. Zero amounts and a Closed Won label do not establish positive realized revenue. Currency is not inferred.

No name-only joins, no blanket deduplication, and no name-based test exclusions. Ambiguous duplicate deals remain visible for review. Missing source IDs are a coverage gap, not proof that sales received no lead.

## Refresh

Private endpoint: `POST /api/internal/duroline-pipeline-sync`.

Required server-only configuration:

- `DUROLINE_MMC_CLIENT_ID`
- `DUROLINE_MMC_CLIENT_SECRET`
- `DUROLINE_HIGHLEVEL_TOKEN`
- `DUROLINE_PIPELINE_SYNC_SECRET`
- Existing reporting Supabase URL/service role configuration

The endpoint accepts only a dedicated bearer secret. It does not accept caller-specified account IDs, URLs, or source filters. The exact path is excluded from browser-session middleware but remains subject to the deployment tenant gate and endpoint bearer authentication.

An hourly n8n schedule calls this endpoint using a dedicated domain-restricted header credential. Errors propagate to the existing agency automation error workflow. The page displays capture time and warns after two hours without a valid refresh.

For a controlled operator refresh from the repository root:

```sh
node --conditions=react-server --import tsx scripts/refresh-duroline-pipeline.mts --dry-run
node --conditions=react-server --import tsx scripts/refresh-duroline-pipeline.mts
```

Keep native exports, QA actor credentials, reconciliation snapshots, and screenshots outside Git. Never commit client names, native totals, source credentials, or production export fixtures. Tests use synthetic fixtures, with optional private local audit replay.
