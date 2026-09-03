import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const paths = {
  forward: resolve(root, 'supabase/client_health_normalized_source_views.sql'),
  verify: resolve(root, 'supabase/client_health_normalized_source_views_verify.sql'),
  rollback: resolve(root, 'supabase/client_health_normalized_source_views_rollback.sql'),
  classifier: resolve(root, 'src/lib/goodgame-campaign-scope.ts'),
};
const text = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const fail = (message) => { throw new Error(`client-health normalized source SQL static check failed: ${message}`); };
const requireText = (body, fragment, label) => { if (!body.includes(fragment)) fail(`${label} is missing: ${fragment}`); };

function checkDelimiters(body, label) {
  const stack = [];
  const pairs = { ')': '(', ']': '[' };
  let state = 'code';
  let dollar = '';
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    const n = body[i + 1];
    if (state === 'line') { if (c === '\n') state = 'code'; continue; }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 1; } continue; }
    if (state === 'single') { if (c === "'" && n === "'") { i += 1; continue; } if (c === "'") state = 'code'; continue; }
    if (state === 'dollar') { if (body.startsWith(dollar, i)) { i += dollar.length - 1; state = 'code'; } continue; }
    if (c === '-' && n === '-') { state = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { state = 'block'; i += 1; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '$') {
      const match = body.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
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

for (const [label, body] of Object.entries(text).filter(([label]) => label !== 'classifier')) checkDelimiters(body, label);

const contracts = [
  ['client_health_bloom_daily', 'bloom_meta_ads'],
  ['client_health_nsi_daily', 'nsi_master_campaign_daily'],
  ['client_health_durodyne_daily', 'durodyne_master'],
  ['client_health_kinsey_daily', 'kinsey_master'],
  ['client_health_arabella_daily', 'arabella_master'],
  ['client_health_champagne_daily', 'champagne_google'],
  ['client_health_goodgame_ecommerce_daily', 'goodgame_master'],
];

requireText(text.forward, "current_user <> 'postgres' or session_user <> 'postgres'", 'forward direct-postgres boundary');
requireText(text.forward, "to_regclass('public.master_spartaco')", 'forward EIC project sentinel');
requireText(text.forward, "not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole", 'forward managed postgres attributes');
requireText(text.forward, "date >= date '2026-01-01'", 'NSI effective boundary');
requireText(text.forward, 'union all', 'Champagne union');
requireText(text.forward, 'from public.champagne_meta', 'Champagne Meta source');
requireText(text.forward, "('goodgame_master', 'campaign_name', 'string')", 'Good Game campaign-name type preflight');
requireText(text.forward, "extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256')", 'exact SHA-256 definition guard');
requireText(text.forward, 'v_existing_count not in (0, 7)', 'all-or-none idempotency guard');
requireText(text.forward, 'lock table public.bloom_meta_ads in share mode;', 'source validation lock');
requireText(text.forward, 'lock table public.goodgame_master in share mode;', 'source validation lock coverage');
if (/create\s+(?:or\s+replace\s+)?view\s+public\.client_health_state48/i.test(text.forward) || text.forward.includes('state48_master')) {
  fail('migration attempts to replace the existing State48 Google source');
}

for (const [view, source] of contracts) {
  requireText(text.forward, `create or replace view public.${view} with (security_invoker = false, security_barrier = true)`, `${view} idempotent barrier view`);
  requireText(text.forward, `from public.${source}`, `${view} source`);
  requireText(text.forward, `alter view public.${view} owner to postgres;`, `${view} owner`);
  requireText(text.forward, `revoke all on table public.${view} from public, anon, authenticated, service_role;`, `${view} ACL revoke`);
  requireText(text.forward, `grant select on table public.${view} to service_role;`, `${view} service-role ACL`);
  requireText(text.forward, `comment on view public.${view}`, `${view} comment`);
  requireText(text.forward, `comment on column public.${view}.row_key`, `${view} row-key comment`);
  requireText(text.verify, `public.${view}`, `${view} verification`);
  requireText(text.rollback, `drop view public.${view};`, `${view} rollback`);
  requireText(text.rollback, `\"public.${view}\"`, `${view} active-reference rollback guard`);
}

for (const forbiddenRole of ['public', 'anon', 'authenticated']) {
  if (new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.client_health_[^;]+\\s+to\\s+${forbiddenRole}`, 'i').test(text.forward)) {
    fail(`normalized view SELECT is granted to ${forbiddenRole}`);
  }
}
requireText(text.verify, "array['row_key','date','spend','results']", 'exact output columns');
requireText(text.verify, "array['text','date','numeric','numeric']", 'exact output types');
requireText(text.verify, 'count(distinct row_key)', 'row_key uniqueness');
requireText(text.verify, 'normalized-scope parity totals differ', 'normalized parity assertions');
requireText(text.verify, "date < date '2026-01-01'", 'NSI in-window assertion');
requireText(text.verify, "spend < 0 or results < 0", 'in-window nonnegative assertion');
requireText(text.verify, "lower(spend::text) in ('nan','infinity','-infinity','inf','-inf')", 'finite assertion');
requireText(text.rollback, 'from private.client_health_active_config_revision active', 'active config rollback guard');
requireText(text.rollback, 'join private.client_health_config_revision_activations activation', 'active activation rollback guard');
requireText(text.rollback, 'join private.client_health_config_revisions revision_row', 'active revision rollback guard');
requireText(text.rollback, "lock table private.client_health_active_config_revision in share mode", 'activation/drop race lock');
requireText(text.rollback, "extensions.digest(pg_catalog.pg_get_viewdef(c.oid, true), 'sha256')", 'exact definition rollback guard');

const tsPattern = text.classifier.match(/const ECOMMERCE_NAME_PATTERN = (\/.*\/[a-z]*);/)?.[1];
if (tsPattern !== '/(?:sales|e-?commerce)/i') fail(`unexpected TypeScript eCommerce pattern: ${tsPattern ?? 'missing'}`);
requireText(text.forward, "btrim(campaign_name) ~* '(sales|e-?commerce)'", 'SQL eCommerce regex parity');
requireText(text.verify, "btrim(campaign_name) ~* '(sales|e-?commerce)'", 'verification eCommerce regex parity');

const tsExceptionBlock = text.classifier.match(/const ECOMMERCE_CAMPAIGN_EXCEPTIONS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
if (!tsExceptionBlock) fail('TypeScript exception set is missing');
const tsExceptions = [...tsExceptionBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
const sqlView = text.forward.match(/create or replace view public\.client_health_goodgame_ecommerce_daily[\s\S]*?group by date;/i)?.[0];
if (!sqlView) fail('Good Game normalized view body is missing');
const sqlExceptionBlock = sqlView.match(/btrim\(campaign_name\) in \(([\s\S]*?)\n\s*\)\s*\ngroup by date;/i)?.[1];
if (!sqlExceptionBlock) fail('Good Game SQL exception list is missing');
const sqlExceptions = [...sqlExceptionBlock.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replaceAll("''", "'"));
if (tsExceptions.length !== 4) fail(`TypeScript classifier must retain exactly four exceptions, found ${tsExceptions.length}`);
if (sqlExceptions.length !== 4 || JSON.stringify(sqlExceptions) !== JSON.stringify(tsExceptions)) {
  fail(`Good Game SQL exceptions diverge from TypeScript classifier: SQL=${JSON.stringify(sqlExceptions)} TS=${JSON.stringify(tsExceptions)}`);
}
for (const exception of tsExceptions) {
  const verifyOccurrences = text.verify.split(`'${exception.replaceAll("'", "''")}'`).length - 1;
  if (verifyOccurrences < 2) fail(`verification parity query omits Good Game exception: ${exception}`);
}

console.log('client-health normalized source SQL static check passed (syntax-shape/source/ACL/security/GoodGame parity assertions only; no database execution)');
