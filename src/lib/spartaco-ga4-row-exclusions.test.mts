import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterGa4ExcludedRows, validateGa4ExcludedRows, ga4ExcludedRowSchema } from './spartaco-ga4-row-exclusions.ts';

const exclusion = { date: '2026-02-04', pagePath: '/synthetic', source: 'search', medium: 'paid', channelGroup: 'Paid Search' };
const scope = {
  beforeStart: '2026-02-01', beforeEnd: '2026-02-02',
  campaignStart: '2026-02-04', campaignEnd: '2026-02-05',
  afterStart: '2026-02-07', afterEnd: '2026-02-08',
  sourceMediumPagePaths: ['/synthetic'], ga4ExcludedRows: [exclusion],
};
const row = { date: exclusion.date, page_path: exclusion.pagePath, ga4_source: exclusion.source,
  ga4_medium: exclusion.medium, ga4_default_channel_group: exclusion.channelGroup, ga4_sessions: 7 };

test('opt-in only; preserve array identity without exclusions', () => {
  const rows = [row];
  assert.equal(filterGa4ExcludedRows({ ...scope, ga4ExcludedRows: undefined }, rows), rows);
  assert.equal(filterGa4ExcludedRows({ ...scope, ga4ExcludedRows: [] }, rows), rows);
  assert.equal(filterGa4ExcludedRows(scope, rows).length, 0);
});
test('exact five-dimensional matching, no trailing slash/case/null normalization', () => {
  const survivors = [
    { ...row, date: '2026-02-05' }, { ...row, page_path: '/synthetic/' },
    { ...row, ga4_source: 'Search' }, { ...row, ga4_medium: 'organic' },
    { ...row, ga4_default_channel_group: 'Organic Search' }, { ...row, ga4_source: null },
  ];
  assert.deepEqual(filterGa4ExcludedRows(scope, [row, ...survivors, { ...row }]), survivors);
});
test('reject strict shape, invalid calendar dates, null and blank dimension values', () => {
  for (const invalid of [{ ...exclusion, extra: true }, { ...exclusion, date: '2026-02-30' },
    { ...exclusion, source: null }, { ...exclusion, medium: '' }, { ...exclusion, pagePath: 'synthetic' }]) {
    assert.equal(ga4ExcludedRowSchema.safeParse(invalid).success, false);
  }
});
test('reject out-of-scope dates, period gaps, paths and duplicate keys', () => {
  for (const change of [{ date: '2025-02-04' }, { date: '2026-02-03' }, { pagePath: '/other' }]) {
    assert.throws(() => validateGa4ExcludedRows({ ...scope, ga4ExcludedRows: [{ ...exclusion, ...change }] }));
  }
  assert.throws(() => validateGa4ExcludedRows({ ...scope, ga4ExcludedRows: [exclusion, exclusion] }));
});
test('scope validation uses whole report, not current fetch; preserve unrelated period', () => {
  const before = { ...row, date: '2026-02-01' };
  assert.deepEqual(filterGa4ExcludedRows(scope, [before]), [before]);
});
test('scoped page rules honor all restrictions', () => {
  const scoped = { ...scope, sourceMediumPagePaths: [], sourceMediumScopedPageRules: [{
    pagePath: '/synthetic', sources: ['search'], mediums: ['paid'], channelGroups: ['Paid Search'],
    start: '2026-02-04', end: '2026-02-04',
  }] };
  assert.doesNotThrow(() => validateGa4ExcludedRows(scoped));
  for (const change of [{ source: 'other' }, { medium: 'other' }, { channelGroup: 'Other' }, { date: '2026-02-05' }]) {
    assert.throws(() => validateGa4ExcludedRows({ ...scoped, ga4ExcludedRows: [{ ...exclusion, ...change }] }));
  }
});
test('missing projected dimensions fail closed only for opted-in reports', () => {
  const missing = { ...row }; delete (missing as Partial<typeof row>).page_path;
  assert.throws(() => filterGa4ExcludedRows(scope, [missing]));
  assert.doesNotThrow(() => filterGa4ExcludedRows({ ...scope, ga4ExcludedRows: undefined }, [missing]));
});
test('JSON tuple encoding cannot collide on embedded separators', () => {
  const special = { ...scope, ga4ExcludedRows: [{ ...exclusion, source: 'a|b', medium: 'c' }] };
  const survivor = { ...row, ga4_source: 'a', ga4_medium: 'b|c' };
  assert.deepEqual(filterGa4ExcludedRows(special, [survivor]), [survivor]);
});
test('loader projects page_path and filters once before returning to all consumers', () => {
  const source = readFileSync(new URL('../services/spartaco-product-wrapups.ts', import.meta.url), 'utf8');
  assert.match(source, /LANDING_PAGE_GA4_SELECT = 'date,page_path,/);
  const loader = source.slice(source.indexOf('async function fetchLandingPageGa4Rows('), source.indexOf('async function fetchWrapupSocialRows('));
  assert.match(loader, /validateGa4ExcludedRows\(config\);/);
  assert.match(loader, /return filterGa4ExcludedRows\(config, rows\);/);
  assert.equal((loader.match(/\.select\(LANDING_PAGE_GA4_SELECT\)/g) ?? []).length, 2);
});
