import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const attribution = read('prepass_utm_attribution_2026_ytd.sql');
const verify = read('prepass_utm_attribution_2026_ytd_verify.sql');
const rollback = read('prepass_utm_attribution_2026_ytd_rollback.sql');
const fixture = read('prepass_utm_attribution_2026_ytd_test.sql');
const aliases = read('prepass_campaign_name_aliases.sql');
const aliasRollback = read('prepass_campaign_name_aliases_rollback.sql');

assert.match(attribution, /create or replace function public\.prepass_resolve_paid_attribution/);
for (const proof of ['validated-caller', 'gclid', 'fbclid', 'paid-utm', 'email-utm', 'technical-unattributed']) {
  assert.ok(attribution.includes(`'${proof}'`), `resolver must encode ${proof}`);
}
assert.match(attribution, /from prepass_utm_attribution_20261003\.raw_mmp_source;/);
const corrected = attribution.match(/create or replace view prepass_utm_attribution_20261003\.corrected_source as([\s\S]*?);/)?.[1] ?? '';
assert.doesNotMatch(corrected, /prepass_utm_campaign_attribution|\bjoin\b/i, 'aggregate source must not map by campaign name');
assert.doesNotMatch(corrected, /group by|sum\s*\(/i, 'aggregate source must preserve literal rows and totals');
assert.match(attribution, /incremental_corrections as[\s\S]*where false;/, 'unprovable rolling-cache dedup must be disabled');
assert.doesNotMatch(verify, /Unexpected YTD Unattributed|Legacy abm_brand_defense rows remain/);
assert.match(verify, /Campaign name alone resolved paid attribution/);
assert.match(verify, /MMP contains name-only remapped or stale rows/);
assert.match(rollback, /from prepass_utm_attribution_20261003\.raw_mmp_source/);
assert.match(rollback, /drop function if exists public\.prepass_resolve_paid_attribution/);

for (const label of [
  'valid Google paid UTM fixture failed',
  'valid Meta ad identifier fixture failed',
  'valid Email UTM fixture failed',
  'missing evidence must fail closed',
  'platform-mismatched evidence must fail closed',
  'technical code must remain unattributed',
  'lifecycle totals changed without proven duplicate identities',
]) assert.ok(fixture.includes(label), `missing SQL fixture: ${label}`);

assert.match(aliases, /after insert or update on public\.meta_campaigns/);
assert.match(aliases, /after insert or update on public\.google_campaigns/);
assert.match(aliases, /order by date desc, campaign_name desc/, 'trigger path must choose canonical by authoritative source date');
assert.equal((aliases.match(/order by campaign_id::text, date desc, campaign_name desc/g) ?? []).length, 4,
  'bulk sync must use the same recency rule for Meta and Google');
assert.match(aliases, /primary key \(platform, campaign_id, alias_name\)/, 'aliases must remain stable-ID scoped');
assert.match(aliasRollback, /drop function if exists public\.upsert_prepass_campaign_alias/);

console.log('PASS: PrePass attribution SQL fails closed and preserves aggregate lifecycle totals');
console.log('PASS: rename capture covers inserts/updates with date-authoritative stable-ID isolation');
