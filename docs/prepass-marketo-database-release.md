# PrePass Marketo Database foundation

## Scope

The Marketo Database page is an additive reporting surface at `/dashboard/marketo`, linked from the PrePass sidebar and Reporting v2. It is not a rebuild of paid attribution, call matching, SMB/ABM campaign assignment, or the legacy dashboards.

The raw foundation is the complete current Marketo person population and all accessible person fields, refreshed daily. It is not a historical export of every Marketo activity, program membership, opportunity, or deleted person. Preserve raw field names and values so downstream reporting can evolve without changing ingestion eligibility. Do not claim company/deal counts from unique-person lifecycle dates.

## Invariants

- Ingest every current person, regardless of campaign, source, lifecycle stage, fleet size, email or phone completeness.
- Use only the approved full-population source contract. Never substitute the restricted call/enrollment mirror or union yesterday's removed people into the current database.
- Preserve the last complete published snapshot when a run fails. Show freshness independently from scheduler activation.
- Count unique Marketo IDs, not platform conversion actions or assumed unique companies.
- Keep acquisition cohort conversion separate from outcome-period stage counts.
- Missing dates and missing acquisition sources are data-quality findings, not zero-duration journeys or paid leads.
- Raw person fields, credentials and PII stay server-side. The dashboard receives aggregates only, after PrePass access authorization.
- Recommendations are evidence-backed diagnostic priorities. They do not establish causal uplift or promise a performance improvement.

## Production activation gates

1. Inventory the live Marketo source and compare its full population count with Marketo Database > All People. The dedicated smart list must contain no source, lifecycle, fleet-size, email, campaign or activity-window restrictions.
2. Confirm API permission to export all accessible fields and sufficient Bulk Extract allowance. Record the provider field dictionary and exact source definition checksum.
3. Review the additive ingestion-only SQL (`supabase/prepass_marketo_ingestion.sql`) and aggregate reporting SQL (`supabase/prepass_marketo_database_reporting.sql`). Apply production SQL only with the required explicit approval, then read back schema and role privileges. Do not change existing legacy reporting objects as part of this release. Operational rollback disables the new schedule and reverts the new UI while retaining raw snapshots and receipts; destructive raw-table removal requires a separate approved archival plan.
4. Approve the source ID/name/rules checksum and population safeguards. Runtime credentials must not be able to change the approved source contract.
5. Complete a real initial export and atomic publication. Require provider row count = parsed rows = staged rows = unique positive Marketo IDs, plus valid timestamps and checksums.
6. Reconcile aggregate totals and source shares with the active snapshot. Verify date windows, unknown-source inclusion, lifecycle chronology coverage, and that no people disappear because they lack attribution.
7. Verify authorized and unauthorized route behavior. Run unit tests, SQL fixtures, privilege checks, typechecking, lint and production build. Use representative synthetic fixtures for edge cases, not as production data.
8. Push the isolated review branch and open a PR into `main`. Dustin is the production launcher under `docs/deployment-governance.md`; no direct production push, CLI production deployment, or manual alias reassignment.
9. Enable exactly one canonical daily writer only after the first publication succeeds. Target 05:00 America/Phoenix (12:00 UTC). Prove a real scheduled run and destination readback, not just a configured schedule.
10. Verify the exact production commit, stable route, refreshed snapshot timestamp and live aggregate parity before declaring the page live.

## Status vocabulary

- **Implemented:** code exists and its stated checks passed.
- **Review/approval required:** code or additive SQL is ready but not authorized for production activation.
- **Blocked:** a specific prerequisite prevents a full export/publication or verification.
- **Running:** a tracked execution is actually in progress.
- **Live:** production deployment and the stable route have both been verified.

A draft PR, successful local fixture, active workflow, or restricted mirror is not evidence that the full Marketo database is syncing daily.

## Verification and activation status, November 12, 2026

- Live discovery returned 302 accessible person fields and 321 visible smart lists. No dedicated full-person list was found by name; this is not a rules/count audit of every existing list.
- Production Supabase project `hdaftbqteexugqakgdbx` was checked directly using the existing production configuration: both new source-contract and raw-contact endpoints returned 404, while an existing table was accessible. No production schema was applied.
- Marketo UI at `app-ab69.marketo.com` returned the sign-in page in the available local browser context. The documented public Smart Lists REST API supports query/clone/delete, not authoring new qualification rules: https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/assets/smart-lists.
- The initial source prerequisite is a dedicated smart list named `Reporting v2 | Full Marketo Snapshot`, with a system-field qualification such as `Created At is not empty`, no marketing or lifecycle restrictions, and its count independently reconciled to Database > All People. Supply its list ID and verified count before approving the source contract.
- The daily GitHub workflow is opt-in, guarded by repository variable `PREPASS_MARKETO_FULL_SYNC_ENABLED=true`. No repository variables or dedicated PrePass secrets were configured during this work, so it is not activated. Configure its five named secrets privately only after first publication and verification. Do not enable another full-population scheduler alongside it.
- The ingestion receipt now attests all-accessible-person scope and exact dictionary coverage only after live approved-source validation and exact CSV header/count validation. A deterministic network fixture tests this bridge to dashboard availability, including rejection before receipt/finalization when a custom field is omitted. This is a test fixture, not a production import.
- The page supports separate Marketo lead source, original UTM source, original source type, and latest UTM source dimensions, with no silent fallback. Source-level lifecycle rates and median close times supplement total source shares.
- Production release still requires explicit additive schema/source approval, a real full export with native count parity, first successful publication, scheduler setup, reviewed PR launch, and production route/readback verification.
