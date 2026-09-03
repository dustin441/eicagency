import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const paths = {
  forward: resolve(root, 'supabase/prepass_monthly_publications.sql'),
  rollback: resolve(root, 'supabase/prepass_monthly_publications_rollback.sql'),
};
const sql = Object.fromEntries(
  Object.entries(paths).map(([label, path]) => [label, readFileSync(path, 'utf8')]),
);
const fail = (message) => {
  throw new Error(`PrePass monthly-publication SQL static check failed: ${message}`);
};
const requireText = (text, fragment, label) => {
  if (!text.includes(fragment)) fail(`${label} is missing: ${fragment}`);
};

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

for (const [label, text] of Object.entries(sql)) {
  checkDelimiters(text, label);
  requireText(text, 'begin;', `${label} transaction`);
  requireText(text, 'commit;', `${label} transaction`);
  requireText(text, "current_user <> 'postgres' or session_user <> 'postgres'", `${label} direct-postgres boundary`);
  if (/\bcascade\b/i.test(text.replaceAll('No CASCADE', ''))) fail(`${label} contains CASCADE`);
}

const tables = ['prepass_monthly_publications', 'prepass_monthly_publication_active'];
for (const table of tables) {
  requireText(sql.forward, `create table public.${table}`, `${table} creation`);
  requireText(sql.forward, `alter table public.${table} enable row level security;`, `${table} RLS`);
  requireText(sql.forward, `revoke all on table public.${table} from public, anon, authenticated, service_role;`, `${table} default-deny ACL`);
  requireText(sql.forward, `grant select on table public.${table} to service_role;`, `${table} service-role read`);
  requireText(sql.rollback, `drop table public.${table};`, `${table} rollback`);
}

for (const invariant of [
  "report_month = pg_catalog.date_trunc('month', report_month)::date",
  'source_period_start = report_month',
  "source_period_end = (report_month + interval '1 month - 1 day')::date",
  "source_hash ~ '^[0-9a-f]{64}$'",
  "payload_hash ~ '^[0-9a-f]{64}$'",
  "pg_catalog.jsonb_typeof(payload) = 'object'",
  'unique (report_month, revision)',
  'unique (report_month, source_hash, payload_hash)',
  'foreign key (report_month, publication_id)',
]) requireText(sql.forward, invariant, 'forward invariant');

requireText(sql.forward, 'create trigger prepass_monthly_publications_immutable', 'immutable publication trigger');
requireText(sql.forward, "raise exception 'PrePass monthly publications are immutable'", 'immutable publication guard');
requireText(sql.forward, 'create function public.prepass_publish_monthly_publication(', 'atomic publish RPC');
requireText(sql.forward, 'security definer', 'publish SECURITY DEFINER boundary');
requireText(sql.forward, 'pg_catalog.pg_advisory_xact_lock', 'per-month transaction lock');
requireText(sql.forward, 'select p.id, p.revision', 'identical publication lookup');
requireText(sql.forward, "v_idempotent := true", 'idempotent retry result');
requireText(sql.forward, "correction reason is required after revision 1", 'correction provenance guard');
requireText(sql.forward, 'on conflict (report_month) do update', 'atomic active-pointer switch');
requireText(sql.forward, 'current_publication.revision < v_revision', 'monotonic active-pointer guard');
requireText(sql.forward, 'create view public.prepass_monthly_publications_active', 'active publication read view');

const signature = 'prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text)';
requireText(sql.forward, `revoke all on function public.${signature} from public, anon, authenticated, service_role;`, 'publish RPC revoke');
requireText(sql.forward, `grant execute on function public.${signature} to service_role;`, 'publish RPC service-role grant');
requireText(sql.rollback, `revoke all on function public.${signature} from public, anon, authenticated, service_role;`, 'rollback RPC revoke');
requireText(sql.rollback, `drop function public.${signature};`, 'rollback RPC drop');

for (const role of ['public', 'anon', 'authenticated']) {
  if (new RegExp(`grant\\s+.*\\bto\\s+${role}\\b`, 'i').test(sql.forward)) {
    fail(`forward grants a monthly-publication object to ${role}`);
  }
}
if (/grant\s+(?:insert|update|delete|all)\s+on\s+table\s+public\.prepass_monthly_publication/i.test(sql.forward)) {
  fail('forward grants direct publication DML');
}

requireText(sql.rollback, 'rollback refuses to delete published monthly history', 'nonempty-publication rollback guard');
requireText(sql.rollback, 'rollback requires the exact complete PrePass monthly publication installation', 'exact-install rollback guard');
requireText(sql.rollback, 'if exists (select 1 from public.prepass_monthly_publications)', 'publication-row rollback refusal');
requireText(sql.rollback, 'if exists (select 1 from public.prepass_monthly_publication_active)', 'pointer-row rollback refusal');

console.log('PrePass monthly-publication SQL static check passed (syntax-shape/month/hash/immutability/idempotency/ACL/rollback assertions only; database SQL was not executed)');
