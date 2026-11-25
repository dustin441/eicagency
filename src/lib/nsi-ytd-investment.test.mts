import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseInvestmentSnapshot, buildInvestmentModel } from './nsi-ytd-investment.ts';

const fixture = () => ({ basis: 'approved-workbook', sourceLabel: 'Synthetic workbook', sourceUrl: 'https://docs.google.com/spreadsheets/d/synthetic', current: { start: '2026-01-01', end: '2026-10-31', paidMedia: 100.25, technology: 49.75 }, previous: { start: '2025-01-01', end: '2025-10-31', paidMedia: 80, technology: 20 } });
test('approved workbook parses without changing precision and models combined revenue against media plus tech', () => {
  const snapshot = parseInvestmentSnapshot(JSON.stringify(fixture()));
  assert.deepEqual(snapshot, fixture());
  assert.deepEqual(buildInvestmentModel(30000, 10000, snapshot), { current: { paidMedia: 100.25, technology: 49.75, total: 150, roas: 2 }, previous: { paidMedia: 80, technology: 20, total: 100, roas: 1 } });
});

test('strict parser rejects malformed shape, periods, URLs and invalid numbers with generic errors', () => {
  const invalid = [null, {}, { ...fixture(), extra: true }, { ...fixture(), basis: 'actuals' }, { ...fixture(), sourceLabel: ' ' }];
  for (const sourceUrl of ['http://docs.google.com/spreadsheets/d/synthetic', 'https://docs.google.com.evil.test/spreadsheets/d/synthetic', 'https://docs.google.com/document/d/synthetic', 'https://evil.test/spreadsheets/d/synthetic', 'https://user:pass@docs.google.com/spreadsheets/d/synthetic']) invalid.push({ ...fixture(), sourceUrl });
  for (const paidMedia of [-1, '12', null, Infinity, NaN]) invalid.push({ ...fixture(), current: { ...fixture().current, paidMedia } });
  invalid.push({ ...fixture(), previous: { ...fixture().previous, end: '2025-11-30' } });
  invalid.push({ ...fixture(), current: { ...fixture().current, extra: 1 } });
  for (const value of invalid) assert.throws(() => parseInvestmentSnapshot(JSON.stringify(value)), { message: 'NSI YTD investment configuration is invalid' });
  assert.throws(() => parseInvestmentSnapshot('private-invalid-json'), { message: 'NSI YTD investment configuration is invalid' });
});
test('missing revenue or costs, zero denominators, and overflow never become fake returns', () => {
  const empty = { paidMedia: null, technology: null, total: null, roas: null };
  assert.deepEqual(buildInvestmentModel(1, 1, null), { current: empty, previous: empty });
  const snapshot = parseInvestmentSnapshot(JSON.stringify(fixture()));
  assert.equal(buildInvestmentModel(null, NaN, snapshot).current.roas, null);
  assert.equal(buildInvestmentModel(null, NaN, snapshot).previous.roas, null);
  assert.equal(buildInvestmentModel(-1, Infinity, snapshot).current.roas, null);
  assert.equal(buildInvestmentModel(-1, Infinity, snapshot).previous.roas, null);
  snapshot.current.paidMedia = 0; snapshot.current.technology = 0;
  assert.equal(buildInvestmentModel(10, 10, snapshot).current.roas, null);
  snapshot.current.paidMedia = Number.MAX_VALUE; snapshot.current.technology = Number.MAX_VALUE;
  assert.equal(buildInvestmentModel(10, 10, snapshot).current.total, null);
  snapshot.current.paidMedia = Number.MIN_VALUE; snapshot.current.technology = 0;
  assert.equal(buildInvestmentModel(Number.MAX_VALUE, 10, snapshot).current.roas, null);
  assert.equal(buildInvestmentModel(0, 0, parseInvestmentSnapshot(JSON.stringify(fixture()))).current.roas, 0);
});

test('investment config stays server-only, optional and absent-safe with updated scenario disclosure', () => {
  const service = readFileSync(new URL('../services/nsi-ytd.ts', import.meta.url), 'utf8');
  assert.match(service, /import 'server-only'/);
  assert.match(service, /investment\?: InvestmentSnapshot \| null/);
  assert.match(service, /process.env.NSI_YTD_INVESTMENT_SNAPSHOT_JSON/);
  assert.match(service, /rawInvestment === undefined \? null : parseInvestmentSnapshot\(rawInvestment\)/);
  assert.match(service, /return \{[^]*investment,/);
  assert.match(service, /workbook Paid Media plus Tech Stack/);
  const client = readFileSync(new URL('../components/NsiYtdClient.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /NSI_YTD_INVESTMENT_SNAPSHOT_JSON/);
});
