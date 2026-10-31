import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderDashboard(data: any) {
  const source = readFileSync(new URL('../components/EicAgencyDashboardClient.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, require(id: string) {
    if (id.includes('FilterBar')) return { default: ({ channelOptions }: any) => React.createElement('select', {}, channelOptions?.map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label))), __esModule: true };
    if (id.includes('AdPreviews')) return { MetaAdPreviews: () => null };
    return require(id);
  }});
  return renderToStaticMarkup(React.createElement(exports.default, { data, isAdmin: false, updateBudget: async () => ({}) }));
}

async function dashboard(overrides = {}, fail = false) {
  const calls: string[][] = [];
  const row = (source: string, cost: number, conversions: number | null) => ({ date: '2026-09-10', campaign_name: 'Agency', source, cost, conversions, purchases: null, impressions: 100, clicks: 10 });
  const db = { from(table: string) {
    let fields = ''; const filters: [string, string][] = [];
    const q: any = new Proxy({}, { get(_t, key) {
      if (key === 'then') return (resolve: any) => {
        let data: any[] = table === 'eicagency_master' ? [row('Meta', 100, 5), row('Google', 50, 2), row('StackAdapt', 999, 99)] : [];
        for (const [field, value] of filters) data = data.filter(r => r[field] === value);
        if (fields === 'date,source,cost') data = data.filter(r => r.source !== 'StackAdapt');
        resolve({ data, error: null });
      };
      return (...args: any[]) => { if (key === 'select') fields = args[0]; if (key === 'eq') filters.push(args as [string, string]); return q; };
    }}); return q;
  }};
  const source = readFileSync(new URL('./eicagency-analytics.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, Promise, require(id: string) {
    if (id.includes('spartaco-supabase')) return { createSpartacoSupabaseClient: () => db };
    if (id.includes('eic-stackadapt')) return { fetchEicStackAdaptRows: async (start: string, end: string) => { calls.push([start, end]); if (fail) throw new Error('private upstream detail'); return [row('StackAdapt', 25, null)]; } };
    if (id.includes('lead-magnets')) return { campaignMatchesExactNames: (name: string, names: string[]) => names.includes(name) };
    if (id.includes('date-utils')) return {};
    throw new Error(`Unexpected import ${id}`);
  }});
  const data = await exports.fetchEicAgencyDashboardData({ start: '2026-09-01', end: '2026-09-30', compStart: '2026-08-01', compEnd: '2026-08-31', channel: 'all', ...overrides });
  return { data, calls };
}

test('preserves Meta/Google channel filters and keeps pacing all-channel/current-month', async () => {
  for (const [channel, spend] of [['Meta', 100], ['Google', 50], ['StackAdapt', 25]] as const) {
    const { data, calls } = await dashboard({ channel });
    assert.equal(data.filterParams.channel, channel);
    assert.equal(data.summary.spend, spend);
    assert.equal(data.prevSummary.spend, spend);
    assert.equal(data.budgetPacing.totalSpend, 175);
    assert.equal(data.channelRows.length, 1);
    assert.equal(data.channelRows[0].channel, channel);
    assert.ok(calls.some(([start, end]) => start === data.budgetPacing.monthStart && end === data.budgetPacing.monthEnd));
    assert.equal(calls.length, channel === 'StackAdapt' ? 3 : 1);
  }
});

test('fixed MOF and exact lead-magnet scopes request DSP only for global pacing', async () => {
  for (const scope of [{ campaignFilter: 'MOF' }, { campaignNames: ['Agency'] }]) {
    const { data, calls } = await dashboard(scope);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], data.budgetPacing.monthStart);
    assert.ok(data.channelRows.every((r: any) => r.channel !== 'StackAdapt'));
    assert.ok(data.campaignRows.every((r: any) => r.channel !== 'StackAdapt'));
    assert.equal(data.budgetPacing.stackadaptSpend, 25);
  }
});

test('fails closed with generic text rather than returning partial totals or upstream details', async () => {
  await assert.rejects(dashboard({}, true), { message: 'EIC paid-media data is unavailable. Please try again.' });
});

test('merges direct StackAdapt delivery into both periods, excludes warehouse duplicates and preserves leads', async () => {
  const { data, calls } = await dashboard();
  assert.equal(data.summary.spend, 175);
  assert.equal(data.prevSummary.spend, 175);
  assert.equal(data.summary.leads, 7);
  assert.equal(data.summary.cpl, 150 / 7, 'DSP spend must not inflate measured-lead CPL');
  assert.equal(data.prevSummary.cpl, 150 / 7);
  assert.equal(data.timeSeries[0].leadSpend, 150);
  assert.equal(data.channelRows.find((r: any) => r.channel === 'StackAdapt').spend, 25);
  assert.equal(data.campaignRows.find((r: any) => r.channel === 'StackAdapt').spend, 25);
  assert.equal(data.budgetPacing.stackadaptSpend, 25);
  assert.equal(data.budgetPacing.totalSpend, 175);
  assert.equal(data.dataFreshness.stackadaptThrough, '2026-09-10');
  assert.equal(calls.length, 3);
});

test('renders EIC channel options, purple DSP badges, pacing and freshness without inventing DSP leads or GA4', async () => {
  const { data } = await dashboard({ channel: 'StackAdapt' });
  const html = renderDashboard(data);
  assert.match(html, /<option value="StackAdapt">StackAdapt<\/option>/);
  assert.match(html, /Meta \+ Google \+ StackAdapt Performance/);
  assert.match(html, /StackAdapt through 2026-09-10/);
  assert.match(html, /text-purple-700/);
  assert.match(html, /bg-purple-50\/60/);
  assert.match(html, /Platform Leads<\/p>.*?N\/A/);
  assert.match(html, /Platform CPL<\/p>.*?N\/A/);
  const campaign = html.split('Campaign Performance')[1];
  assert.equal((campaign.match(/>N\/A</g) ?? []).length, 7, 'five GA4 metrics plus leads and CPL must be unavailable');
  assert.match(html, /Meta\/Google spend only/);
});

test('EIC error boundary renders generic retry without serializing the exception', () => {
  const source = readFileSync(new URL('../app/dashboard/eicagency/error.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, { exports, require });
  const html = renderToStaticMarkup(React.createElement(exports.default, { error: new Error('private upstream detail'), reset: () => {} }));
  assert.match(html, /EIC paid-media data is unavailable/);
  assert.match(html, />Retry</);
  assert.doesNotMatch(html, /private upstream detail/);
});

test('trend CPL excludes DSP spend across daily and weekly buckets', () => {
  const source = readFileSync(new URL('../components/EicAgencyDashboardClient.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: any = {};
  vm.runInNewContext(code + '\nexports.bucketData = bucketData;', { exports, require: (id: string) => id.startsWith('@/') ? {} : require(id) });
  for (const type of ['daily', 'weekly']) {
    const [point] = exports.bucketData([{ label: '2026-09-10', spend: 175, leadSpend: 150, impressions: 300, clicks: 30, leads: 7 }], type);
    assert.equal(point.cpl, 150 / 7);
    assert.equal(point.spend, 175);
  }
});
