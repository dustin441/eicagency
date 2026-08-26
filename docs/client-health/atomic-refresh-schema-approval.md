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

### Additive table metadata

`public.client_health_refresh_runs` gains:

1. `refresh_identity_hash text not null` (normalized logical-plan SHA-256)
2. `run_attempt_id uuid not null` (cryptographic per-execution attempt)
3. `lease_invocation_id uuid` (nullable)
4. `lease_claim_attempt_id uuid` (nullable)
5. `lease_granted_at timestamptz` (nullable)
6. `lease_expires_at timestamptz` (nullable)
7. `lease_fencing_token bigint not null default 0`
8. lowercase identity-hash, unique attempt, fence, and lease-shape constraints
9. partial unique index `client_health_refresh_runs_active_identity_unique (refresh_identity_hash) where run_status in ('collecting','validated')`
10. partial lease-expiry index

`public.client_health_snapshots` gains:

1. `persistence_evidence_hash text not null`
2. `persistence_idempotency_key text not null`
3. `client_health_snapshots_persistence_evidence_hash` lowercase SHA-256 check
4. `client_health_snapshots_persistence_idempotency_key` lowercase SHA-256 check
5. `client_health_snapshots_idempotency_unique`

The forward preflight intentionally requires empty lifecycle/evidence tables because caller-generated IDs and content hashes cannot be reconstructed safely. Configuration tables may already contain rows. It also requires EIC's `master_spartaco`, the approved foundation tables/view/triggers, `extensions.digest(bytea,text)`, and an installer that is `postgres` or a member of `postgres`. A partial/prior atomic installation aborts.

### Security-definer helpers (not API-callable)

All are owned by `postgres`; `PUBLIC`, `anon`, `authenticated`, and `service_role` have no execute grant.

- `client_health_assert_exact_keys(jsonb,text[],text)`
- `client_health_canonical_json(jsonb)`
- `client_health_assert_owned_lease(uuid,uuid,uuid,bigint)`

### Service-role runtime RPCs

All are owned by `postgres`. Execute is granted only to `service_role` after revoking `PUBLIC`, `anon`, `authenticated`, and `service_role` defaults.

- `client_health_create_refresh_run(uuid,text,uuid,date,text,text,timestamptz)`
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

- Every `runClientHealthRefresh` call generates a non-injectable cryptographic `runAttemptId`. The normalized logical plan produces a stable `refreshIdentityHash` that excludes invocation, run-attempt, and claim-attempt values; `refreshRunId` is derived from the identity hash plus the fresh run attempt.
- Refresh creation serializes on two 32-bit halves of the identity SHA-256 and is backed by a partial unique active-identity index. Exact ID/attempt retries are idempotent. A different unleased or lease-expired collecting/validated attempt is atomically fixed-failed as `refresh_attempt_superseded`; an unexpired lease blocks the newcomer.
- A process restart always creates a fresh attempt and recollects from scratch. Existing source/snapshot rows under a superseded failed run remain immutable audit evidence and cannot appear in `client_health_latest`.
- A claim is serialized by the refresh row lock. The same invocation with a different claim-attempt UUID cannot adopt the winner's lease.
- Grant and renewal times come from the database clock; duration is bounded to 1–600,000 ms. Exact acquisition retry returns the committed grant unchanged.
- `get_refresh_lease` returns only a non-expired lease on a `collecting` or `validated` run.
- Every mutation checks invocation, attempt, monotonic fence, and unexpired ownership. Source create/read/complete and snapshot persistence additionally require `collecting`; validated evidence cannot mutate.
- Snapshot plus ClickUp task rows are one function statement and therefore one database transaction boundary. Exact root/nested keys, scalar types, canonical IDs/URLs/ranks, duplicate task IDs, evidence-hash equality, and the canonical SHA-256 idempotency key are checked before acceptance.
- Validation requires snapshots to exactly cover active configured clients and source-run rows to exactly cover each snapshot's configured `source_statuses`; no source may remain `running`.
- Publication changes `validated` to `published` **and clears lease identity/timestamps in the same UPDATE**. Failure also clears ownership in its terminal UPDATE. A subsequent exact-fence terminal release is a safe no-op when ownership is already clear.
- Published foundation triggers continue to make parent and child evidence immutable. `client_health_latest` exposes only active clients from published runs.
- Ambiguous publish response is reconciled by unowned refresh readback. It is never reversed unless the database proves the run remains `validated` under the still-owned fence.

Canonical JSON intentionally supports null, booleans, strings, arrays, objects, and finite ordinary-decimal numbers. The TypeScript producer rejects exponent-form number serialization; SQL rejects exponent-form canonical bundle numbers. This avoids JavaScript/PostgreSQL numeric spelling drift in the database-recomputed idempotency hash.

## Security posture

- Adapter: `src/services/client-health/atomic-refresh-production.ts` is server-only and accepts an injected RPC-capable database client. It contains no credential, browser client, project discovery, or source wiring.
- Direct `INSERT`, `UPDATE`, and `DELETE` on refresh runs, source runs, snapshots, and snapshot tasks are revoked from `service_role`; writes go through fenced RPCs.
- `anon` and `authenticated` receive no runtime/helper execution and no direct lifecycle/evidence DML.
- Existing RLS, published immutability triggers, and read grants remain. Configuration CRUD is outside this atomic write boundary and remains as approved by the foundation/hardening migration.
- Errors returned by the adapter include operation and optional database code, not backend message/detail/hint content.

## Pre-approval local checks

These do not connect to Supabase:

```bash
npm run check:client-health-atomic-sql
npm run check:client-health-atomic-postgres
npm run test:client-health-atomic-rpc
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
4. Back up the six foundation tables and record row counts/ACLs/function definitions.
5. Confirm lifecycle/evidence tables are empty and no prior/partial atomic columns exist.
6. Apply the exact contents of `supabase/client_health_atomic_refresh.sql` as one transaction using the established EIC Management API SQL path. Do not split statements and do not substitute Dashboard edits.
7. Read back columns, constraints, index, function signatures/owners/security-definer flags, and ACLs from `pg_catalog`/`information_schema`.
8. Run the exact `supabase/client_health_atomic_refresh_verify.sql` as `postgres`. Require its success notice and final `ROLLBACK`; it uses fixtures and temporarily changes active configuration only inside the rolled-back transaction.
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
  and table_name in ('client_health_refresh_runs','client_health_snapshots')
  and column_name in (
    'refresh_identity_hash','run_attempt_id',
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
2. revokes every runtime and helper function;
3. drops callers before helpers, including `client_health_canonical_json`, without `CASCADE`;
4. restores the approved service-role direct CRUD set for the four lifecycle/evidence tables;
5. preserves every row and all additive columns, constraints, active-identity/attempt indexes, and the lease-expiry index;
6. relaxes the two refresh identity/attempt columns and two persistence hash columns to nullable so approved legacy direct writers can continue.

The preserved identity/attempt/lease/hash columns, constraints, unique indexes, and lease-expiry index are **residual inert metadata** after function removal. Existing audit evidence remains valuable and must not be cleared. Legacy rows written afterward may have null refresh identity/attempt and persistence hashes.

### Forward repair after compatibility rollback

Do **not** rerun the original forward file: its partial-install guard correctly rejects preserved additive metadata. Prepare a new, separately reviewed forward-repair migration that:

1. verifies the EIC marker, exact residual columns/constraints/index, current ACL baseline, and no unexpected dependents;
2. leaves every existing fencing token unchanged;
3. either proves/backfills canonical evidence and idempotency hashes for all null legacy rows or explicitly archives/excludes unreconstructable rows under an approved policy;
4. restores hash `NOT NULL` only after zero nulls are proven;
5. recreates helpers and runtime RPCs with the exact reviewed owners/ACLs;
6. revokes direct lifecycle/evidence DML again; and
7. runs a repair-specific transaction-wrapped verification and readback.

No rollback or repair is permission to delete historical evidence or activate production collection.
