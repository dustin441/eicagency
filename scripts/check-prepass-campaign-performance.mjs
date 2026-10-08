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
  addMetaCampaignActionMetrics,
  addQualifiedCampaignMetrics,
  buildCampaignAliasMap,
  buildCampaignPerformance,
  replaceAbmCampaignFunnelMetrics,
} = load('../src/services/prepass-campaign-performance.ts');
assert.equal(typeof buildCampaignPerformance, 'function');
assert.equal(typeof buildCampaignAliasMap, 'function');
assert.equal(typeof addQualifiedCampaignMetrics, 'function');
assert.equal(typeof addMetaCampaignActionMetrics, 'function');
assert.equal(typeof replaceAbmCampaignFunnelMetrics, 'function');
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
const actionSplit = addMetaCampaignActionMetrics(reconciledStandard, [
  { campaign_id: '120249355412120438', campaign_name: mofMeta, lead_actions: 4, contact_actions: 1, total_conversion_actions: 5 },
  { campaign_id: '120249355412120438', campaign_name: mofMeta, lead_actions: 9, contact_actions: 4, total_conversion_actions: 13 },
], [
  { campaign_id: '120249355412120438', campaign_name: mofMeta, lead_actions: 2, contact_actions: 1, total_conversion_actions: 3 },
], aliases);
const splitMof = actionSplit.find(r => r.name === `${mofMeta} · Meta`);
assert.equal(splitMof.metaContactActions, 5, 'Website Contact actions must remain visible as provider-attributed events');
assert.equal(splitMof.metaLeadActions, 13, 'Meta Lead actions must remain separate from Contact actions');
assert.equal(splitMof.metaConversionActions, 18, 'Total Meta actions may be shown only as a clearly labelled action total');
assert.equal(splitMof.leads, 0, 'Provider action counts must never overwrite CRM Form Leads');
assert.equal(splitMof.prevMetaConversionActions, 3);
const partialSplit = addMetaCampaignActionMetrics(reconciledStandard, [
  { campaign_id: null, campaign_name: mofMeta, lead_actions: 1, contact_actions: null, total_conversion_actions: 1 },
], [], aliases).find(r => r.name === `${mofMeta} · Meta`);
assert.equal(partialSplit.metaConversionActions, undefined, 'Partially backfilled periods must display unknown, not a misleading partial total');
const withUnattributed = replaceAbmCampaignFunnelMetrics(
  standardRows, standardSources, [],
  { submissions: [{ id_marketo: 'unmatched-1', activity_date: '2026-10-03', fleet_size: null, utm_source: 'facebook', utm_campaign: 'Unknown campaign' }], mqls: ['unmatched-1'], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] }, null, aliases,
);
assert.equal(withUnattributed.find(r => r.name === 'Unattributed CRM Form Leads').leads, 1, 'Unmatched CRM contacts must remain visible');
const platformMismatch = replaceAbmCampaignFunnelMetrics(
  buildCampaignPerformance([row('Provider-specific campaign', 'Google', 10)], [], 'ABM'),
  [row('Provider-specific campaign', 'Google', 10)], [],
  { submissions: [{ id_marketo: 'mismatch-1', activity_date: '2026-10-03', fleet_size: null, utm_source: 'facebook', utm_campaign: 'Provider-specific campaign' }], mqls: [], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] }, null,
);
assert.equal(platformMismatch.find(r => r.name === 'Provider-specific campaign · Google').leads, 0, 'Known Meta UTMs must not fall back into a Google campaign by name');
assert.equal(platformMismatch.find(r => r.name === 'Unattributed CRM Form Leads').leads, 1);
const metaFilteredUnattributed = replaceAbmCampaignFunnelMetrics(
  buildCampaignPerformance([row('Some Meta campaign', 'Meta', 10)], [], 'ABM'),
  [row('Some Meta campaign', 'Meta', 10)], [],
  { submissions: [{ id_marketo: 'meta-unmatched', activity_date: '2026-10-03', fleet_size: null, utm_source: 'facebook', utm_campaign: 'Unknown campaign' }], mqls: [], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] }, 'Meta',
);
assert.equal(metaFilteredUnattributed.find(r => r.name === 'Unattributed CRM Form Leads').leads, 1, 'Meta-filtered unmatched CRM contacts must remain visible');
const googleFilteredMetaContact = replaceAbmCampaignFunnelMetrics(
  buildCampaignPerformance([row('Some Google campaign', 'Google', 10)], [], 'ABM'),
  [row('Some Google campaign', 'Google', 10)], [],
  { submissions: [{ id_marketo: 'meta-unmatched', activity_date: '2026-10-03', fleet_size: null, utm_source: 'facebook', utm_campaign: 'Unknown campaign' }], mqls: [], sqls: [], won: [] },
  { submissions: [], mqls: [], sqls: [], won: [] }, 'Google',
);
assert.equal(googleFilteredMetaContact.some(r => r.name === 'Unattributed CRM Form Leads'), false, 'A Meta contact must not appear in the Google-filtered unattributed bucket');
console.log('PASS: Meta action families stay separate, incomplete splits fail closed, and unmatched CRM contacts remain visible');
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
];
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'both').map(r => r.name), ['Same · Meta', 'Google campaign · Google', 'StackAdapt campaign · StackAdapt', 'Unattributed +100 Trucks'], 'All-channel default view must not hide unattributed CRM contacts');
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'not-invested', 'both').map(r => r.name), ['No spend · Meta', 'Unattributed +100 Trucks'], 'All-channel no-investment view must expose qualified unattributed rows promised by the table subtitle');
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'Meta').map(r => r.name), ['Same · Meta']);
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'Google').map(r => r.name), ['Google campaign · Google']);
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'StackAdapt').map(r => r.name), ['StackAdapt campaign · StackAdapt'], 'StackAdapt page/filter must retain direct StackAdapt campaigns');
assert.ok(!table.filterCampaignRows(campaignFilterRows, 'not-invested', 'Meta').some(r => r.qualifiedUnattributed), 'Unattributed rows stay hidden in a platform-specific view');
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
assert.equal(table.columnSelectorLabel('leads', undefined, { leads: 'CRM Form Leads' }), 'CRM Form Leads', 'Column selector must use the ABM-specific lead definition');
const qualifiedColumns = table.buildColumns('Campaign', undefined, true).filter(c => c.id?.startsWith('qualified_'));
assert.equal(qualifiedColumns.length, 6);
const metaActionHtml = tableHtml(true, {
  showMetaCampaignActionMetrics: true,
  leadColumnLabel: 'CRM Form Leads',
  costPerLeadColumnLabel: 'Cost / CRM Form Lead',
});
for (const label of ['CRM Form Leads', 'Cost / CRM Form Lead', 'Meta Website Contacts', 'Meta Lead Actions', 'Meta Conversion Actions']) {
  assert.ok(metaActionHtml.includes(label), `ABM campaign table must explain ${label}`);
}
assert.ok(!tableHtml(false).includes('Meta Website Contacts'), 'Meta action columns must not leak to other tables');
const defaultCampaignHtml = tableHtml(false, {
  showColumnSelector: true,
  defaultVisibleColumnIds: ['spend', 'leads', 'cpl', 'mqls', 'cpmql'],
});
const visibleHeaders = [...defaultCampaignHtml.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim());
assert.deepEqual(visibleHeaders, ['Campaign', 'Spend', 'Leads', 'Cost/Lead', 'MQLs', 'Cost/MQL'], 'Campaign defaults must show only the requested columns');
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
assert.match(focusSource, /CRM Form Leads are unique Marketo contacts attributed by paid campaign UTM/i, 'ABM subtitle must explain the reconciled CRM funnel');
assert.match(focusSource, /provider-attributed events, may overlap, and are not unique people/i, 'ABM subtitle must distinguish Meta actions from unique CRM people');
const analyticsSource = readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
assert.match(analyticsSource, /campaignPerformance,\s*\n/);
assert.match(analyticsSource, /prepass_campaign_name_aliases/);
assert.match(analyticsSource, /fetchCampaignAliasRows/);
assert.match(analyticsSource, /Incomplete PrePass campaign alias page/);
assert.match(analyticsSource, /buildCampaignAliasMap/);
assert.match(analyticsSource, /addQualifiedCampaignMetrics\(campaignPerformance/);
console.log('PASS: campaign placement, six sortable qualified metrics, real costs and comparison');
