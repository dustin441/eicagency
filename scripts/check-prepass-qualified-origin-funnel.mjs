import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const dashboard = readFileSync(new URL('../src/components/DashboardClient.tsx', import.meta.url), 'utf8');
assert.match(dashboard, /QualifiedFleetOriginChart/, 'Overall Performance must render the qualified-fleet origin chart');

const migration = readFileSync(new URL('../supabase/prepass_qualified_fleet_leads.sql', import.meta.url), 'utf8');
assert.match(migration, /create table if not exists public\.prepass_qualified_fleet_leads/i);
assert.match(migration, /primary key \(id_marketo\)/i, 'Contacts must be deduplicated by Marketo ID');
assert.match(migration, /fleet_size in \('101-500', '500\+'\)/i, 'Only canonical >100 fleet bands are eligible');
assert.match(migration, /date_lead timestamptz/i, 'Lead must be an independent period-aware stage');
assert.match(migration, /traffic_type text not null/i, 'Each contact needs a paid, organic, or unidentified traffic classification');
assert.match(migration, /prepass_refresh_qualified_fleet_leads/i, 'The table must refresh from existing Marketo sources');
for (const table of [
  'Google MQL', 'Google SQL', 'Google WON',
  'Meta MQL', 'Meta SQL', 'Meta WON',
  'leads_abm', 'leads_mobileapp', 'leads_fd360',
  'prepass_abm_form_submissions', 'prepass_smb_form_submissions',
  'campaign_leads',
  'calls', 'calls_won', 'enrollment', 'enrollment_won',
  'master_won_leads_details', 'prepass_marketo_fleet_enrichment',
]) {
  assert.match(migration, new RegExp(`public\\.\"?${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\"?`, 'i'), `${table} must feed the all-contact canonical population`);
}
assert.match(migration, /group by id_marketo/i, 'Stage events must collapse to one canonical contact');
assert.doesNotMatch(migration, /offline.?conversion/i, 'Offline-conversion tables are outside this contact table');
assert.doesNotMatch(migration, /create trigger prepass_refresh_qualified_fleet_leads/i, 'The canonical refresh must run once after the Marketo batch');
assert.match(migration, /prepass_qualified_fleet_origin_funnel/i, 'The dashboard needs a period-aware aggregation RPC');
assert.match(migration, /Origin not identified/, 'Missing attribution must not be classified as direct');
assert.doesNotMatch(migration, /Other sources/i, 'Identified origins must never be collapsed into Other Sources');
assert.match(migration, /concat_ws\(' · '/i, 'Origin labels must preserve source, medium, and campaign detail');
assert.match(migration, /p_fbclid is retained only for migration compatibility and is intentionally[\s\S]*not used to infer origin/i);
assert.doesNotMatch(migration, /btrim\(l\.fbclid\)[\s\S]{0,80}::int/i, 'fbclid must not affect attribution-row selection');
assert.match(migration, /prepass_marketo_fleet_enrichment/i, 'Blank source fleet sizes must use direct Marketo fallback data');

const componentUrl = new URL('../src/components/QualifiedFleetOriginChart.tsx', import.meta.url);
const source = readFileSync(componentUrl, 'utf8');
assert.match(source, /layout="vertical"/, 'Detailed origin labels require a horizontal bar chart');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, {
  module: mod,
  exports: mod.exports,
  require: (id) => {
    if (id === 'recharts') return new Proxy({}, { get: () => (props) => props.children ?? null });
    if (id === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') };
    return require(id);
  },
  console,
});
const html = renderToStaticMarkup(React.createElement(mod.exports.default, {
  rows: [
    { origin: 'Google · PMax · ABMNEWVERTICALSBRANDPMAX', trafficType: 'Paid Traffic', leads: 5, mqls: 5, sqls: 2, won: 1 },
    { origin: 'Google · Organic', trafficType: 'Organic', leads: 2, mqls: 1, sqls: 0, won: 0 },
    { origin: 'Origin not identified', trafficType: 'Unidentified', leads: 1, mqls: 1, sqls: 0, won: 0 },
  ],
}));
for (const label of ['Qualified Fleet Funnel by Origin', 'Lead', 'MQL', 'SQL', 'WON', 'Total', 'Paid Traffic', 'Organic', 'Google · PMax · ABMNEWVERTICALSBRANDPMAX', 'Google · Organic', 'Origin not identified', 'Current-year results']) {
  assert.match(html, new RegExp(label), `Chart must expose ${label}`);
}
console.log('PASS: qualified fleet origin funnel contract and presentation');
