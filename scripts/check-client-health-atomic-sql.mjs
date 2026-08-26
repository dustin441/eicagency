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

const runtime = [
  'client_health_create_config_revision(uuid,text,jsonb)',
  'client_health_get_config_revision(uuid)',
  'client_health_create_refresh_run(uuid,uuid,text,text,uuid,date,text,text,timestamptz)',
  'client_health_get_refresh_run(uuid)',
  'client_health_acquire_refresh_lease(uuid,uuid,uuid,bigint)',
  'client_health_get_refresh_lease(uuid)',
  'client_health_renew_refresh_lease(uuid,uuid,uuid,bigint,bigint)',
  'client_health_release_refresh_lease(uuid,uuid,uuid,bigint,timestamptz,timestamptz)',
  'client_health_create_source_run(uuid,uuid,uuid,text,date,date,timestamptz,uuid,uuid,bigint)',
  'client_health_get_source_run(uuid,uuid,uuid,bigint)',
  'client_health_complete_source_run(uuid,uuid,text,timestamptz,date,bigint,text,jsonb,text,text,uuid,uuid,bigint)',
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
  'client_health_assert_owned_lease(uuid,uuid,uuid,bigint)',
  'client_health_assert_refresh_integrity(uuid)',
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
requireText(sql.forward, 'create table public.client_health_config_revisions', 'immutable revision table');
requireText(sql.forward, 'create trigger client_health_config_revisions_immutable', 'immutable revision trigger');
requireText(sql.forward, 'alter function public.client_health_guard_config_revision_immutable() owner to postgres;', 'revision guard owner');
requireText(sql.forward, 'revoke all on function public.client_health_guard_config_revision_immutable() from public, anon, authenticated, service_role;', 'revision guard revoke');
requireText(sql.forward, 'revoke all on table public.client_health_config_revisions from public, anon, authenticated, service_role;', 'revision table revoke');
requireText(sql.forward, 'references public.client_health_config_revisions(id, revision_hash)', 'revision foreign keys');
requireText(sql.forward, "join public.client_health_config_revisions cr on cr.id = s.config_revision_id", 'latest immutable revision join');
if (/create view public\.client_health_latest[\s\S]*join public\.client_health_clients/i.test(sql.forward)) fail('latest view joins mutable client authoring rows');
requireText(sql.rollback, 'The immutable revision table and additive provenance columns remain preserved separately.', 'rollback revision preservation');
requireText(sql.rollback, 'alter column config_revision_id drop not null', 'rollback revision compatibility');

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
  "and r.run_status in ('collecting', 'validated')",
  'and r.lease_expires_at > pg_catalog.clock_timestamp()',
  "raise exception 'client health snapshot persistence requires a collecting refresh'",
  "raise exception 'client health source creation requires a collecting refresh'",
  "raise exception 'client health source completion requires a collecting refresh'",
  'client health refresh snapshots must exactly cover revision clients',
  'client health refresh source runs must exactly cover revision collectors',
  "'evidenceHash', p_bundle->'evidenceHash'",
  "bundle idempotencyKey does not match canonical snapshot/task content",
  'bundle tasks contain a duplicate clickupTaskId',
  "run_status = 'published', published_at = p_published_at, finished_at = p_published_at,\n    lease_invocation_id = null",
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
  'second claim attempt also won', 'database grant duration is not exactly 5000ms',
  'stale fence renewal was accepted', 'validated refresh accepted source mutation',
  'bad-task bundle was not atomically rolled back', 'duplicate task IDs were accepted',
  'exact snapshot retry changed its receipt', 'publish did not atomically clear lease ownership',
  'published snapshot is not latest-visible', 'expired lease is visible',
  'expired stale attempt was not fixed-failed and cleared', 'active lease did not block a fresh attempt',
  'validated stale attempt was resumed instead of superseded',
  'superseded evidence was not retained for audit or leaked into latest',
  'direct lifecycle/evidence DML remains granted',
]) requireText(sql.verify, proof, 'verification proof');

console.log('client-health atomic SQL static check passed (syntax-shape/ACL/invariant assertions only; not PostgreSQL runtime execution)');
