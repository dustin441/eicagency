import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import type DashboardType from '../src/components/MarketoDatabaseDashboard';
const Dashboard = createRequire(import.meta.url)('../src/components/MarketoDatabaseDashboard.tsx').default as typeof DashboardType;
import type { MarketoDatabaseReport } from '../src/services/prepass-marketo-database';
import type { DatabaseFilters } from '../src/services/prepass-marketo-database-math';

// Component-only synthetic fixtures. They are never uploaded to a reporting database.
const filters: DatabaseFilters = { start:null,end:null,source:null,segment:null,sourceField:'leadSource' };
const unavailable = renderToStaticMarkup(React.createElement(Dashboard, {
  filters, report:{available:false,reason:'No verified full snapshot is available.'},
}));
assert.match(unavailable,/Unavailable is not zero/);
assert.doesNotMatch(unavailable,/Entire database · lifetime milestones/);
const report: MarketoDatabaseReport = {
  available:true,completed_at:'2026-11-12T12:00:00Z',freshness_hours:2,field_count:302,
  lifetime:{people:4,mql:2,sql:1,won:1},
  cohort:{people:4,mql:2,sql:1,won:1,mql_sql:1,sql_won:1,unknown_source:2,missing_lead_date:0,invalid_transitions:0,lead_dates:4,mql_dates:2,sql_dates:1,won_dates:1},
  fields:{mql:true,sql:true,won:true},source_options:['Partner','Unknown'],segment_options:['SMB'],
  sources:[{label:'Partner',people:2,mql:2,sql:1,won:1,median_won_days:8,won_pairs:1},{label:'Unknown',people:2,mql:0,sql:0,won:0,median_won_days:null,won_pairs:0}],
  latest_sources:[{label:'google',people:2},{label:'Unknown',people:2}],
  velocity:[{label:'Lead → Won',n:1,median_days:8}],aging:[{stage:'MQL',people:1,valid_dates:1,median_days:100,over_90_days:1}],missing_acquisition_dates:0,
};
const populated = renderToStaticMarkup(React.createElement(Dashboard,{filters,report}));
for (const expected of ['50.0%','Source quality and closing speed','Original UTM source','Latest UTM source','valid pairs n=1','1 of 2 MQLs have no recorded SQL milestone','2 of 4 people lack the selected source field']) assert.ok(populated.includes(expected), expected);
assert.ok(populated.includes('Unknown'));
assert.ok(!populated.includes('NaN') && !populated.includes('Infinity'));
console.log('Marketo database component renders verified: unavailable stays unavailable; source shares, source quality, velocity, filters and diagnostic actions preserve fixture semantics. This is component QA, not live Marketo reporting.');
