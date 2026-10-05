import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
const count = (needle) => source.split(needle).length - 1;

const overall = source.slice(source.indexOf('export async function fetchDashboardData'), source.indexOf('// ─── fetchPrepassWeeklyExecutiveReadout'));
const focus = source.slice(source.indexOf('export async function fetchFocusData'), source.indexOf('// ─── fetchDashboardData'));
const creatives = source.slice(source.indexOf('async function fetchPrepassPmaxByFocus'), source.indexOf('// ─── PrePass GA4 performance'));

assert.match(overall, /async function mmpQ[\s\S]*fetchCompleteRows[\s\S]*\.range\(from, to\)/, 'Overall MMP reads must paginate');
assert.match(overall, /async function linkedInQ[\s\S]*fetchCompleteRows[\s\S]*\.order\('campaign_id'\)\.order\('id'\)\.range\(from, to\)/, 'Overall LinkedIn reads must paginate with stable identity tie-breakers');
assert.ok((overall.match(/fetchCompleteRows<Record<string, unknown>>/g) ?? []).length >= 5, 'Overall dashboard must page MMP, LinkedIn, enrollment, won, and extensions');
assert.ok((focus.match(/fetchCompleteRows<Record<string, unknown>>/g) ?? []).length >= 6, 'Focus dashboards must page timing, extensions, and creative sources');
assert.doesNotMatch(focus, /meta_ads_creatives[\s\S]{0,500}\.limit\(200\)/, 'Meta creative totals must not use a top-row cap');
assert.doesNotMatch(focus, /google_search_ads_creatives[\s\S]{0,500}\.limit\(100\)/, 'Google creative totals must not use a top-row cap');
assert.match(creatives, /google_pmax_creatives[\s\S]*\.range\(from, to\)/, 'PMax creatives must paginate');
assert.ok(count(".from('enrollment')") >= 2 && count(".from('enrollment_won')") >= 2, 'Both dashboard paths must retain stage timing sources');

console.log('PASS: PrePass dashboard full-population retrieval safeguards');
