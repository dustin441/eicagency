import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const NsiYtdEmailSection = createRequire(import.meta.url)('../components/NsiYtdEmailSection.tsx').default;
import type { EmailMetrics, EmailSnapshot } from './nsi-ytd-email.ts';
// tsx uses the repository's preserved JSX setting outside the Next compiler.
Object.assign(globalThis, { React });
const metrics = (name: string, sent: number): EmailMetrics => ({ campaign_name: name, total_sent: sent, total_delivered: sent, unique_opened: 5, unique_clicked: 2, unique_open_rate: .5, unique_click_rate: .2, click_through_rate: .4, delivery_rate: 1, unsubscribe_rate: .01, spam_report_rate: 0 });
function fixture(): EmailSnapshot {
  return { extractedAt: '2026-11-01T00:00:00Z', periods: { current: { startDate: '2026-01-01', endDate: '2026-10-31' }, previous: { startDate: '2025-01-01', endDate: '2025-10-31' } }, rows: ['CCF-CON-SYNTHETIC', 'CCF-END-EZL', 'CCF-PEN-SYNTHETIC', 'CON-END-DRAFT', 'NEL-CON-UNSENT', 'CON-END-HISTORICAL'].map((name, i) => ({ guid: String(i), name, current: i === 5 ? null : metrics(name, i === 3 || i === 4 ? 0 : 10), previous: metrics(name, 123) })) };
}
test('real email render shares customer-only headline and table scope with no historical sends', () => {
  const data = fixture();
  const html = renderToStaticMarkup(React.createElement(NsiYtdEmailSection, { data }));
  assert.match(html, /CCF-CON-SYNTHETIC/);
  assert.doesNotMatch(html, /CCF-END-EZL|CCF-PEN-SYNTHETIC|CON-END-DRAFT|NEL-CON-UNSENT|CON-END-HISTORICAL|Sent 2025|>123</);
  assert.equal((html.match(/>10</g) ?? []).length, 4, 'headline and table show only qualifying sent/delivered');
  for (const heading of ['Sent', 'Delivered', 'Opens', 'Clicks', 'Unsubscribe rate']) assert.ok(html.includes(heading));
  assert.match(html, /1.00%/);
  assert.equal(data.rows.length, 6);
});
test('empty current customer scope has an explicit empty state, not historical fallback', () => {
  const data = fixture(); data.rows = data.rows.slice(1);
  const html = renderToStaticMarkup(React.createElement(NsiYtdEmailSection, { data }));
  assert.match(html, /No qualifying current-year product campaign sends/);
  assert.doesNotMatch(html, /CON-END-HISTORICAL|>123</);
});
