# Client Health Atomic Refresh v2 — Operator Activation Approval Package

**Status:** proposal only; **not approved for apply** and not applied to any Supabase project
**Target if later approved:** EIC Clients (`lozgnyxixzfxokllevtb`) only
**Production activation:** none

> Task 3A source reconciliation/task authorization, Task 3B1 normalized source facts, and Task 3B2 database-authoritative calculations are implemented and locally verified. This package remains blocked until both independent reviews pass the exact final SHA and Dustin explicitly approves that SHA. Schema review is not collector, schedule, application-release, or production-activation approval.

## Approval boundary

The reviewed unit is the exact commit containing:

- `supabase/client_health_atomic_refresh.sql`
- `supabase/client_health_atomic_refresh_verify.sql`
- `supabase/client_health_atomic_refresh_rollback.sql`
- `scripts/check-client-health-atomic-sql.mjs`
- `scripts/check-client-health-atomic-postgres.sh`
- this document

### Dustin approval — unavailable until independent reviews complete

- [x] Task 3A source reconciliation and task authorization are locally complete
- [x] Task 3B1 normalized committed source facts are locally complete
- [x] Task 3B2 database-authoritative calculation is locally complete
- [ ] Security/database/application reviews are complete
- [ ] **APPROVED** to apply the exact reviewed SQL to EIC Clients only
- [ ] Reviewed commit SHA: `________________________________________`
- [ ] I understand collector/schedule activation requires separate approval

**Dustin:** `__________________`  **Date/time:** `__________________`

An unchecked box, verbal discussion, approval of another SHA, or approval for another project is not authorization. No browser escalation and no production action are permitted by this document.

## v2 trust boundary

### Operator plane (Management API SQL workflow only)

The operator plane lives in schema `private`, owned by `postgres`:

- `private.client_health_config_revisions`: immutable, content-addressed canonical v2 revisions
- `private.client_health_config_revision_activations`: append-only activation audit rows
- `private.client_health_active_config_revision`: singleton active activation pointer
- `private.client_health_stage_config_revision(uuid,text,jsonb)`: idempotently stages exact reviewed content
- `private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)`: activates by compare-and-set (CAS)
- immutable trigger functions:
  - `public.client_health_guard_config_revision_immutable()`
  - `private.client_health_guard_activation_immutable()`

`service_role`, `anon`, and `authenticated` receive no `private` schema usage, table privileges, or operator-function execution. Staging and activation must be executed only by an approved operator through the EIC Management API SQL path. There is no public create/get-arbitrary-revision RPC and no runtime self-approval path.

Activation records the exact staged revision/hash, a 40-character reviewed commit SHA, operator identity, reason, and database activation timestamp. Activation is an atomic CAS against `p_expected_current_activation_id`; a stale operator cannot overwrite a newer pointer. Reusing an activation ID is accepted only as an exact idempotent retry that is already active.

### Runtime plane

Only `public.client_health_get_active_config_revision()` exposes configuration to `service_role`. It returns the exact active revision plus its activation receipt. The other public service-only RPCs are:

- `client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)`
- `client_health_get_refresh_run(uuid)`
- `client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint)`
- `client_health_get_refresh_lease(uuid)`
- `client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint)`
- `client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz)`
- `client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)`
- `client_health_get_source_run(uuid,uuid,uuid,bigint)`
- `client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint)`
- `client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)`
- `client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint)`
- `client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint)`
- `client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint)`

Every public runtime function is owned by `postgres`; default execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then granted only to `service_role`. Transient helpers are not granted. Direct lifecycle/evidence DML is revoked from `service_role` while v2 is installed.

## Canonical v2 revision and run authority

A revision has exact root keys `schemaVersion`, `calculationVersion`, `sourceContractVersion`, and `clients`; `schemaVersion` is exactly `2`. Each client has exact typed display/configuration fields, `fixedValues`, five approved metric definitions when approved, and provider-specific typed sources for Supabase, Google Sheets, or ClickUp. Secret-like keys, arbitrary metadata, executable collectors, retrieved values, and v1 assembly fields are rejected.

The database—not caller input—authoritatively derives and verifies:

1. revision SHA-256 and hash-derived revision UUID;
2. calculation and source-contract versions from the staged revision;
3. active activation ID pinned onto `client_health_refresh_runs.config_revision_activation_id`;
4. refresh identity SHA-256 from revision ID/hash, snapshot date, and revision versions;
5. refresh-run UUID from identity hash plus the fresh run-attempt UUID; and
6. lease grant timestamps/fencing state and persistence receipts.

Refresh creation fails unless the supplied revision is the currently active activation and all caller-supplied identity/version/UUID values match database derivation. A later activation cannot rewrite existing run provenance. Validation/publication use the pinned immutable revision, never mutable authoring rows.

## Task 3A source and task authority

Source creation and completion resolve the exact client/source binding from the run-pinned revision. Completion requires the frozen request fingerprint and exact provider-specific evidence schema, then reconciles provider identity, source-contract version, canonical timestamps, row counts, data-through dates, status, and sanitized error shape. Arbitrary evidence fields and contradictory succeeded/partial/failed representations fail closed.

Snapshot persistence requires its source-key set to exactly equal the frozen source set and reconciles every presented status, data-through date, row count, and stale flag to the committed terminal source run. `client_health_assert_refresh_integrity` repeats this reconciliation and revalidates committed provider evidence before validation and publication.

Snapshot tasks are accepted only when each list ID maps to exactly one succeeded, run-pinned ClickUp source with `permitsTasks=true` and that list in its frozen `allowedListIds`. Revision validation rejects overlapping task-enabled list ownership. PostgreSQL verification includes isolated regressions for the original contradictory-source exploit, wrong freshness/count/state, unauthorized lists, disabled task permission, and nonsucceeded ClickUp sources, with atomic no-partial-write assertions.

## Task 3B1 normalized fact authority

Each completed source run stores a separate `facts` JSON object projected only by the trusted assembler from that source's frozen `permittedFactFields`. Supported fields are bounded nonnegative scalars plus canonical sorted `{spend,results}` comparison rows. Fixed budget and allotted hours remain revision-owned and cannot be supplied by a source. Partial and failed sources persist only null values for their exact permitted key set.

The source-completion RPC validates exact keys, types, bounds, canonical row order, status semantics, and unique scalar ownership before storing facts. Exact retries include facts, refresh integrity revalidates committed facts against the run-pinned revision, rollback preserves the additive facts column as inert audit evidence, and `client_health_latest` does not expose source facts.

## Task 3B2 database calculation authority

`client_health_calculate_snapshot` independently derives the reporting windows, source statuses and freshness, source-owned values, revision-fixed values, ratio-of-sums comparisons, pacing, projected hours, margin, all five dimensions, ordered reasons, weighted score, critical-risk overrides, overall status, and minimum required data-through date. PostgreSQL intentionally duplicates the deterministic TypeScript engine, which is now a preview/reference implementation rather than publication authority.

Persistence treats caller calculation fields and identities as untrusted previews. It inserts only the database-derived snapshot, proof hash, snapshot UUID, and idempotency key, then returns those authoritative receipt fields. The runtime accepts derived receipt fields while continuing to require exact run, revision, client, and task-count identity. Caller task envelopes remain internally bound to their requested preview ID, but PostgreSQL authorizes each task and stores it under the derived snapshot ID.

Validation and publication recompute every persisted calculation and proof. The aggregate refresh evidence hash is independently rebuilt from immutable run metadata and sorted authoritative persistence receipts, using the same canonical projection submitted by the runtime. PostgreSQL verification includes a fixed `engine.ts` parity vector, decimal half-up tie formatting, forged all-healthy/value/reason/source/hash replacement, forged aggregate rejection, and privileged pre-validation corruption detection.

## Latest read model

`public.client_health_latest` does not expose the full revision JSON or persistence hashes. It projects only the columns consumed by `repository.ts`: revision client identity/display/timezone/config status, hours allotment, ClickUp list IDs, margin aliases, and metric configuration, plus snapshot/run fields. It joins the exact immutable revision and does not join mutable client authoring rows.

Task 3B2 local verification does not approve an apply. Independent security/database/application review, exact-SHA readback, Dustin's explicit EIC-only approval, migration backup, and production gates remain mandatory.

## Verification and exact readback

Local checks:

```bash
npm run check:client-health-atomic-sql
npm run check:client-health-atomic-postgres
npm run check:client-health-route-gate
bash -n scripts/check-client-health-atomic-postgres.sh
npx tsc --noEmit
```

The PostgreSQL check runs PostgreSQL 16 foundation → privilege hardening → forward → concurrent attempts → transaction-wrapped v2 verification → compatibility rollback. Verification proves operator isolation, active CAS, database-derived run identity/versioning, activation pinning, leases/fences, exact source/evidence reconciliation, frozen ClickUp task authorization, atomic persistence, immutable evidence, safe latest projection, exact ACLs, and rollback compatibility.

After any separately approved apply, read back and archive:

```sql
select n.nspname, p.oid::regprocedure, r.rolname owner, p.prosecdef, p.proacl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
join pg_catalog.pg_roles r on r.oid=p.proowner
where n.nspname in ('public','private') and p.proname like 'client_health_%'
order by 1,2::text;

select n.nspname, c.relname, c.relkind, c.relowner::regrole, c.relacl, c.reloptions
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relname like 'client_health_%'
order by 1,2;

select table_schema,table_name,column_name,is_nullable,data_type
from information_schema.columns
where (table_schema='private' and table_name like 'client_health_%')
   or (table_schema='public' and table_name in ('client_health_refresh_runs','client_health_snapshots'))
order by 1,2,ordinal_position;

select pg_catalog.pg_get_viewdef('public.client_health_latest'::regclass,true);
```

Also read back constraints, indexes, triggers, ACLs, active pointer/activation receipt, row counts, target project, exact SHA, operator, apply timestamp, verification notice, and final verification `ROLLBACK`. Stop before collector or schedule activation.

## Compatibility rollback

`supabase/client_health_atomic_refresh_rollback.sql` is itself approval-gated and EIC-only. Its preflight requires the EIC marker and exact complete v2 objects; it does not require empty tables. It:

1. revokes and drops the public active getter, all runtime RPCs, private stage/activate functions, and transient helpers in dependency order without `CASCADE`;
2. preserves private immutable revision rows, append-only activation rows, the active pointer, their immutable triggers/guard functions, lifecycle/evidence rows, and additive provenance FKs/constraints/indexes as audit history;
3. relaxes v2-required revision, activation, identity, attempt, evidence-hash, and idempotency columns to nullable so approved legacy writers can write null atomic metadata;
4. restores the exact foundation `client_health_latest` definition and only the previously approved `service_role` lifecycle/evidence CRUD; and
5. grants no private access, operator function, runtime self-approval, or browser privilege.

### Forward repair after rollback

Never rerun the original forward migration against residual audit objects. A separately reviewed repair must verify the exact residual schema/ACLs, prove revision and activation immutability, preserve every activation/pointer/fencing value, reconcile or explicitly archive null legacy provenance under an approved policy, restore `NOT NULL` only after proving zero incompatible nulls, recreate exact reviewed functions/ACLs, revoke direct DML again, and run repair-specific transaction-wrapped verification/readback.

No rollback or repair authorizes deleting audit evidence, escalating browser roles, applying to production, or activating collection.
