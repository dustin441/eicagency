import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const paths = {
  forward: resolve(root, 'supabase/prepass_client_health_source_views.sql'),
  verify: resolve(root, 'supabase/prepass_client_health_source_views_verify.sql'),
  rollback: resolve(root, 'supabase/prepass_client_health_source_views_rollback.sql'),
};
const sql = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const fail = (message) => { throw new Error(`PrePass Client Health source-view static check failed: ${message}`); };
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
for (const [label, text] of Object.entries(sql)) {
  requireText(text, 'begin;', `${label} transaction`);
  if (label === 'verify') requireText(text, 'rollback;', 'read-only verification rollback');
  else requireText(text, 'commit;', `${label} commit`);
}

for (const text of [sql.forward, sql.verify, sql.rollback]) {
  requireText(text, "current_user <> 'postgres' or session_user <> 'postgres'", 'direct postgres boundary');
  requireText(text, "not r.rolsuper", 'managed postgres non-superuser identity');
  requireText(text, 'r.rolcanlogin', 'managed postgres login identity');
  requireText(text, 'r.rolbypassrls', 'managed postgres BYPASSRLS identity');
  requireText(text, 'r.rolcreaterole', 'managed postgres CREATEROLE identity');
  requireText(text, "public.master_marketing_performance", 'PrePass source identity');
  requireText(text, "a.attname = 'daily_budget'", 'PrePass budget sentinel');
  requireText(text, "a.attname in ('period_start', 'period_end')", 'EIC-project exclusion');
}

requireText(sql.forward, "c.relkind = 'm'", 'materialized-view source kind');
requireText(sql.forward, 'c.relowner = v_postgres_oid', 'source ownership');
requireText(sql.forward, "extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256')", 'exact SHA-256 definition guard');
requireText(sql.forward, 'v_existing_count not in (0, 2)', 'all-or-none idempotency guard');
requireText(sql.forward, 'i.indisunique and i.indisvalid', 'MMP concurrent-refresh refusal');
requireText(sql.forward, 'perform 1 from public.master_marketing_performance limit 0;', 'MMP ACCESS SHARE validation lock');
requireText(sql.forward, 'lock table public.linkedin_campaign_data in share mode;', 'LinkedIn validation lock');
requireText(sql.forward, "v_linkedin_oid := pg_catalog.to_regclass('public.linkedin_campaign_data')", 'LinkedIn source identity');
for (const column of ['date', 'focus', 'spend', 'sqls', 'closed_won']) {
  requireText(sql.forward, `('${column}',`, `source pg_attribute type for ${column}`);
}
requireText(sql.forward, "source.date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'", 'canonical non-null date validation');
requireText(sql.forward, "pg_catalog.to_char(source.date::date, 'YYYY-MM-DD') <> source.date", 'calendar date round-trip validation');
for (const measure of ['spend', 'sqls', 'closed_won']) {
  requireText(sql.forward, `pg_catalog.lower(source.${measure}::text) in ('nan', 'infinity', '-infinity', 'inf', '-inf')`, `${measure} finite validation`);
  requireText(sql.forward, `source.${measure}::numeric < 0`, `${measure} nonnegative validation`);
}

for (const view of ['client_health_prepass_sql_daily', 'client_health_prepass_won_daily']) {
  requireText(sql.forward, `create or replace view public.${view}\nwith (security_invoker = false, security_barrier = true)`, `${view} idempotent security barrier`);
  requireText(sql.forward, `alter view public.${view} owner to postgres;`, `${view} owner`);
  requireText(sql.forward, `revoke all on table public.${view} from public, anon, authenticated, service_role;`, `${view} full revoke`);
  requireText(sql.forward, `grant select on table public.${view} to service_role;`, `${view} service-role SELECT`);
  requireText(sql.verify, `public.${view}`, `${view} verification`);
  requireText(sql.rollback, `drop view public.${view};`, `${view} rollback`);
}

const focusClause = "focus in ('SMB', 'ABM', 'FD360')";
if (sql.forward.split(focusClause).length - 1 < 5) fail('forward does not consistently scope preflight and both views to SMB/ABM/FD360');
requireText(sql.forward, 'source.date is not null', 'historical null-date exclusion');
requireText(sql.forward, 'sqls::numeric, 0::numeric', 'SQL result aggregation');
requireText(sql.forward, 'closed_won::numeric, 0::numeric', 'Won result aggregation');
requireText(sql.forward, 'from public.linkedin_campaign_data', 'all-channel LinkedIn spend union');
if (sql.forward.split('from public.linkedin_campaign_data').length - 1 < 3) fail('forward does not validate and union LinkedIn into both views');
if (sql.verify.split('from public.linkedin_campaign_data').length - 1 < 4) fail('verification does not prove LinkedIn parity in both directions for both views');
if (/monthSpend|month_spend/.test(sql.forward.replaceAll('monthSpend ownership', ''))) fail('forward SQL computes a monthSpend scalar; ownership belongs in the later adapter');

for (const marker of [
  "array['row_key', 'date', 'spend', 'results']",
  "array['text', 'date', 'numeric', 'numeric']",
  "pg_catalog.count(distinct row_key)",
  "pg_catalog.count(distinct date)",
  'except all',
  "pg_catalog.has_table_privilege('service_role'",
  "pg_catalog.has_table_privilege('public'",
  "pg_catalog.has_table_privilege('anon'",
  "pg_catalog.has_table_privilege('authenticated'",
  'pg_catalog.aclexplode',
]) requireText(sql.verify, marker, 'verification invariant');

requireText(sql.rollback, "private.client_health_active_config_revision", 'active config pointer guard');
requireText(sql.rollback, "private.client_health_config_revision_activations", 'active config activation guard');
requireText(sql.rollback, "private.client_health_config_revisions", 'active config revision guard');
requireText(sql.rollback, 'revision.revision @?', 'active relation-reference scan');
requireText(sql.rollback, 'active configuration references a view', 'referenced rollback refusal');
requireText(sql.rollback, 'v_config_objects <> 3', 'cross-project unavailable-state refusal');
requireText(sql.rollback, 'authoritative cross-project active-config state cannot be proven safe locally', 'cross-project fail-closed reason');
requireText(sql.rollback, "lock table private.client_health_active_config_revision in share mode", 'activation/drop race lock');
requireText(sql.rollback, "extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256')", 'exact definition rollback guard');

console.log('PrePass Client Health source-view static check passed (syntax-shape/identity/type/date/value/parity/ACL/rollback assertions only; database SQL was not executed)');
