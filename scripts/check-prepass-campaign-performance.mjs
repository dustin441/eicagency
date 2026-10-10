import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
let chartData;

function load(relative, extra = '') {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8') + extra;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(js, { module: cjsModule, exports: cjsModule.exports, require: (id) => {
    if (id === '@/lib/utils') return { cn: (...args) => args.filter(x => typeof x === 'string').join(' ') };
    if (id === '@/lib/prepass-ata-scope') return load('../src/lib/prepass-ata-scope.ts');
    if (id === './prepass-platform-normalization') return load('../src/services/prepass-platform-normalization.ts');
    if (id === 'recharts') return new Proxy({}, { get: (_, name) => (props) => {
      if (name === 'ComposedChart') chartData = props.data;
      return name === 'ResponsiveContainer' ? props.children : null;
    } });
    return require(id);
  }, console });
  return cjsModule.exports;
}
const trend = load('../src/components/TrendChart.tsx', '\nexport { bucketData };');
const sample = [{ date: '2026-09-01', spend: 100, sqls: 2, mql: 3, clicks: 10, impressions: 100, platformConversions: 4 }];
const chart = (focus) => renderToStaticMarkup(React.createElement(trend.default, { dailyData: sample, dateRange: 'test', prepassFocus: focus }));
for (const focus of ['SMB', 'ABM', 'FD360']) assert.match(chart(focus), /Cost\/SQL/, `${focus} must expose Cost/SQL`);
for (const focus of [undefined, 'other']) assert.doesNotMatch(chart(focus), /Cost\/SQL/, 'Other dashboards must remain unchanged');
console.log('PASS: Cost/SQL selector is scoped to PrePass focus pages');
chart('SMB');
assert.equal(chartData[0].costPerSql, 50);
const days = Array.from({ length: 30 }, (_, i) => ({ ...sample[0], date: `2026-09-${String(i + 1).padStart(2, '0')}`, spend: i === 0 ? 100 : 10, sqls: i === 0 ? 2 : 1 }));
renderToStaticMarkup(React.createElement(trend.default, { dailyData: days, dateRange: 'test', prepassFocus: 'ABM' }));
assert.equal(chartData[0].costPerSql, 150 / 7, 'Ratio must use sums after weekly bucketing, not mean daily costs');
renderToStaticMarkup(React.createElement(trend.default, { dailyData: [{ ...sample[0], sqls: 0 }], dateRange: 'test', prepassFocus: 'FD360' }));
assert.equal(chartData[0].costPerSql, null, 'No SQLs is unavailable, not a free SQL');
const focusSource = readFileSync(new URL('../src/components/FocusDashboardClient.tsx', import.meta.url), 'utf8');
assert.match(focusSource, /<TrendChart[^>]*prepassFocus=\{d.focus\}/);
console.log('PASS: Cost/SQL bucket calculations and focus wiring');
const {
  addQualifiedCampaignMetrics,
  applySmbCertifiedLifecycle,
  buildCampaignAliasMap,
  buildCampaignPerformance,
  buildSmbCampaignPerformance,
  replaceAbmCampaignFunnelMetrics,
} = load('../src/services/prepass-campaign-performance.ts');
assert.equal(typeof buildCampaignPerformance, 'function');
assert.equal(typeof buildCampaignAliasMap, 'function');
assert.equal(typeof addQualifiedCampaignMetrics, 'function');
assert.equal(typeof applySmbCertifiedLifecycle, 'function');
assert.equal(typeof replaceAbmCampaignFunnelMetrics, 'function');
assert.equal(typeof buildSmbCampaignPerformance, 'function');
const row = (name, platform, spend, mqls = 0) => ({ campaign_name: name, platform, spend, mqls, sqls: 2, closed_won: 1, impressions: 100, clicks: 10, platform_conversions: 5 });
const campaigns = buildCampaignPerformance([
  row('Same', 'Meta', 100, 2), row('Same', 'fb', 50, 3), row('Same', 'Google', 200, 4),
  row('Name || separator', 'Google', 5), row('', 'Google', 0), row('tempRegistrationCode', 'Google', 25),
], [row('Same', 'ig', 75, 1), row('Previous only', 'Google', 60, 9)], 'ABM');
assert.equal(campaigns.length, 4, 'Only real campaigns are included and comparison-only campaigns are preserved');
const meta = campaigns.find(r => r.name === 'Same · Meta');
assert.equal(meta.spend, 150);
assert.equal(meta.mqls, 5);
assert.equal(meta.prevSpend, 75);
assert.equal(meta.prevMqls, 1);
assert.equal(meta.sqls, 4);
assert.equal(meta.won, 2);
assert.equal(campaigns.find(r => r.name === 'Same · Google').spend, 200, 'Same names on different channels stay separate');
assert.ok(campaigns.some(r => r.name === 'Name || separator · Google'));
assert.equal(campaigns.find(r => r.name === 'Previous only · Google').spend, 0);
assert.equal(campaigns.reduce((s, r) => s + r.spend, 0), 355);
assert.equal(buildCampaignPerformance(Array.from({ length: 30 }, (_, i) => row(`Campaign ${i}`, 'Google', i)), [], 'SMB').length, 30, 'No top-25 truncation');
console.log('PASS: campaign rollup reconciles MMP current + comparison and normalized platforms');
const renamedMeta = 'ABM | PrePass | Website leads - BEST INTERESTS';
const legacyMeta = 'ABM | PrePass | Website leads - FMCSA 200+ & BEST INTERESTS';
const renamedGoogle = 'Search | ABM | High-Intent Keywords v2';
const legacyGoogle = 'Search | ABM | High-Intent Keywords';
const aliases = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: '120249350732760438', alias_name: legacyMeta, canonical_name: renamedMeta },
  { platform: 'Meta', campaign_id: '120249350732760438', alias_name: renamedMeta, canonical_name: renamedMeta },
  { platform: 'Google', campaign_id: '24123456789', alias_name: legacyGoogle, canonical_name: renamedGoogle },
  { platform: 'Google', campaign_id: '24123456789', alias_name: renamedGoogle, canonical_name: renamedGoogle },
]);
const renamed = buildCampaignPerformance([
  row(renamedMeta, 'Meta', 831.67, 0),
  { ...row(legacyMeta, 'fb', 0, 2), impressions: 0, clicks: 0, platform_conversions: 0, sqls: 0, closed_won: 0 },
  row(renamedGoogle, 'Google', 400, 0),
  { ...row(legacyGoogle, 'Google', 0, 3), impressions: 0, clicks: 0, platform_conversions: 0, sqls: 0, closed_won: 0 },
], [], 'ABM', aliases);
assert.equal(renamed.length, 2, 'Meta and Google renames must each consolidate under their stable-ID canonical name');
const renamedMetaRow = renamed.find(r => r.name === `${renamedMeta} · Meta`);
assert.equal(renamedMetaRow.spend, 831.67);
assert.equal(renamedMetaRow.mqls, 2);
const renamedGoogleRow = renamed.find(r => r.name === `${renamedGoogle} · Google`);
assert.equal(renamedGoogleRow.spend, 400);
assert.equal(renamedGoogleRow.mqls, 3);
const qualifiedRenamed = addQualifiedCampaignMetrics(
  renamed,
  [row(renamedMeta, 'Meta', 831.67, 0), row(legacyMeta, 'fb', 0, 2), row(renamedGoogle, 'Google', 400, 0)],
  [],
  { submissions: [{ id_marketo: 'lead-1', marketo_guid: 'guid-1', activity_date: '2026-09-29T09:42:30Z', fleet_size: '101-500', utm_campaign: legacyMeta }], mqls: ['lead-1'], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] },
  null,
  aliases,
);
assert.equal(qualifiedRenamed.find(r => r.name === `${renamedMeta} · Meta`).qualified.mqls, 1, 'Qualified stages must use the same automatic alias identity');
const mofMeta = 'ABM | PrePass | Website leads | MOF';
const standardSources = [row(renamedMeta, 'Meta', 100, 0), row(mofMeta, 'Meta', 80, 0)];
const standardRows = buildCampaignPerformance(standardSources, [], 'ABM', aliases);
const reconciledStandard = replaceAbmCampaignFunnelMetrics(
  standardRows,
  standardSources,
  [],
  {
    submissions: [
      { id_marketo: 'contact-1', marketo_guid: 'guid-1', activity_date: '2026-10-01T10:00:00Z', fleet_size: null, utm_source: 'facebook', utm_campaign: 'ABM+%7C+PrePass+%7C+Website+leads+-+FMCSA+200%2B+%26+BEST+INTERESTS' },
      { id_marketo: 'contact-1', marketo_guid: 'guid-0', activity_date: '2026-09-30T10:00:00Z', fleet_size: null, utm_source: 'facebook', utm_campaign: mofMeta },
      { id_marketo: 'contact-2', marketo_guid: 'guid-2', activity_date: '2026-10-02T10:00:00Z', fleet_size: null, utm_source: 'fb', utm_campaign: legacyMeta },
    ],
    mqls: ['contact-1'], sqls: [], won: [],
  },
  { submissions: [], mqls: [], sqls: [], won: [] },
  null,
  aliases,
);
const reconciledBest = reconciledStandard.find(r => r.name === `${renamedMeta} · Meta`);
const reconciledMof = reconciledStandard.find(r => r.name === `${mofMeta} · Meta`);
assert.equal(reconciledBest.leads, 2, 'ABM Leads must be unique Marketo contacts attributed by UTM');
assert.equal(reconciledBest.mqls, 1, 'ABM MQLs must be a subset of those same UTM-attributed contacts');
assert.equal(reconciledMof.leads, 0, 'Native provider conversions must not populate ABM Leads without matching contacts');
assert.equal(reconciledMof.mqls, 0);
console.log('PASS: ABM standard funnel uses unique UTM-attributed contacts, not native provider conversions');

const provider = (platform, campaignId, campaignName, spend, options = {}) => ({
  platform, campaign_id: campaignId, campaign_name: campaignName,
  spend, cost: options.cost ?? 0, impressions: options.impressions ?? 100,
  clicks: options.clicks ?? 10, leads: options.metaLeads ?? 99,
  focus: options.focus ?? null,
});
const stageEvent = (id, date, campaign, campaignId = null) => ({
  id_marketo: id,
  event_date: date,
  utm_campaign: campaign,
  utm_campaign_id: campaignId,
});
const smbAliases = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: 'meta-1', alias_name: 'Old Meta One', canonical_name: 'SMB Similar Name' },
  { platform: 'Meta', campaign_id: 'meta-2', alias_name: 'Old Meta Two', canonical_name: 'SMB-Similar Name' },
  { platform: 'Google', campaign_id: 'google-1', alias_name: 'Old Google', canonical_name: 'SMB Search' },
]);
const smbCurrentMedia = [
  provider('Meta', 'meta-1', 'SMB Similar Name', 100),
  provider('Meta', 'meta-2', 'SMB-Similar Name', 200),
  provider('Google', 'google-1', 'SMB Search', 0, { cost: 300, impressions: 300, clicks: 30 }),
  provider('StackAdapt', 'stack-1', 'Branding One', 400, { focus: 'SMB', impressions: 400, clicks: 40 }),
  provider('Meta', 'meta-abm', 'ABM | PrePass', 900),
  provider('Google', 'google-fd', 'Search | FD 360', 800, { cost: 800 }),
  provider('Meta', 'meta-ata', 'ATA Event | PrePass | Social', 700),
  provider('StackAdapt', 'stack-abm', 'Retargeting', 600, { focus: 'ABM' }),
];
const smbPreviousMedia = [
  provider('Meta', 'meta-1', 'SMB Similar Name', 10),
  provider('Google', 'google-prev', 'Previous Only', 0, { cost: 50, impressions: 50, clicks: 5 }),
];
const smbCurrentCohort = {
  periodStart: '2026-10-01', periodEndExclusive: '2026-11-01',
  submissions: [
    { id_marketo: 'repeat', marketo_created_at: '2026-10-01T09:00:00Z', utm_campaign_id: 'meta-2', utm_campaign: 'SMB-Similar Name' },
    { id_marketo: 'repeat', marketo_created_at: '2026-10-02T09:00:00Z', utm_campaign_id: 'meta-1', utm_campaign: 'SMB Similar Name' },
    { id_marketo: 'cross-stage', marketo_created_at: '2026-10-03T09:00:00Z', utm_campaign_id: 'google-1', utm_campaign: 'SMB Similar Name' },
    { id_marketo: 'id-wins', marketo_created_at: '2026-10-04T09:00:00Z', utm_campaign_id: 'meta-2', utm_campaign: 'SMB Search' },
    { id_marketo: 'ambiguous-name', marketo_created_at: '2026-10-05T09:00:00Z', utm_campaign_id: null, utm_campaign: 'SMB Similar Name' },
    { id_marketo: 'unique-name', marketo_created_at: '2026-10-06T09:00:00Z', utm_campaign_id: null, utm_campaign: 'Previous Only' },
  ],
  mqls: [
    stageEvent('repeat', '2026-10-08', 'SMB Similar Name', 'meta-1'),
    stageEvent('cross-stage', '2026-10-08', 'SMB Search', 'google-1'),
    stageEvent('cross-stage', '2026-10-08', 'SMB Search', 'google-1'),
    stageEvent('id-wins', '2026-10-08', 'SMB-Similar Name', 'meta-2'),
  ],
  sqls: [stageEvent('cross-stage', '2026-10-09', 'SMB Search', 'google-1')],
  won: [stageEvent('cross-stage', '2026-10-10', 'SMB Search', 'google-1')],
};
const smbPreviousCohort = {
  periodStart: '2026-09-01', periodEndExclusive: '2026-10-01',
  submissions: [
    { id_marketo: 'previous-person', marketo_created_at: '2026-09-01T09:00:00Z', utm_campaign_id: 'meta-1', utm_campaign: 'SMB Similar Name' },
  ],
  mqls: [stageEvent('previous-person', '2026-09-08', 'SMB Similar Name', 'meta-1')], sqls: [], won: [],
};
const smbRows = buildSmbCampaignPerformance(
  smbCurrentMedia, smbPreviousMedia, smbCurrentCohort, smbPreviousCohort, null, smbAliases,
);
assert.equal(smbRows.filter(r => ['meta-1', 'meta-2'].includes(r.campaignId)).length, 2, 'Distinct provider IDs with similar names must remain separate');
const smbMetaOne = smbRows.find(r => r.campaignId === 'meta-1');
const smbMetaTwo = smbRows.find(r => r.campaignId === 'meta-2');
const smbGoogle = smbRows.find(r => r.campaignId === 'google-1');
assert.deepEqual([smbMetaOne.spend, smbMetaOne.impressions, smbMetaOne.clicks], [100, 100, 10], 'Media metrics must use provider rows');
assert.deepEqual([smbMetaOne.leads, smbMetaOne.mqls, smbMetaOne.prevLeads, smbMetaOne.prevMqls], [1, 1, 1, 1], 'Repeated contacts count once and periods remain separate');
assert.deepEqual([smbMetaOne.metaLeads, smbMetaOne.prevMetaLeads], [99, 99], 'Meta Leads must aggregate separately without changing Marketo Leads');
assert.deepEqual([smbMetaTwo.leads, smbMetaTwo.mqls], [1, 1], 'Stable campaign ID must win over a conflicting UTM name');
assert.deepEqual([smbGoogle.leads, smbGoogle.mqls, smbGoogle.sqls, smbGoogle.won], [1, 1, 1, 1], 'Repeated canonical lifecycle rows count once and stay in one campaign');
assert.equal(smbGoogle.metaLeads, undefined, 'Meta Leads must remain unavailable for non-Meta campaigns');
assert.equal(smbGoogle.spend, 300, 'Google provider cost must populate spend');
assert.ok(!smbRows.some(r => ['meta-abm', 'google-fd', 'meta-ata', 'stack-abm'].includes(r.campaignId)), 'Non-SMB and ATA provider campaigns must be excluded');
assert.ok(smbRows.every(r => r.leads !== 99), 'Native provider conversions must never populate SMB Leads');
const smbUnattributed = smbRows.find(r => r.smbUnattributed);
assert.deepEqual([smbUnattributed.leads, smbUnattributed.mqls], [1, 0], 'Ambiguous campaign names must fail closed into an auditable bucket');
assert.equal(smbRows.find(r => r.campaignId === 'google-prev').leads, 1, 'A unique name fallback may target a comparison-only provider campaign');
const smbMetaOnly = buildSmbCampaignPerformance(
  smbCurrentMedia, smbPreviousMedia, smbCurrentCohort, smbPreviousCohort, 'Meta', smbAliases,
);
assert.ok(smbMetaOnly.every(r => r.name.endsWith('· Meta')), 'Channel filter must retain only the selected provider');
assert.ok(!smbMetaOnly.some(r => r.smbUnattributed), 'Unattributed SMB bucket is visible only in the all-channel view');
const unknownIdRows = buildSmbCampaignPerformance(
  smbCurrentMedia,
  smbPreviousMedia,
  {
    submissions: [
      { id_marketo: 'unknown-id', marketo_created_at: '2026-10-07T09:00:00Z', utm_campaign_id: 'unknown-provider-id', utm_campaign: 'SMB Search' },
      { id_marketo: 'unknown-abm', marketo_created_at: '2026-10-07T10:00:00Z', utm_campaign_id: 'unknown-abm-id', utm_campaign: 'ABM | PrePass' },
      { id_marketo: 'unknown-fd360', marketo_created_at: '2026-10-07T11:00:00Z', utm_campaign_id: null, utm_campaign: 'Search | FD 360' },
      { id_marketo: 'unknown-generic', marketo_created_at: '2026-10-07T12:00:00Z', utm_campaign_id: null, utm_campaign: 'Generic campaign' },
    ],
    periodStart: '2026-10-01', periodEndExclusive: '2026-11-01',
    mqls: [], sqls: [], won: [],
  },
  { periodStart: '2026-09-01', periodEndExclusive: '2026-10-01', submissions: [], mqls: [], sqls: [], won: [] },
  null,
  smbAliases,
);
assert.equal(unknownIdRows.find(r => r.campaignId === 'google-1').leads, 0, 'An unknown campaign ID must not fall back to a valid campaign name');
assert.equal(unknownIdRows.find(r => r.smbUnattributed).leads, 1, 'An unknown campaign ID must fail closed into the all-channel audit bucket');
console.log('PASS: SMB Campaign Performance uses stable provider grain and one deduplicated Marketo funnel');
const pmaxAliases = buildCampaignAliasMap([
  {
    platform: 'Google',
    campaign_id: '23725617061',
    alias_name: 'P.Max | ByPass | Impact Report | New Users [SMB]',
    canonical_name: 'P.Max | ByPass | Impact Report | New Users [SMB]',
  },
]);
const pmaxContactOnly = buildSmbCampaignPerformance(
  [provider('Google', '23725617061', 'P.Max | ByPass | Impact Report | New Users [SMB]', 0, { cost: 11000 })],
  [],
  {
    periodStart: '2026-09-10', periodEndExclusive: '2026-10-10',
    submissions: [{ id_marketo: 'form-contact', marketo_created_at: '2026-09-12T09:00:00Z', utm_campaign_id: '23725617061', utm_campaign: 'P.Max | ByPass | Impact Report | New Users [SMB]' }],
    mqls: [stageEvent('form-contact', '2026-09-13', 'P.Max | ByPass | Impact Report | New Users [SMB]', '23725617061')],
    sqls: [stageEvent('form-contact', '2026-09-14', 'P.Max | ByPass | Impact Report | New Users [SMB]', '23725617061')],
    won: [stageEvent('form-contact', '2026-09-15', 'P.Max | ByPass | Impact Report | New Users [SMB]', '23725617061')],
  },
  { periodStart: '2026-08-11', periodEndExclusive: '2026-09-10', submissions: [], mqls: [], sqls: [], won: [] },
  null,
  pmaxAliases,
);
const pmaxReconciled = applySmbCertifiedLifecycle(
  pmaxContactOnly,
  [
    row('P.Max | ByPass | Impact Report | New Users [SMB]', 'Google', 0, 42),
    row('P.Max | ByPass | Impact Report | New Users [SMB]', 'Google', 0, 12),
    row('P.Max | ByPass | Impact Report | New Users [SMB]', 'Google', 0, 31),
  ].map((source, index) => ({
    ...source,
    sqls: [32, 14, 37][index],
    closed_won: [45, 11, 39][index],
  })),
  [],
  null,
  pmaxAliases,
);
const pmax = pmaxReconciled.find(r => r.campaignId === '23725617061');
assert.deepEqual(
  [pmax.leads, pmax.mqls, pmax.sqls, pmax.won],
  [1, 85, 83, 95],
  'Certified lifecycle publication must replace—not add to—the incomplete form-only stages',
);
console.log('PASS: SMB Google lifecycle restores certified calls/enrollments/overlays without form overlap');
const stageOnlyAliases = buildCampaignAliasMap([
  { platform: 'Google', campaign_id: 'stage-only-id', alias_name: 'Historical SMB Calls', canonical_name: 'Historical SMB Calls' },
]);
const stageOnlyRows = applySmbCertifiedLifecycle(
  [],
  [{ ...row('Historical SMB Calls', 'Unattributed', 0, 2), sqls: 1, closed_won: 1 }],
  [],
  null,
  stageOnlyAliases,
);
assert.deepEqual(
  [stageOnlyRows[0]?.campaignId, stageOnlyRows[0]?.spend, stageOnlyRows[0]?.mqls, stageOnlyRows[0]?.sqls, stageOnlyRows[0]?.won],
  ['stage-only-id', 0, 2, 1, 1],
  'A stable-ID-certified lifecycle campaign must remain visible even when it has no provider media row in either period',
);
console.log('PASS: certified lifecycle-only campaigns stay visible without invented media');
const reviewerUnknownIdRows = applySmbCertifiedLifecycle(
  pmaxContactOnly,
  [{ ...row('P.Max | ByPass | Impact Report | New Users [SMB]', 'Unattributed', 0, 9), campaign_id: 'unknown-google-id' }],
  [],
  null,
  pmaxAliases,
);
assert.equal(
  reviewerUnknownIdRows.find(r => r.campaignId === '23725617061')?.mqls,
  0,
  'An explicit unknown Campaign ID must fail closed instead of falling back to a matching campaign name',
);
const reviewerInferredPlatformRows = applySmbCertifiedLifecycle(
  [],
  [{ ...row('Historical SMB Calls', 'Unattributed', 0, 2), sqls: 1, closed_won: 1 }],
  [],
  'Google',
  stageOnlyAliases,
);
assert.deepEqual(
  [reviewerInferredPlatformRows[0]?.campaignId, reviewerInferredPlatformRows[0]?.mqls],
  ['stage-only-id', 2],
  'Channel filtering must happen after stable-ID/alias platform inference',
);
const temporalCurrent = {
  periodStart: '2026-10-01', periodEndExclusive: '2026-11-01',
  submissions: [
    { id_marketo: 'created-and-staged', marketo_created_at: '2026-10-03T09:00:00Z', utm_campaign_id: 'meta-1', utm_campaign: 'SMB Similar Name' },
    { id_marketo: 'conflict', marketo_created_at: '2026-10-04T09:00:00Z', utm_campaign_id: 'meta-1', utm_campaign: 'SMB Similar Name' },
    { id_marketo: 'same-id-cross-period', marketo_created_at: '2026-10-05T09:00:00Z', utm_campaign_id: 'meta-1', utm_campaign: 'SMB Similar Name' },
  ],
  mqls: [
    stageEvent('old-contact', '2026-10-02', 'SMB Search', 'google-1'),
    stageEvent('outside-period', '2026-09-30', 'SMB Search', 'google-1'),
    stageEvent('meta-google-copy', '2026-10-03', 'SMB Search', 'google-1'),
    stageEvent('meta-google-copy', '2026-10-03', 'SMB Search', 'google-1'),
    stageEvent('created-and-staged', '2026-10-03', 'SMB Similar Name', 'meta-1'),
    stageEvent('conflict', '2026-10-04', 'SMB Search', 'google-1'),
  ],
  sqls: [stageEvent('created-and-staged', '2026-10-04', 'SMB Similar Name', 'meta-1')],
  won: [stageEvent('created-and-staged', '2026-10-05', 'SMB Similar Name', 'meta-1')],
};
const temporalPrevious = {
  periodStart: '2026-09-01', periodEndExclusive: '2026-10-01',
  submissions: [],
  mqls: [stageEvent('same-id-cross-period', '2026-09-05', 'SMB Search', 'google-1')],
  sqls: [], won: [],
};
const temporalRows = buildSmbCampaignPerformance(
  smbCurrentMedia, smbPreviousMedia, temporalCurrent, temporalPrevious, null, smbAliases,
);
const temporalMeta = temporalRows.find(r => r.campaignId === 'meta-1');
const temporalGoogle = temporalRows.find(r => r.campaignId === 'google-1');
const temporalUnattributed = temporalRows.find(r => r.smbUnattributed);
assert.deepEqual(
  [temporalGoogle.leads, temporalGoogle.mqls],
  [0, 2],
  'An old contact with an in-period stage date must count only that stage; repeated canonical rows dedupe globally',
);
assert.equal(temporalGoogle.mqls, 2, 'An out-of-period MQL must not enter the current period');
assert.deepEqual(
  [temporalMeta.leads, temporalMeta.mqls, temporalMeta.sqls, temporalMeta.won],
  [2, 1, 1, 1],
  'A created contact with in-period stages keeps one campaign attribution and each metric counts once',
);
assert.deepEqual(
  [temporalUnattributed.leads, temporalUnattributed.mqls],
  [1, 1],
  'Conflicting deterministic campaign evidence must fail closed for every metric',
);
assert.equal(temporalMeta.prevMqls, 0, 'Current membership must not leak into comparison');
assert.equal(temporalGoogle.prevMqls, 1, 'Comparison membership must be built independently even for an ID also present in current');
console.log('PASS: SMB Campaign Performance applies event-time periods and fail-closed contact attribution');
const ambiguousAliases = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: '1', alias_name: 'Shared old name', canonical_name: 'Current A' },
  { platform: 'Meta', campaign_id: '2', alias_name: 'Shared old name', canonical_name: 'Current B' },
]);
const ambiguous = buildCampaignPerformance([row('Shared old name', 'Meta', 10, 1)], [], 'ABM', ambiguousAliases);
assert.equal(ambiguous[0].name, 'Shared old name · Meta', 'Alias collisions must fail closed instead of merging different campaign IDs');
const ambiguousSameTarget = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: '1', alias_name: 'Shared old name', canonical_name: 'Shared current name' },
  { platform: 'Meta', campaign_id: '2', alias_name: 'Shared old name', canonical_name: 'Shared current name' },
]);
const sameTarget = buildCampaignPerformance([row('Shared old name', 'Meta', 10, 1)], [], 'ABM', ambiguousSameTarget);
assert.equal(sameTarget[0].name, 'Shared old name · Meta', 'Two stable IDs must remain ambiguous even when their current display name matches');
const inconsistentStableId = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: '1', alias_name: 'Legacy label', canonical_name: 'Current A' },
  { platform: 'Meta', campaign_id: '1', alias_name: 'Legacy label', canonical_name: 'Current B' },
]);
const inconsistentStableIdRows = buildCampaignPerformance([
  { ...row('Legacy label', 'Meta', 10, 1), campaign_id: '1' },
], [], 'ABM', inconsistentStableId);
assert.equal(inconsistentStableIdRows[0].name, 'Legacy label · Meta', 'Conflicting canonical names for one stable ID must fail closed');
const sameCanonicalDifferentIds = buildCampaignPerformance([
  { ...row('Historical A', 'Meta', 10, 1), campaign_id: '1' },
  { ...row('Historical B', 'Meta', 20, 2), campaign_id: '2' },
], [], 'ABM', buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: '1', alias_name: 'Historical A', canonical_name: 'Shared current name' },
  { platform: 'Meta', campaign_id: '2', alias_name: 'Historical B', canonical_name: 'Shared current name' },
]));
assert.equal(sameCanonicalDifferentIds.length, 2, 'Distinct stable IDs must never merge just because their canonical display names match');
assert.equal(sameCanonicalDifferentIds.map(r => r.campaignId).sort().join('|'), '1|2');
assert.equal(sameCanonicalDifferentIds.reduce((sum, r) => sum + r.spend, 0), 30);
const crossPlatformAliases = buildCampaignAliasMap([
  { platform: 'Meta', campaign_id: 'meta-1', alias_name: 'Cross-platform old name', canonical_name: 'Meta current name' },
  { platform: 'Google', campaign_id: 'google-1', alias_name: 'Cross-platform old name', canonical_name: 'Google current name' },
]);
const crossPlatformSourceRows = [
  row('Cross-platform old name', 'Meta', 10),
  row('Cross-platform old name', 'Google', 20),
];
const googleOnlyAlias = buildCampaignAliasMap([
  { platform: 'Google', campaign_id: 'google-only', alias_name: 'Shared provider label', canonical_name: 'Google renamed label' },
]);
const isolatedMeta = buildCampaignPerformance([row('Shared provider label', 'Meta', 5)], [], 'ABM', googleOnlyAlias);
assert.equal(isolatedMeta[0].name, 'Shared provider label · Meta', 'A known Meta row must never use a Google-only global alias');
const unambiguousUnattributed = buildCampaignPerformance(
  [row('abm_brand_defense', 'Unattributed', 0, 2)], [], 'ABM',
  buildCampaignAliasMap([{ platform: 'Google', campaign_id: '24053422446', alias_name: 'abm_brand_defense', canonical_name: 'Search | ABM | Brand Defense' }]),
);
assert.equal(unambiguousUnattributed[0].name, 'Search | ABM | Brand Defense · Unattributed', 'Display-only global aliases may normalize unambiguous Unattributed UTM labels');
assert.equal(unambiguousUnattributed[0].campaignId, '24053422446');
const crossPlatformRows = buildCampaignPerformance(crossPlatformSourceRows, [], 'ABM', crossPlatformAliases);
assert.equal(crossPlatformRows.map(item => item.name).sort().join('|'), 'Google current name · Google|Meta current name · Meta');
const crossPlatformQualified = addQualifiedCampaignMetrics(
  crossPlatformRows,
  crossPlatformSourceRows,
  [],
  { submissions: [{ id_marketo: 'cross-1', activity_date: '2026-10-01', fleet_size: '200', utm_campaign: 'Cross-platform old name' }], mqls: ['cross-1'], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] },
  'all',
  crossPlatformAliases,
);
assert.equal(crossPlatformQualified.reduce((sum, item) => sum + item.mqls, 0), 0, 'Platformless CRM aliases must fail closed across Meta/Google collisions');
console.log('PASS: automatic stable-ID aliases consolidate Meta/Google renames and fail closed on collisions');
const adjusted = buildCampaignPerformance([
  row('SMB campaign', 'Google', 100),
  row('Landing-page adjustments (campaign unavailable)', 'Google', 0),
], [], 'SMB');
assert.equal(adjusted.length, 1);
assert.equal(adjusted[0].leads, 5);
assert.equal(adjusted.some(r => r.name.includes('Landing-page adjustments')), false, 'Unattributed adjustment rows must not appear as campaigns');
console.log('PASS: unattributed LP adjustments reconcile without inventing campaign attribution');
const table = load('../src/components/ChannelTable.tsx', '\nexport { buildColumns, filterCampaignRows };');
meta.qualified = { leads: 4, mqls: 3, sqls: 2, won: 1 };
meta.prevQualified = { leads: 3, mqls: 2, sqls: 1, won: 0 };
const campaignFilterRows = [
  meta,
  { ...meta, name: 'No spend · Meta', spend: 0, leads: 1 },
  { ...meta, name: 'Google campaign · Google', spend: 20 },
  { ...meta, name: 'StackAdapt campaign · StackAdapt', spend: 30 },
  { ...meta, name: 'Unattributed +100 Trucks', spend: 0, qualifiedUnattributed: true },
  { ...meta, name: 'Unattributed SMB contacts', spend: 0, smbUnattributed: true },
];
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'both').map(r => r.name), ['Same · Meta', 'Google campaign · Google', 'StackAdapt campaign · StackAdapt']);
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'not-invested', 'both').map(r => r.name), ['No spend · Meta', 'Unattributed +100 Trucks', 'Unattributed SMB contacts'], 'All-channel no-investment view must expose auditable unattributed rows promised by the table subtitle');
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'Meta').map(r => r.name), ['Same · Meta']);
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'Google').map(r => r.name), ['Google campaign · Google']);
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'StackAdapt').map(r => r.name), ['StackAdapt campaign · StackAdapt'], 'StackAdapt page/filter must retain direct StackAdapt campaigns');
assert.ok(!table.filterCampaignRows(campaignFilterRows, 'not-invested', 'Meta').some(r => r.qualifiedUnattributed), 'Unattributed rows stay hidden in a platform-specific view');
assert.ok(!table.filterCampaignRows(campaignFilterRows, 'not-invested', 'Meta').some(r => r.smbUnattributed), 'Unattributed SMB contacts stay hidden in a platform-specific view');
console.log('PASS: campaign investment and platform filters');
const tableHtml = (showQualifiedCampaignMetrics, options = {}) => renderToStaticMarkup(React.createElement(table.default, {
  initialChannels: [meta], title: 'Campaign Performance', firstColumnLabel: 'Campaign', showQualifiedCampaignMetrics,
  ...options,
}));
for (const label of ['MQL +100 Trucks', 'Cost/MQL +100', 'SQL +100', 'Cost/SQL +100', 'WON +100', 'Cost/WON +100']) {
  assert.ok(tableHtml(true).includes(label), `ABM campaign table must include ${label}`);
  assert.ok(!tableHtml(false).includes(label), 'Qualified columns must not leak to other tables');
}
assert.equal(table.columnSelectorLabel('qualified_MQL +100 Trucks'), 'MQL +100 Trucks', 'Column selector must use human labels, not internal qualified_* ids');
const qualifiedColumns = table.buildColumns('Campaign', undefined, true).filter(c => c.id?.startsWith('qualified_'));
assert.equal(qualifiedColumns.length, 6);
const defaultCampaignHtml = tableHtml(false, {
  showColumnSelector: true,
  defaultVisibleColumnIds: ['spend', 'leads', 'cpl', 'mqls', 'cpmql'],
});
const visibleHeaders = [...defaultCampaignHtml.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim());
assert.deepEqual(visibleHeaders, ['Campaign', 'Spend', 'Leads', 'Cost/Lead', 'MQLs', 'Cost/MQL'], 'Campaign defaults must show only the requested columns');
const smbComparisonHtml = tableHtml(false, {
  initialChannels: [{ ...smbMetaOne, metaLeads: 2, prevMetaLeads: 1 }],
  showSmbMetaLeadComparison: true,
  showColumnSelector: true,
  defaultVisibleColumnIds: ['leads', 'metaLeads', 'leadDifferencePct'],
});
const smbComparisonHeaders = [...smbComparisonHtml.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim());
assert.deepEqual(smbComparisonHeaders, ['Campaign', 'Leads', 'Leads Meta', 'Difference %'], 'SMB Campaign Performance must add only the Meta lead and percentage-difference columns');
assert.match(smbComparisonHtml, /-50\.0%/, 'Difference % must use Meta Leads as the denominator: (Marketo - Meta) / Meta');
assert.ok(!tableHtml(false).includes('Leads Meta'), 'Meta comparison columns must not leak to other tables');
const zeroRowHtml = tableHtml(false, {
  hideZeroRows: true,
  initialChannels: [meta, { ...meta, name: 'Zero campaign', impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0, qualified: undefined }],
});
assert.match(zeroRowHtml, /Same · Meta/);
assert.doesNotMatch(zeroRowHtml, /Zero campaign/, 'Rows with no current-period data must be hidden');
for (const [i, expected] of [3, 50, 2, 75, 1, 150].entries()) {
  const col = qualifiedColumns[i];
  assert.equal(typeof col.accessorFn, 'function', 'Qualified metric must be sortable, not display-only');
  assert.equal(col.accessorFn(meta), expected);
  const cell = renderToStaticMarkup(col.cell({ row: { original: meta }, getValue: () => expected }));
  assert.doesNotMatch(cell, /unavailable/);
  if (i < 4) assert.match(cell, /%/);
  if (i === 4) assert.match(cell, /new/);
  assert.equal(col.accessorFn({ ...meta, qualified: undefined }), undefined);
  if (i % 2) {
    assert.equal(col.accessorFn({ ...meta, qualified: { leads: 0, mqls: 0, sqls: 0, won: 0 } }), undefined, 'No denominator is not free acquisition');
    assert.equal(col.accessorFn({ ...meta, qualifiedUnattributed: true }), undefined, 'Unattributed spend is unknown');
  }
}
const { createTable, getCoreRowModel, getSortedRowModel } = require('@tanstack/react-table');
for (const col of qualifiedColumns) {
  for (const desc of [false, true]) {
    const sortable = createTable({ data: [meta, { ...meta, name: 'Higher', spend: 600, qualified: { leads: 8, mqls: 6, sqls: 4, won: 2 } }], columns: [col], state: { sorting: [{ id: col.id, desc }] }, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
    assert.equal(sortable.getRowModel().rows[0].original.name, desc ? 'Higher' : meta.name, `${col.id} sorts ${desc ? 'descending' : 'ascending'}`);
  }
}
const tableTitles = [...focusSource.matchAll(/<ChannelTable\b[^>]*?\stitle="([^"]+)"/g)].map(match => match[1]);
assert.equal(tableTitles[tableTitles.indexOf('Product Performance') + 1], 'Campaign Performance');
assert.ok(focusSource.indexOf('title="Campaign Performance"') < focusSource.indexOf('title="ABM Campaign Type Performance"'));
assert.match(focusSource, /showQualifiedCampaignMetrics=\{d.focus === 'ABM'\}/);
assert.match(focusSource, /unique Marketo contacts attributed by campaign UTM/i, 'ABM subtitle must explain the reconciled CRM funnel');
const analyticsSource = readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
assert.match(analyticsSource, /campaignPerformance,\s*\n/);
assert.match(analyticsSource, /prepass_campaign_name_aliases/);
assert.match(analyticsSource, /fetchCampaignAliasRows/);
assert.match(analyticsSource, /Incomplete PrePass campaign alias page/);
assert.match(analyticsSource, /buildCampaignAliasMap/);
assert.match(analyticsSource, /addQualifiedCampaignMetrics\(campaignPerformance/);
assert.match(analyticsSource, /buildSmbCampaignPerformance\(/, 'SMB must have an explicit Campaign Performance-only wiring path');
assert.match(analyticsSource, /applySmbCertifiedLifecycle\([\s\S]{0,500}certifiedCurr, certifiedPrev, channelFilter, campaignAliases/,
  'SMB lifecycle stages must receive the unfiltered corrected MMP publication before channel inference');
assert.match(analyticsSource, /focus === 'SMB'\s*\?\s*\[null\]/,
  'SMB certified lifecycle rows must include unattributed rows before platform inference');
assert.match(analyticsSource, /focus === 'SMB'\s*\? await fetchSmbCampaignPerformanceData\(/, 'Only SMB may load the provider/Marketo campaign funnel');
for (const tableName of ['meta_campaigns', 'google_campaigns', 'stackadapt_campaigns', 'campaign_leads']) {
  assert.ok(analyticsSource.includes(`from('${tableName}')`), `SMB Campaign Performance must read ${tableName} in analytics.ts`);
}
assert.match(analyticsSource, /from\('meta_campaigns'\)[\s\S]{0,160}select\('date,campaign_id,campaign_name,spend,impressions,clicks,leads'/,
  'SMB Campaign Performance must read Meta leads separately from the existing Marketo Leads funnel');
const smbLoaderSource = analyticsSource.slice(
  analyticsSource.indexOf('async function fetchSmbCampaignPerformanceData('),
  analyticsSource.indexOf('// ─── fetchFocusData'),
);
for (const tableName of ['Meta MQL', 'Google MQL', 'Meta SQL', 'Google SQL', 'Meta WON', 'Google WON']) {
  assert.ok(!smbLoaderSource.includes(`'${tableName}'`), `SMB Campaign Performance must not read ${tableName}`);
}
for (const specification of [
  /stage: 'leads', dateColumn: 'marketo_created_at', select: 'id_marketo,utm_campaign,utm_campaign_id,marketo_created_at'/,
  /stage: 'mqls', dateColumn: 'date_mql', select: 'id_marketo,utm_campaign,utm_campaign_id,date_mql'/,
  /stage: 'sqls', dateColumn: 'date_sql', select: 'id_marketo,utm_campaign,utm_campaign_id,date_sql'/,
  /stage: 'won', dateColumn: 'date_won', select: 'id_marketo,utm_campaign,utm_campaign_id,date_won'/,
]) assert.match(smbLoaderSource, specification, 'Each canonical campaign_leads lifecycle query must select only its corresponding date and campaign evidence');
assert.match(smbLoaderSource, /supabase\.from\('campaign_leads'\)[\s\S]{0,300}\.eq\('is_campaign_attributed', true\)/,
  'Every canonical lifecycle read must require deterministic current or historical campaign attribution');
assert.match(smbLoaderSource, /\.gte\(spec\.dateColumn, periodStart\)\.lt\(spec\.dateColumn, periodEndExclusive\)/,
  'Every canonical lifecycle query must filter on its own event date');
assert.match(smbLoaderSource, /lifecyclePeriod\(start, exclusiveEndDate\(end\)\)/,
  'Current lifecycle events must use current bounds');
assert.match(smbLoaderSource, /lifecyclePeriod\(compStart, exclusiveEndDate\(compEnd\)\)/,
  'Comparison lifecycle events must use comparison bounds independently');
assert.doesNotMatch(smbLoaderSource, /from\('campaign_leads'\)[\s\S]{0,500}\.(?:eq|in)\('(?:form|form_id|list|list_id|landing_page)/, 'SMB campaign leads must not be restricted by form, list, or landing page');
assert.match(focusSource, /d\.focus === 'SMB'[\s\S]{0,300}all Marketo contacts/i, 'SMB Campaign Performance subtitle must disclose its all-contact Marketo cohort');
assert.match(focusSource, /CreatedAt, MQL, SQL, or WON falls in the selected period/i,
  'SMB subtitle must disclose the event-time union population');
assert.match(focusSource, /showSmbMetaLeadComparison=\{d\.focus === 'SMB'\}/,
  'Meta comparison columns must be enabled only for SMB Campaign Performance');
console.log('PASS: campaign placement, six sortable qualified metrics, real costs and comparison');
