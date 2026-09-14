import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const cjsModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module: cjsModule, exports: cjsModule.exports, require: () => load('../src/services/prepass-platform-normalization.ts'), Date, Set, Map,
  });
  return cjsModule.exports;
}
const helper = load('../src/services/prepass-campaign-performance.ts');
assert.equal(typeof helper.addQualifiedCampaignMetrics, 'function', 'Qualified campaign aggregation must exist');
const row = (campaign_name, platform = 'Google', spend = 120) => ({ campaign_name, platform, spend, impressions: 0, clicks: 0, platform_conversions: 0, mqls: 99, sqls: 0, closed_won: 0 });
const sub = (id_marketo, utm_campaign, fleet_size = '101-500', activity_date = '2026-09-02T00:00:00Z', marketo_guid = 'a') => ({ id_marketo, utm_campaign, fleet_size, activity_date, marketo_guid });
const current = [row('ABM Test'), row('Collision', 'Meta'), row('Collision', 'Google')];
const previous = [row('Old Only', 'Meta', 80)];
const cohort = { submissions: [sub('1', 'abm-test'), sub('1', 'abm-test'), sub('2', 'Collision'), sub('3', 'unknown'), sub('4', 'ABM Test'), sub('4', 'ABM Test', '51-100', '2026-09-03T00:00:00Z'), sub('5', 'ABM Test', '500+'), sub('6', 'ABM Test', '>100')], mqls: ['1', '1', '2', '3', '4', '5'], sqls: ['5'], won: [] };
const prevCohort = { submissions: [sub('9', 'old-only')], mqls: ['9'], sqls: [], won: ['9'] };
const build = (channel = null) => helper.addQualifiedCampaignMetrics(helper.buildCampaignPerformance(current.filter(r => !channel || r.platform === channel), previous.filter(r => !channel || r.platform === channel), 'ABM'), current, previous, cohort, prevCohort, channel);
const result = build();
const main = result.find(r => r.name === 'ABM Test · Google');
assert.equal(main.qualified.mqls, 2, 'Latest submission first, canonical bands only, unique membership');
assert.equal(main.qualified.sqls, 1);
assert.equal(main.qualified.won, 0);
assert.equal(main.mqls, 99, 'Standard MMP untouched');
assert.equal(result.find(r => r.name === 'Old Only · Meta').prevQualified.won, 1);
assert.equal(result.find(r => r.name === 'Unattributed +100 Trucks').qualified.mqls, 2);
assert.equal(result.reduce((n,r) => n + r.qualified.mqls, 0), 4);
assert.equal(build('Google').find(r => r.name === 'Collision · Google').qualified.mqls, 0, 'Filter must not resolve ambiguous identity');
assert.ok(!build('Google').some(r => r.name === 'Unattributed +100 Trucks'));
assert.equal(helper.latestQualifiedSubmissions([sub('tie', 'ABM Test'), sub('tie', 'ABM Test', '51-100', '2026-09-02T00:00:00Z', 'z')]).length, 0, 'GUID descending breaks same-timestamp ties before qualification');
const normalizedCollision = [row('ABM-Test'), row('ABM Test')];
const collisionResult = helper.addQualifiedCampaignMetrics(helper.buildCampaignPerformance(normalizedCollision, [], 'ABM'), normalizedCollision, [], { submissions: [sub('1', 'abm_test')], mqls: ['1'], sqls: [], won: [] }, { submissions: [], mqls: [], sqls: [], won: [] }, null);
assert.equal(collisionResult.find(r => r.name === 'Unattributed +100 Trucks').qualified.mqls, 1, 'Different identities normalizing to same name cannot be arbitrarily chosen');
console.log('PASS: real qualified cohorts, latest dedup, canonical qualification, lifetime membership, comparison, ambiguity and filter reconciliation');
if (process.env.PREPASS_QUALIFIED_LIVE_JSON) {
  const live = JSON.parse(readFileSync(process.env.PREPASS_QUALIFIED_LIVE_JSON, 'utf8'));
  const rows = helper.addQualifiedCampaignMetrics(helper.buildCampaignPerformance(live.current.campaigns, live.previous.campaigns, 'ABM'), live.current.campaigns, live.previous.campaigns, live.current.cohort, live.previous.cohort, null);
  for (const [period, field] of [['current', 'qualified'], ['previous', 'prevQualified']]) {
    const totals = Object.fromEntries(['leads', 'mqls', 'sqls', 'won'].map(stage => [stage, rows.reduce((n, r) => n + r[field][stage], 0)]));
    console.log('LIVE', period, JSON.stringify({ totals, rpc: live[period].rpc, attributed: rows.filter(r => r[field].leads).map(r => ({ name: r.name, ...r[field], costPerMql: r.qualifiedUnattributed || !r[field].mqls ? null : (period === 'current' ? r.spend : r.prevSpend) / r[field].mqls })) }));
    for (const stage of ['leads', 'mqls', 'sqls', 'won']) assert.equal(totals[stage], live[period].rpc.reduce((n, r) => n + Number(r[stage]), 0), `${period} ${stage} reconcile to fleet RPC`);
  }
}
export { load };
