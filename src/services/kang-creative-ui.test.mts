import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { buildKangCreatives } from './kang-creatives.ts';
import type { KangRow } from './kang-metrics.ts';
import { formatTraffic, sortTrafficCreatives, weightedTrafficCtr } from '../lib/creative-traffic.ts';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Load TS/TSX with the project's TypeScript compiler. Stub only the server boundary/client factory.
function load(file: string, stubs: Record<string, unknown> = {}): unknown {
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  const localRequire = (id: string): unknown => {
    if (id in stubs) return stubs[id];
    if (id.startsWith('.') || id.startsWith('@/')) {
      const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
        try { if (readFileSync(candidate).length) return load(candidate, stubs); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}
const row = (extra: Partial<KangRow> = {}): KangRow => ({ account_id: '1683292242584249', date: '2026-11-19', campaign_id: 'c', campaign_name: 'Campaign', adset_id: 's', adset_name: 'Set', ad_id: 'a', ad_name: 'Ad A', impressions: 100, clicks: 999, link_clicks: 10, cost: 1.25, landing_page_views: 5, updated_at: null, ...extra });

test('traffic formatting, weighted header and sorting preserve cents, true zero and missing metrics', () => {
  const ads = buildKangCreatives([row(), row({ ad_id: 'b', cost: 3.75, impressions: 900, link_clicks: 20 }), row({ ad_id: 'missing', cost: null }), row({ ad_id: 'zero', cost: 0 })], []);
  assert.equal(formatTraffic(.125, 'money'), '$0.13');
  assert.equal(formatTraffic(0, 'money'), '$0.00');
  assert.equal(formatTraffic(null, 'money'), 'N/A');
  assert.equal(weightedTrafficCtr(ads.slice(0, 2)), 3);
  assert.deepEqual(sortTrafficCreatives(ads, 'linkCpc').map(a => a.adId), ['zero', 'a', 'b', 'missing']);
});

test('server scopes both queries, only enriches selected fact IDs, metadata failure preserves summary', async () => {
  const params = { start: '2026-11-19', end: '2026-11-20' };
  async function fetch(failMetadata: boolean) {
    const calls: unknown[][] = [];
    const client = { from(table: string) {
      const chain = {
        select(value: string) { calls.push([table, 'select', value]); return chain; },
        eq(...args: unknown[]) { calls.push([table, 'eq', ...args]); return chain; },
        gte(...args: unknown[]) { calls.push([table, 'gte', ...args]); return chain; },
        lte(...args: unknown[]) { calls.push([table, 'lte', ...args]); return chain; },
        order() { return chain; },
        range() { return Promise.resolve({ data: [row()], error: null }); },
        in(...args: unknown[]) { calls.push([table, 'in', ...args]); return Promise.resolve(failMetadata ? { data: null, error: { message: 'missing table' } } : { data: [{ account_id: row().account_id, ad_id: 'a', headline: 'Current headline' }], error: null }); },
      };
      return chain;
    } };
    const service = load(path.join(root, 'services/kang-analytics.ts'), { 'server-only': {}, '@/lib/spartaco-supabase-server': { createEicSupabaseClient: () => client } }) as typeof import('./kang-analytics');
    return { result: await service.fetchKangData(params), calls };
  }
  const success = await fetch(false);
  const failure = await fetch(true);
  assert.equal(failure.result.status, 'ready');
  assert.equal(failure.result.creativeMetadataStatus, 'unavailable');
  assert.deepEqual(failure.result.summary, success.result.summary);
  assert.deepEqual(failure.result.creatives[0].traffic, success.result.creatives[0].traffic);
  assert.equal(failure.result.creatives[0].headline, '');
  assert.equal(success.result.creatives[0].headline, 'Current headline');
  assert.ok(success.calls.some(c => JSON.stringify(c) === JSON.stringify(['kang_meta_daily', 'gte', 'date', params.start])));
  assert.ok(success.calls.some(c => JSON.stringify(c) === JSON.stringify(['kang_meta_daily', 'lte', 'date', params.end])));
  for (const table of ['kang_meta_daily', 'kang_meta_creatives']) assert.ok(success.calls.some(c => JSON.stringify(c) === JSON.stringify([table, 'eq', 'account_id', row().account_id])));
  assert.ok(success.calls.some(c => JSON.stringify(c) === JSON.stringify(['kang_meta_creatives', 'in', 'ad_id', ['a']])));
});

test('shared card renders real metadata and traffic only, legacy lead and sales modes stay intact', () => {
  const { MetaAdPreviews } = load(path.join(root, 'components/AdPreviews.tsx')) as typeof import('../components/AdPreviews');
  const creatives = buildKangCreatives([row()], [{ account_id: row().account_id, ad_id: 'a', image_url: 'https://example.com/creative.jpg', primary_text: 'Real copy', headline: 'Real headline', destination_url: 'https://example.com/landing', cta_type: 'SHOP_NOW' }]);
  const traffic = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives, metricMode: 'traffic', showAdIdentity: true }));
  for (const text of ['creative.jpg', 'Real copy', 'Real headline', 'Shop Now', 'example.com/landing', 'Link clicks', 'Link CTR', 'CPC (link)', 'Landing page views', 'Cost per LPV', '$1.25', 'Preview', 'Table', 'Ad ID:']) assert.ok(traffic.includes(text), text);
  for (const text of ['ROAS', 'Leads', 'CPL', 'Sales']) assert.ok(!traffic.includes(text), text);
  const missing = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives: buildKangCreatives([row()], []), metricMode: 'traffic' }));
  assert.ok(missing.includes('Creative image unavailable'));
  assert.ok(missing.includes('CTA unavailable'));
  const lead = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives: [{ ...creatives[0], leads: 5 }] }));
  assert.ok(lead.includes('Leads')); assert.ok(lead.includes('CPL')); assert.ok(!lead.includes('Landing page views'));
  const sales = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives: [{ ...creatives[0], sales: 2, revenue: 100 }], metricMode: 'sales', salesCac: true }));
  assert.ok(sales.includes('Sales')); assert.ok(sales.includes('CAC')); assert.ok(sales.includes('ROAS'));
});
