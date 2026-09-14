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
const { buildCampaignPerformance } = load('../src/services/prepass-campaign-performance.ts');
assert.equal(typeof buildCampaignPerformance, 'function');
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
assert.deepEqual(table.filterCampaignRows(campaignFilterRows, 'invested', 'both').map(r => r.name), ['Same · Meta', 'Google campaign · Google', 'StackAdapt campaign · StackAdapt']);
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
const qualifiedColumns = table.buildColumns('Campaign', undefined, true).filter(c => c.id?.startsWith('qualified_'));
assert.equal(qualifiedColumns.length, 6);
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
const analyticsSource = readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
assert.match(analyticsSource, /campaignPerformance: focus === 'ABM' \? campaignPerformance : buildCampaignPerformance\(curr, prevData, focus\)/);
assert.match(analyticsSource, /addQualifiedCampaignMetrics\(campaignPerformance/);
console.log('PASS: campaign placement, six sortable qualified metrics, real costs and comparison');
