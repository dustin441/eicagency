# Client Health Atomic Refresh — Schema Approval Package

**Status:** proposal only; not applied to any Supabase project
**Target:** EIC Clients (`lozgnyxixzfxokllevtb`) only
**Production activation:** none. This package does not run a collector, change a schedule, deploy application code, or apply SQL.

## Approval boundary

The review unit is the exact commit containing:

- `supabase/client_health_atomic_refresh.sql`
- `supabase/client_health_atomic_refresh_verify.sql`
- `supabase/client_health_atomic_refresh_rollback.sql`
- the server-only RPC adapter and deterministic orchestration/persistence changes

> ### Dustin approval — required before apply
>
> - [ ] **APPROVED** to apply `supabase/client_health_atomic_refresh.sql` to EIC Clients only
> - [ ] I reviewed the exact commit SHA: `______________________________`
> - [ ] I understand this is schema approval only and does **not** approve production collector activation
>
> **Dustin:** `__________________`  **Date/time:** `__________________`

An unchecked box, verbal discussion, or approval of a different SHA is not authorization. Never apply this package to PrePass, Canary, or another project.

## Exact forward objects

### Immutable configuration revision and additive metadata

`public.client_health_config_revisions` is a new service-only, RLS-enabled table containing content-addressed approved configuration revisions. Each row stores a hash-derived UUID, the exact lowercase SHA-256 hash, canonical revision JSON, and creation time. The revision freezes active membership, collector/source authorization and windows, fixed inputs, metric calculation/display configuration, and dashboard display metadata. Exact-content creation is idempotent; hash/ID/content mismatch fails closed. An immutable trigger rejects update and delete, and browser/API roles receive no table privileges.

`public.client_health_refresh_runs` gains:

1. `config_revision_id uuid not null` and `config_revision_hash text not null`, with a composite foreign key to the immutable revision
2. `refresh_identity_hash text not null` (normalized logical-plan SHA-256 including revision identity)
3. `run_attempt_id uuid not null` (cryptographic per-execution attempt)
4. `lease_invocation_id uuid` (nullable)
5. `lease_claim_attempt_id uuid` (nullable)
6. `lease_granted_at timestamptz` (nullable)
7. `lease_expires_at timestamptz` (nullable)
8. `lease_fencing_token bigint not null default 0`
9. lowercase hash, unique attempt, fence, lease-shape, and revision constraints
10. partial unique index `client_health_refresh_runs_active_identity_unique (refresh_identity_hash) where run_status in ('collecting','validated')`
11. partial lease-expiry index

`public.client_health_snapshots` gains:

1. `config_revision_id uuid not null` and `config_revision_hash text not null`, with a composite foreign key to the immutable revision
2. `persistence_evidence_hash text not null`
3. `persistence_idempotency_key text not null`
4. lowercase SHA-256 checks and unique idempotency constraint

The forward preflight intentionally requires empty lifecycle/evidence tables because caller-generated IDs, revision provenance, and content hashes cannot be reconstructed safely. Mutable authoring configuration tables may already contain rows, but validation/publication never reread them. The preflight also requires EIC's `master_spartaco`, the approved foundation tables/view/triggers, `extensions.digest(bytea,text)`, and an installer that is `postgres` or a member of `postgres`. A partial/prior atomic installation aborts.

### Security-definer helpers (not API-callable)

All are owned by `postgres`; `PUBLIC`, `anon`, `authenticated`, and `service_role` have no execute grant.

- `client_health_revision_id(text)`
- `client_health_assert_safe_revision_json(jsonb,text,integer)`
- `client_health_assert_config_revision(uuid,text,jsonb)`
- `client_health_guard_config_revision_immutable()`
- `client_health_assert_exact_keys(jsonb,text[],text)`
- `client_health_canonical_json(jsonb)`
- `client_health_assert_owned_lease(uuid,uuid,uuid,bigint)`
- `client_health_assert_refresh_integrity(uuid)`

### Service-role runtime RPCs

All are owned by `postgres`. Execute is granted only to `service_role` after revoking `PUBLIC`, `anon`, `authenticated`, and `service_role` defaults.

- `client_health_create_config_revision(uuid,text,jsonb)`
- `client_health_get_config_revision(uuid)`
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

## Correctness and failure semantics

- Every `runClientHealthRefresh` call canonicalizes and creates/reads one immutable approved configuration revision before creating the run. The revision ID is derived from its SHA-256 hash, and exact-content retries are idempotent. Unknown/private/runtime fields, retrieved timestamps, collector functions/results, secret-bearing keys, malformed types, and oversized structures are excluded or rejected.
- Every invocation generates a non-injectable cryptographic `runAttemptId`. The normalized logical plan produces a stable `refreshIdentityHash` that includes configuration revision identity while excluding invocation, run-attempt, claim-attempt, and retrieval-only values; `refreshRunId` is derived from the identity hash plus the fresh run attempt.
- Refresh creation serializes on two 32-bit halves of the identity SHA-256 and is backed by a partial unique active-identity index. Exact ID/attempt retries are idempotent. A different unleased or lease-expired collecting/validated attempt is atomically fixed-failed as `refresh_attempt_superseded`; an unexpired lease blocks the newcomer.
- A process restart always creates a fresh attempt and recollects from scratch. Existing source/snapshot rows under a superseded failed run remain immutable audit evidence and cannot appear in `client_health_latest`.
- A claim is serialized by the refresh row lock. The same invocation with a different claim-attempt UUID cannot adopt the winner's lease.
- Grant and renewal times come from the database clock; duration is bounded to 1–600,000 ms. Exact acquisition retry returns the committed grant unchanged.
- `get_refresh_lease` returns only a non-expired lease on a `collecting` or `validated` run.
- Every mutation checks invocation, attempt, monotonic fence, and unexpired ownership. Source create/read/complete and snapshot persistence additionally require `collecting`; validated evidence cannot mutate.
- Snapshot plus ClickUp task rows are one function statement and therefore one database transaction boundary. Exact root/nested keys, scalar types, canonical IDs/URLs/ranks, duplicate task IDs, evidence-hash equality, and the canonical SHA-256 idempotency key are checked before acceptance.
- Source creation and snapshot persistence require the exact revision authorized client/source/window set. Validation requires snapshots and source-run rows to exactly cover the immutable revision, not the mutable authoring tables; no source may remain `running`.
- Publication revalidates revision integrity and exact frozen coverage. Concurrent or later edits to `client_health_clients` and `client_health_metric_config` cannot change collection authorization, validation, publication, or historical rendering. Publication changes `validated` to `published` and clears lease identity/timestamps in the same update. Failure likewise clears ownership atomically; an exact-fence terminal release is then a safe no-op.
- Published foundation triggers continue to make parent and child evidence immutable. `client_health_latest` exposes only published snapshots and joins their exact immutable revision for historical display/configuration; it does not join mutable client or metric authoring rows.
- Ambiguous publish response is reconciled by unowned refresh readback. It is never reversed unless the database proves the run remains `validated` under the still-owned fence.

Canonical JSON intentionally supports null, booleans, strings, arrays, objects, and finite ordinary-decimal numbers. The TypeScript producer rejects exponent-form number serialization; SQL rejects exponent-form canonical bundle numbers. This avoids JavaScript/PostgreSQL numeric spelling drift in the database-recomputed idempotency hash.

## Security posture

- Adapter: `src/services/client-health/atomic-refresh-production.ts` is server-only and accepts an injected RPC-capable database client. It contains no credential, browser client, project discovery, or source wiring.
- Direct `INSERT`, `UPDATE`, and `DELETE` on refresh runs, source runs, snapshots, and snapshot tasks are revoked from `service_role`; writes go through fenced RPCs.
- The immutable revision table grants no direct access to `service_role`, `anon`, or `authenticated`. Service code can create/read revisions only through exact reviewed RPCs; the immutable trigger remains after compatibility rollback to preserve audit history.
- `anon` and `authenticated` receive no runtime/helper execution and no direct lifecycle, evidence, or revision access.
- Existing RLS, published immutability triggers, and read grants remain. Configuration CRUD is outside this atomic write boundary and remains as approved by the foundation/hardening migration.
- Errors returned by the adapter include operation and optional database code, not backend message/detail/hint content.

## Pre-approval local checks

These do not connect to Supabase:

```bash
npm run check:client-health-atomic-sql
npm run check:client-health-atomic-postgres
npm run test:client-health-atomic-rpc
node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/client-health/config-revision.test.mts
npm run test:client-health-repository
npm run test:client-health-build-snapshot
npm run test:client-health-store-snapshot
npm run test:client-health-run-refresh
npm run test:client-health-adapters
npm run lint
npx tsc --noEmit
```

The static SQL checker verifies balanced SQL delimiters, expected signatures, owners, grants/revokes, non-lossy rollback properties, and required invariant/proof markers. `check:client-health-atomic-postgres` additionally runs PostgreSQL 16 foundation → privilege hardening → forward migration → concurrent-attempt race → transactional verification → compatibility rollback in a disposable Docker container.

## Approval-gated apply and readback

1. Freeze and record the reviewed commit SHA.
2. Confirm Dustin's approval box above is complete for that SHA.
3. Confirm the target project reference is exactly `lozgnyxixzfxokllevtb`.
4. Back up the six existing foundation tables and record row counts/ACLs.
5. Confirm lifecycle/evidence tables are empty and no prior/partial atomic or revision objects exist.
6. Apply the exact contents of `supabase/client_health_atomic_refresh.sql` as one transaction using the established EIC Management API SQL path. Do not split statements and do not substitute Dashboard edits.
7. Read back the revision table/trigger/RLS, additive columns, constraints, indexes, function signatures/owners/security-definer flags, view definition, and ACLs from `pg_catalog`/`information_schema`.
8. Run the exact `supabase/client_health_atomic_refresh_verify.sql` as `postgres`. Require its success notice and final `ROLLBACK`; it verifies immutable revisions, authoring-edit isolation, migration/runtime behavior, and leaves all fixtures rolled back.
9. Re-read counts and confirm no verification fixture ID/client key remains.
10. Record apply response, readback, verification output, target project, exact SHA, operator, and timestamp in the approval evidence artifact.
11. Stop. Collector/schedule activation requires a separate reviewed release approval and production QA gate.

Useful readback checks:

```sql
select p.oid::regprocedure, r.rolname as owner, p.prosecdef
from pg_catalog.pg_proc p
join pg_catalog.pg_roles r on r.oid = p.proowner
where p.pronamespace = 'public'::regnamespace
  and p.proname like 'client_health_%'
order by 1::text;

select table_name, column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('client_health_config_revisions','client_health_refresh_runs','client_health_snapshots')
  and column_name in (
    'id','revision_hash','revision','created_at',
    'config_revision_id','config_revision_hash','refresh_identity_hash','run_attempt_id',
    'lease_invocation_id','lease_claim_attempt_id','lease_granted_at','lease_expires_at','lease_fencing_token',
    'persistence_evidence_hash','persistence_idempotency_key'
  )
order by table_name, ordinal_position;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'client_health_%'
order by table_name, grantee, privilege_type;
```

## Compatibility rollback

Apply `supabase/client_health_atomic_refresh_rollback.sql` only to EIC, through the same approval-gated SQL path. It:

1. performs EIC/foundation/complete-install preflight;
2. revokes and drops every runtime RPC and transient helper in dependency order without `CASCADE`;
3. preserves `client_health_config_revisions`, all revision rows, the immutable update/delete trigger, and additive provenance columns/FKs/indexes as audit metadata;
4. restores the exact foundation `client_health_latest` view and approved service-role direct CRUD set for the four lifecycle/evidence tables;
5. preserves every lifecycle/evidence row and all other additive columns, constraints, active-identity/attempt indexes, and lease-expiry index;
6. relaxes refresh/snapshot revision columns, refresh identity/attempt columns, and persistence hash columns to nullable so approved legacy direct writers can continue. Browser roles receive no revision access.

The preserved revision/provenance/identity/attempt/lease/hash columns, constraints, unique indexes, immutable revision rows, and lease-expiry index are **residual inert audit metadata** after runtime function removal. Existing audit evidence remains valuable and must not be cleared. Legacy rows written afterward may have null revision provenance, refresh identity/attempt, and persistence hashes.

### Forward repair after compatibility rollback

Do **not** rerun the original forward file: its partial-install guard correctly rejects preserved additive metadata. Prepare a new, separately reviewed forward-repair migration that:

1. verifies the EIC marker, exact residual revision table/trigger, columns/constraints/indexes, current ACL baseline, and no unexpected dependents;
2. proves preserved revision rows remain immutable and leaves every existing fencing token unchanged;
3. either proves/backfills canonical revision provenance, evidence, and idempotency hashes for all null legacy rows or explicitly archives/excludes unreconstructable rows under an approved policy;
4. restores relevant `NOT NULL` constraints only after zero nulls are proven;
5. recreates helpers and runtime RPCs with the exact reviewed owners/ACLs;
6. revokes direct lifecycle/evidence DML again; and
7. runs a repair-specific transaction-wrapped verification and readback.

No rollback or repair is permission to delete historical evidence or activate production collection.
