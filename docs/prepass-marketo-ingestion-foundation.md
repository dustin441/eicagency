# PrePass full-population raw ingestion foundation

## Scope and consumer contract

This foundation ingests all accessible Marketo person fields for an independently verified complete current person population. It does not match calls, classify paid traffic, or alter legacy pipelines.

**Approval candidate:** `supabase/prepass_marketo_ingestion.sql`, not the broader mirror/reporting migration. It creates six tables: `prepass_marketo_source_contract`, `prepass_marketo_mirror_runs`, `prepass_marketo_mirror_staging`, `prepass_marketo_mirror_contacts`, `prepass_marketo_mirror_history`, `prepass_marketo_active_snapshot`; the read-only `prepass_marketo_active_contacts` view; safe-date helpers, immutable-row triggers, five writer RPCs, indexes, RLS and restricted runtime grants. It requires pgcrypto. It creates no campaign map, call evidence, attribution or reporting comparison objects.

Consumers read `public.prepass_marketo_active_contacts`, keyed by `marketo_id`. **`payload` is the complete raw person record**, preserving exact-case Marketo field names and CSV string values, including blanks. Typed columns are convenience projections, not the authoritative raw dictionary. Every successful snapshot replaces, not unions, the current population. Receipt `metadata.field_dictionary` preserves the accessible descriptors and `metadata.requested_fields` preserves names. Checksums and counts prove the exported file and field coverage; they do not independently prove a list includes the full database.

Do not apply both migrations independently without review: the ingestion migration is a subset of the existing broader migration and deliberately shares its object names/RPC contract.

## Read-only discovery before bulk quota use

```sh
node scripts/prepass-marketo-mirror-sync.mjs --preflight --smart-list-id APPROVED_CANDIDATE_ID
```

This reads the live dictionary and list definition only. It creates no export and makes no database writes. `populationVerified` is deliberately false. `--dry-run` differs: it creates/enqueues/downloads a real provider bulk export and consumes Marketo quota, but does not publish to Supabase.

The parser now requires downloaded headers to match every requested dictionary field exactly before staging the first batch. Missing or unexpected fields block publication. The dictionary is reloaded every run, including newly accessible custom fields. Blank raw cells remain blank strings; no source/paid/fleet filters are applied by ingestion.

## Live discovery, 2026-11-12

- 321 smart lists visible through the current Marketo API principal (paginated).
- No list named `Reporting v2 | Full Marketo Snapshot`, `All People`, or `All Leads` was returned. Name discovery is not a rules/count audit of all 321 lists; no source can therefore be approved as complete from this inventory.
- 302 accessible person fields; all current required fields validated. Dictionary checksum: `f188548f80ea71c0610162fe1e58af02c9a64420a30c96705908a09cad748bde`.
- Existing restricted workflows remain active and unchanged: `2DWV9T3JImkLpocY` (qualified fleet), `HXeWYUVZRjkMllty` (100+ fleet raw). These are not full-population sources.
- Bulk usage endpoint `/bulk/v1/leads/export/usage.json` returned provider error 610 (resource not found); remaining byte quota was not established. No new bulk export was created.
- Read-only SQL through the existing call workflow's Postgres credential found fleet enrichment and large-fleet contact tables, but none of the six new foundation tables. This observation is specific to that credential's database; confirm the intended production project/credential before any DDL.

## Production gates (not executed)

1. A Marketo operator creates/reviews a dedicated all-person smart list without campaign, activity-window, fleet, lifecycle, attribution, or email restrictions. Reconcile list People count to Database > All People. Do not create an unsafe broad fallback or relabel existing restricted lists.
2. Parent/operator explicitly approves **only** `supabase/prepass_marketo_ingestion.sql` on the verified intended Supabase database. This approval was not present during foundation work; no production DDL was applied.
3. Obtain Marketo export quota/headroom approval, then run a provider-only full export with all 302 (or current live) fields. Record complete source rules, list ID/name, checksum, provider ID/count and file hash. Reconcile count to All People.
4. Separately approve and insert the source-contract singleton: exact ID/name/rules checksum, positive minimum population, maximum allowed drop fraction, approver and notes. Runtime cannot modify it. CLI publication overrides are forbidden.
5. Configure the existing writer with secrets injected privately. Publish and reconcile counts/payload field coverage. A failed export/stage/finalization preserves the previous published snapshot; first-run failures leave no current snapshot.
6. Enable **one** canonical scheduler, daily `0 12 * * *` UTC (05:00 America/Phoenix), only after first successful full publication. Do not schedule a second writer alongside an existing full-population writer. Existing restricted/fleet schedules are out of scope and must not be silently changed. The unique staging lease prevents overlapping admitted runs; runtime/retry policy must fit the two-hour lease.

## Verification performed

- Node writer unit suite: 13 tests passed, including malformed CSV, duplicate IDs, invalid timestamps, bounded 10,000-row streaming, source contract, population and exact field-coverage gates.
- Existing full mirror PostgreSQL 16 migration, upgrade-grant, atomic publish/failure fixtures and rollback suite passed on a disposable container.
- Ingestion-only SQL applied twice on a separate disposable PostgreSQL 16 container: six tables, zero campaign/evidence tables, no SQL errors.
- No production snapshot, source contract or daily full-population scheduler was installed. No restricted/call pipeline or dashboard file changed.
