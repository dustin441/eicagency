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
  row('Name || separator', 'Google', 5), row('', 'Google', 0),
], [row('Same', 'ig', 75, 1), row('Previous only', 'Google', 60, 9)], 'ABM');
assert.equal(campaigns.length, 5, 'Union includes previous-only campaigns and blank attribution');
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
const adjusted = buildCampaignPerformance([row('SMB campaign', 'Google', 100)], [], 'SMB', [
  { platform: 'Google', lp_leads: 5, add_mqls: 2, add_sqls: 1, add_won: 0 },
  { platform: 'Google', lp_leads: -1, add_mqls: 0, add_sqls: 0, add_won: 0 },
], [{ platform: 'Direct / Unknown', lp_leads: 3, add_mqls: 1, add_sqls: 0, add_won: 0 }]);
assert.equal(adjusted.length, 3);
assert.equal(adjusted.find(r => r.name === 'Landing-page adjustments (campaign unavailable) · Google').leads, 4);
assert.equal(adjusted.find(r => r.name === 'Landing-page adjustments (campaign unavailable) · Direct / Unknown').prevLeads, 3);
assert.equal(adjusted.reduce((s, r) => s + r.leads, 0), 9);
console.log('PASS: unattributed LP adjustments reconcile without inventing campaign attribution');
const table = load('../src/components/ChannelTable.tsx', '\nexport { buildColumns };');
meta.qualified = { leads: 4, mqls: 3, sqls: 2, won: 1 };
meta.prevQualified = { leads: 3, mqls: 2, sqls: 1, won: 0 };
const tableHtml = (showQualifiedCampaignMetrics) => renderToStaticMarkup(React.createElement(table.default, {
  initialChannels: [meta], title: 'Campaign Performance', firstColumnLabel: 'Campaign', showQualifiedCampaignMetrics,
}));
for (const label of ['MQL +100 Trucks', 'Cost/MQL +100', 'SQL +100', 'Cost/SQL +100', 'WON +100', 'Cost/WON +100']) {
  assert.ok(tableHtml(true).includes(label), `ABM campaign table must include ${label}`);
  assert.ok(!tableHtml(false).includes(label), 'Qualified columns must not leak to other tables');
}
const qualifiedColumns = table.buildColumns('Campaign', undefined, true).filter(c => c.id?.startsWith('qualified_'));
assert.equal(qualifiedColumns.length, 6);
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
assert.match(analyticsSource, /campaignPerformance: focus === 'ABM' \? campaignPerformance : buildCampaignPerformance\(curr, prevData, focus, smbLpCurrentRows, smbLpPreviousRows\)/);
assert.match(analyticsSource, /addQualifiedCampaignMetrics\(campaignPerformance/);
console.log('PASS: campaign placement, six sortable qualified metrics, real costs and comparison');
