import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const paths = {
  forward: resolve(root, 'supabase/client_health_atomic_refresh.sql'),
  rollback: resolve(root, 'supabase/client_health_atomic_refresh_rollback.sql'),
  verify: resolve(root, 'supabase/client_health_atomic_refresh_verify.sql'),
};
const sql = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const fail = (message) => { throw new Error(`client-health atomic SQL static check failed: ${message}`); };
const requireText = (text, fragment, label) => { if (!text.includes(fragment)) fail(`${label} is missing: ${fragment}`); };

function checkDelimiters(text, label) {
  const stack = [];
  const pairs = { ')': '(', ']': '[' };
  let state = 'code';
  let dollar = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (state === 'line') { if (c === '\n') state = 'code'; continue; }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 1; } continue; }
    if (state === 'single') {
      if (c === "'" && n === "'") { i += 1; continue; }
      if (c === "'") state = 'code';
      continue;
    }
    if (state === 'dollar') {
      if (text.startsWith(dollar, i)) { i += dollar.length - 1; state = 'code'; }
      continue;
    }
    if (c === '-' && n === '-') { state = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { state = 'block'; i += 1; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '$') {
      const match = text.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollar = match[0]; state = 'dollar'; i += dollar.length - 1; continue; }
    }
    if (c === '(' || c === '[') stack.push({ c, i });
    else if (c === ')' || c === ']') {
      const open = stack.pop();
      if (!open || open.c !== pairs[c]) fail(`${label} has mismatched ${c} at byte ${i}`);
    }
  }
  if (state !== 'code' && state !== 'line') fail(`${label} ends inside ${state}`);
  if (stack.length) fail(`${label} has unclosed ${stack.at(-1).c} at byte ${stack.at(-1).i}`);
}

for (const [label, text] of Object.entries(sql)) checkDelimiters(text, label);

requireText(sql.forward, "current_user <> 'postgres' or session_user <> 'postgres'", 'direct postgres installer boundary');
requireText(sql.forward, 'and r.rolbypassrls\n    and r.rolcreaterole', 'managed Supabase role attributes');
requireText(sql.forward, 'managed Supabase postgres may be LOGIN and non-superuser', 'managed Supabase role error');
requireText(sql.forward, "'public.client_health_metric_config'", 'complete foundation ownership inventory');
requireText(sql.forward, "c.relowner <> v_postgres_oid", 'foundation relation owner validation');
requireText(sql.forward, "p.proowner <> v_postgres_oid", 'foundation function owner validation');
requireText(sql.forward, "n.nspname = 'private' and n.nspowner <> v_postgres_oid", 'existing private schema owner validation');
requireText(sql.forward, "pg_catalog.has_schema_privilege('postgres', 'public', 'USAGE')", 'fixed owner public USAGE privilege preflight');
requireText(sql.forward, "pg_catalog.has_schema_privilege('postgres', 'public', 'CREATE')", 'fixed owner public CREATE privilege preflight');
requireText(sql.forward, "pg_catalog.has_database_privilege('postgres', current_database(), 'CREATE')", 'fixed owner database CREATE privilege preflight');
requireText(sql.forward, "has_function_privilege('postgres', 'extensions.digest(bytea,text)', 'EXECUTE')", 'digest capability validation');
if (/rolsuper|non-login-safe|pg_has_role\(current_user,\s*'postgres'/i.test(sql.forward)) {
  fail('forward migration retains an incompatible superuser/non-login/member-owner check');
}
requireText(sql.rollback, "current_user <> 'postgres' or session_user <> 'postgres'", 'rollback direct postgres boundary');
requireText(sql.rollback, "r.rolname = 'postgres' and r.rolbypassrls and r.rolcreaterole", 'rollback managed role attributes');
requireText(sql.rollback, "pg_catalog.has_schema_privilege('postgres', 'public', 'USAGE')", 'rollback public USAGE privilege preflight');
requireText(sql.rollback, "pg_catalog.has_schema_privilege('postgres', 'public', 'CREATE')", 'rollback public CREATE privilege preflight');
requireText(sql.rollback, 'requires postgres-owned trusted objects', 'rollback owner validation');
if (/rolsuper|non-login-safe/i.test(sql.rollback)) fail('rollback retains an incompatible superuser/non-login check');

const runtime = [
  'client_health_get_active_config_revision()',
  'client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)',
  'client_health_get_refresh_run(uuid)',
  'client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint)',
  'client_health_get_refresh_lease(uuid)',
  'client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint)',
  'client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz)',
  'client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)',
  'client_health_get_source_run(uuid,uuid,uuid,bigint)',
  'client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,jsonb,text,text,uuid,uuid,bigint)',
  'client_health_persist_snapshot_bundle(jsonb,uuid,uuid,bigint)',
  'client_health_validate_refresh_run(uuid,timestamptz,text,uuid,uuid,bigint)',
  'client_health_publish_refresh_run(uuid,timestamptz,uuid,uuid,bigint)',
  'client_health_fail_refresh_run(uuid,timestamptz,text,text,uuid,uuid,bigint)',
];
const helpers = [
  'client_health_revision_id(text)',
  'client_health_assert_safe_revision_json(jsonb,text,integer)',
  'client_health_assert_config_revision(uuid,text,jsonb)',
  'client_health_assert_exact_keys(jsonb,text[],text)',
  'client_health_canonical_json(jsonb)',
  'client_health_binary64_json(numeric,text,boolean)',
  'client_health_display_number(numeric)',
  'client_health_calculate_snapshot(uuid,uuid,timestamptz)',
  'client_health_refresh_evidence_hash(uuid)',
  'client_health_assert_owned_lease(uuid,uuid,uuid,bigint)',
  'client_health_assert_run_provenance(uuid)',
  'client_health_assert_refresh_integrity(uuid)',
  'client_health_assert_source_evidence(uuid,text,timestamptz,timestamptz,bigint,text,jsonb,jsonb,text,text)',
  'client_health_assert_task_authorized(jsonb,uuid,uuid,text)',
];
for (const signature of [...runtime, ...helpers]) {
  requireText(sql.forward, `alter function public.${signature} owner to postgres;`, `forward owner for ${signature}`);
  requireText(sql.forward, `revoke all on function public.${signature} from public, anon, authenticated, service_role;`, `forward revoke for ${signature}`);
  requireText(sql.rollback, `revoke all on function public.${signature} from public, anon, authenticated, service_role;`, `rollback revoke for ${signature}`);
  requireText(sql.rollback, `drop function public.${signature};`, `rollback drop for ${signature}`);
}
for (const signature of runtime) requireText(sql.forward, `grant execute on function public.${signature} to service_role;`, `service-role grant for ${signature}`);
for (const signature of helpers) {
  if (sql.forward.includes(`grant execute on function public.${signature}`)) fail(`helper ${signature} is granted`);
}
const privateOperators = [
  'client_health_stage_config_revision(uuid,text,jsonb)',
  'client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)',
];
for (const signature of privateOperators) {
  requireText(sql.forward, `alter function private.${signature} owner to postgres;`, `private operator owner for ${signature}`);
  requireText(sql.forward, `revoke all on function private.${signature} from public, anon, authenticated, service_role;`, `private operator revoke for ${signature}`);
  requireText(sql.rollback, `revoke all on function private.${signature} from public, anon, authenticated, service_role;`, `rollback private operator revoke for ${signature}`);
  requireText(sql.rollback, `drop function private.${signature};`, `rollback private operator drop for ${signature}`);
  if (sql.forward.includes(`grant execute on function private.${signature}`)) fail(`private operator ${signature} is granted to an API role`);
}
requireText(sql.forward, 'create schema if not exists private authorization postgres;', 'private operator schema');
requireText(sql.forward, 'create table private.client_health_config_revisions', 'immutable private revision table');
requireText(sql.forward, 'create table private.client_health_config_revision_activations', 'append-only activation audit');
requireText(sql.forward, 'create table private.client_health_active_config_revision', 'singleton active pointer');
requireText(sql.forward, 'create function private.client_health_stage_config_revision(', 'operator-only stage function');
requireText(sql.forward, 'create function private.client_health_activate_config_revision(', 'operator-only activate function');
requireText(sql.forward, 'add column config_revision_activation_id uuid not null', 'run activation provenance');
requireText(sql.forward, "'schemaVersion','calculationVersion','sourceContractVersion','clients'", 'v2 revision root');
requireText(sql.forward, "array['clientId','clientKey','displayName','dashboardHref','reportingTimezone','clickupListIds','marginAliases','configStatus','fixedValues','metrics','sources']", 'v2 client shape');
requireText(sql.forward, "array['monthlyBudget','monthlyHoursAllotment']", 'v2 fixedValues shape');
requireText(sql.forward, "s->>'provider'='supabase'", 'typed Supabase source');
requireText(sql.forward, "s->>'provider'='google-sheets'", 'typed Google Sheets source');
requireText(sql.forward, "s->>'provider'='clickup'", 'typed ClickUp source');
for (const forbidden of ['metadata', 'sourceConfig', 'approvedAt', 'approvedBy', 'assemblyInput', 'collectors']) {
  if (sql.forward.includes(`'${forbidden}'`)) fail(`v1/unsafe revision field remains accepted: ${forbidden}`);
}
if (sql.forward.includes('client_health_create_config_revision') || sql.forward.includes('client_health_get_config_revision')) fail('runtime arbitrary revision RPC remains installed');
requireText(sql.forward, 'create trigger client_health_config_revisions_immutable', 'immutable revision trigger');
requireText(sql.forward, 'alter function public.client_health_guard_config_revision_immutable() owner to postgres;', 'revision guard owner');
requireText(sql.forward, 'revoke all on function public.client_health_guard_config_revision_immutable() from public, anon, authenticated, service_role;', 'revision guard revoke');
requireText(sql.forward, 'revoke all on schema private from public, anon, authenticated, service_role;', 'private schema revoke');
requireText(sql.forward, 'revoke all on all tables in schema private from public, anon, authenticated, service_role;', 'private table revoke');
if (/grant\s+(?:usage|all).*schema\s+private\s+to\s+(?:service_role|anon|authenticated)/i.test(sql.forward)) fail('private schema is granted to an API role');
if (/grant\s+.*on\s+(?:all\s+tables\s+in\s+schema\s+private|table\s+private\.)/i.test(sql.forward)) fail('private table access is granted');
requireText(sql.forward, 'references private.client_health_config_revisions(id, revision_hash)', 'revision foreign keys');
requireText(sql.forward, "join private.client_health_config_revisions cr on cr.id = s.config_revision_id", 'latest immutable revision join');
requireText(sql.forward, "'refreshIdentityHash', v_expected_identity_hash", 'database-derived refresh receipt');
requireText(sql.forward, "'calculationVersion', v_calculation_version", 'database-derived calculation version receipt');
requireText(sql.forward, 'client health refresh revision is not the currently active activation', 'active revision requirement');
requireText(sql.forward, 'client health refresh identity hash does not match database derivation', 'identity mismatch rejection');
requireText(sql.forward, 'client health refresh run ID does not match database derivation', 'run UUID mismatch rejection');
const latest = sql.forward.match(/create or replace view public\.client_health_latest[\s\S]*?;\nrevoke all on table public\.client_health_latest/i)?.[0];
if (!latest) fail('forward safe latest view is missing');
if (/join public\.client_health_clients/i.test(latest)) fail('latest view joins mutable client authoring rows');
for (const column of ['revision_client_id','revision_client_key','revision_display_name','revision_dashboard_href','revision_config_status','revision_reporting_timezone','revision_monthly_hours_allotment','revision_clickup_list_ids','revision_margin_aliases','revision_metric_config']) {
  requireText(latest, `as ${column}`, `safe latest projection ${column}`);
}
for (const raw of ['cr.revision as config_revision', 'revision_client.value as config_revision_client', 'persistence_evidence_hash', 'persistence_idempotency_key']) {
  if (latest.includes(raw)) fail(`latest view exposes raw/private field: ${raw}`);
}
requireText(sql.rollback, 'Preserve every private revision/activation/pointer row and all additive FKs,', 'rollback revision preservation');
requireText(sql.rollback, 'alter column config_revision_id drop not null', 'rollback revision compatibility');
requireText(sql.rollback, 'alter column config_revision_activation_id drop not null', 'rollback activation compatibility');
requireText(sql.rollback, 'private.client_health_config_revisions', 'rollback private revision preservation');
requireText(sql.rollback, 'private.client_health_config_revision_activations', 'rollback activation preservation');
requireText(sql.rollback, 'private.client_health_active_config_revision', 'rollback active pointer preservation');
requireText(sql.rollback, 'exact complete v2 operator-activation installation', 'rollback exact-v2 preflight');
requireText(sql.rollback, 'create view public.client_health_latest\nwith (security_invoker = true)', 'rollback exact foundation latest view');
if (sql.rollback.includes('drop function public.client_health_guard_config_revision_immutable()') || sql.rollback.includes('drop function private.client_health_guard_activation_immutable()')) fail('rollback drops an immutable audit guard');
if (/grant\s+.*(?:schema\s+private|table\s+private\.|function\s+private\.)/i.test(sql.rollback)) fail('rollback grants private access');

for (const table of ['client_health_refresh_runs', 'client_health_source_runs', 'client_health_snapshots', 'client_health_snapshot_tasks']) {
  requireText(sql.forward, `revoke insert, update, delete on table public.${table} from service_role;`, `forward direct-DML revoke for ${table}`);
  requireText(sql.rollback, `grant insert, update, delete on table public.${table} to service_role;`, `rollback CRUD restore for ${table}`);
}
for (const forbidden of ['drop table', 'drop column', 'drop constraint', 'drop index', 'truncate ']) {
  if (sql.rollback.toLowerCase().includes(forbidden)) fail(`rollback contains lossy operation: ${forbidden}`);
}
if (/requires empty|exists\s*\(\s*select 1 from public\.client_health_(?:refresh_runs|source_runs|snapshots|snapshot_tasks)\s*\)\s*then\s*raise/is.test(sql.rollback)) {
  fail('rollback requires empty lifecycle/evidence tables');
}

const forwardClaims = [
  "where refresh_identity_hash = p_refresh_identity_hash and run_status in ('collecting', 'validated')",
  'and v_active.lease_expires_at > v_now',
  "raise exception 'client health snapshot persistence requires a collecting refresh'",
  "raise exception 'client health source creation requires a collecting refresh'",
  "raise exception 'client health source completion requires a collecting refresh'",
  'client health refresh snapshots must exactly cover revision clients',
  'client health refresh source runs must exactly cover revision sources',
  "'evidenceHash',v_item.persistence_evidence_hash",
  "(m->>'weight')::numeric<=0",
  "m->>'direction'='lower_is_better'",
  'only the database-derived calculation and return its authoritative receipt',
  'bundle tasks contain a duplicate clickupTaskId',
  "run_status = 'published', published_at = p_published_at, finished_at = p_published_at,",
  'terminal transition already cleared ownership atomically; retries are safe no-ops',
  "pg_catalog.pg_advisory_xact_lock(\n    (('x' || pg_catalog.substr(p_refresh_identity_hash, 1, 8))::bit(32)::int)",
  'client_health_refresh_runs_active_identity_unique',
  "error_code = 'refresh_attempt_superseded'",
];
for (const claim of forwardClaims) requireText(sql.forward, claim, 'forward invariant');
requireText(sql.rollback, 'alter column persistence_evidence_hash drop not null', 'rollback legacy-writer compatibility');
requireText(sql.rollback, 'Residual inert atomic-refresh metadata', 'rollback residual metadata explanation');
requireText(sql.verify, 'begin;', 'verification transaction');
requireText(sql.verify, 'rollback;', 'verification rollback');
for (const proof of [
  'empty active pointer returned content', 'runtime accepted a refresh without an active revision',
  'invalid configuration revision was staged', 'activation compare-and-set mismatch was accepted',
  'active getter is not exact', 'malformed refresh identity case accepted',
  'refresh receipt versions/identity were not revision-derived', 'run did not pin activation provenance',
  'first lease grant is invalid', 'second claim attempt also won', 'stale fence renewal was accepted',
  'validated refresh accepted source mutation', 'bad-task bundle was not atomically rolled back',
  'duplicate task IDs were accepted', 'exact snapshot retry changed receipt',
  'published snapshot is not exact safe latest-visible revision', 'later activation contaminated existing run provenance',
  'expired lease is visible', 'stale supersession/audit behavior is invalid',
  'active lease did not block fresh attempt', 'validated stale attempt was resumed',
  'service_role private/operator ACL mismatch', 'service_role staged a private revision',
  'service_role activated a private revision', 'service_role directly read private.',
  'service_role getter did not return exact active revision', 'runtime RPC ACL mismatch',
  'direct lifecycle/evidence DML granted',
  'caller-forged calculation influenced authoritative persistence',
  'caller-forged aggregate evidence hash was accepted',
  'SQL calculator diverged from fixed engine.ts parity vector',
  'SQL decimal-tie reason formatting diverged from engine.ts',
  'unauthorized ClickUp list task was accepted atomically',
  'permitsTasks=false ClickUp revision candidate authorized tasks',
  'nonsucceeded ClickUp task source authorized tasks',
  'pre-validation committed source evidence corruption escaped integrity revalidation',
  'pre-validation snapshot source key corruption escaped exact-key integrity validation',
  'published source immutability trigger allowed privileged corruption',
  'malformed evidence type/time/status/error bound was accepted',
  'malformed ClickUp count/duration evidence was accepted',
  'noncanonical task ranks were accepted',
]) requireText(sql.verify, proof, 'verification proof');

for (const marker of [
  'client health snapshot source key set does not exactly match revision sources',
  'client_health_assert_source_evidence(',
  'client_health_assert_task_authorized(',
  'Google Sheets evidence intentionally has no retrievedAt key',
  'ClickUp evidence counts must both be JSON numbers or both be null',
  'source error message is malformed or oversized',
  'source finishedAt must be finite and no earlier than startedAt',
]) requireText(sql.forward, marker, 'Task3A reconciliation/task/evidence invariant');

console.log('client-health atomic SQL static check passed (syntax-shape/ACL/invariant assertions only; not PostgreSQL runtime execution)');
