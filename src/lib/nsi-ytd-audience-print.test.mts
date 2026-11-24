import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const client = readFileSync(new URL('../components/NsiYtdClient.tsx', import.meta.url), 'utf8');

test('audience results are the final mandatory print block outside optional appendix', () => {
  assert.match(client, /<div className="nsi-ytd-print-only" aria-label="Audience type results">\s*<ActivityTable title="Audience types" open selected=\{selectedConversions\} rows=\{data\.audiences\.map\(row => \(\{ \.\.\.row, label: row\.audienceType \}\)\)\} \/>\s*<\/div>\s*<\/div>;/);
  const finalBlock = client.slice(client.indexOf('<div className="nsi-ytd-print-only" aria-label="Audience type results">'));
  assert.doesNotMatch(finalBlock, /nsi-ytd-appendix|includeAppendix|filter\(/);
  assert.ok(client.indexOf('<div className="nsi-ytd-print-only" aria-label="Audience type results">') > client.indexOf('Source coverage and review notes'));
});

test('screen audience control is retained but excluded from print to avoid duplicate audience tables', () => {
  assert.match(client, /<div className="nsi-ytd-screen-only"><ActivityTable title="Audience types" selected=\{selectedConversions\} rows=\{data\.audiences\.map\(row => \(\{ \.\.\.row, label: row\.audienceType \}\)\)\} \/><\/div>/);
});

test('mandatory audience begins on a clean final page without trailing report padding', () => {
  assert.match(client, /\.nsi-ytd-report > \[aria-label="Audience type results"\] \{ break-before: page;/);
  assert.match(client, /\.nsi-ytd-report \{ padding-bottom: 0 !important;/);
});

test('shared print renderer retains every audience, comparisons caveat and conversion precision', () => {
  assert.match(client, /table\(rows, columns/);
  assert.match(client, /Historical audience values are not like-for-like/);
  assert.match(client, /row\.suppressComparison \? 'Historical, not comparable'/);
  assert.match(client, /Conversion counts are 2026 only/);
});
