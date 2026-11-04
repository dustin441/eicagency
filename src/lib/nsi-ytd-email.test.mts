import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEmailRows, emailSendChange, parseEmailSnapshot, partitionEmailRows, type EmailMetrics, type EmailSnapshot } from './nsi-ytd-email.ts';
// Deliberately synthetic fixtures only. Client reporting facts are never committed.
function metrics(name: string, sent = 100, delivered = 90, opened = 40, clicked = 9): EmailMetrics {
  return { campaign_name: name, total_sent: sent, total_delivered: delivered, unique_opened: opened, unique_clicked: clicked, unique_open_rate: opened / delivered, unique_click_rate: clicked / delivered, click_through_rate: clicked / opened, delivery_rate: delivered / sent, unsubscribe_rate: 0, spam_report_rate: 0 };
}
function fixture(): EmailSnapshot {
  const a = 'CCF-CON-SYNTHETIC_A', b = 'CON-END-SYNTHETIC_B', c = 'NEL-CON-SYNTHETIC_C';
  return { extractedAt: '2026-11-01T00:00:00.000Z', periods: { current: { startDate: '2026-01-01', endDate: '2026-10-31' }, previous: { startDate: '2025-01-01', endDate: '2025-10-31' } }, rows: [
    { guid: '00000000-0000-4000-8000-000000000001', name: a, current: metrics(a), previous: metrics(a, 50, 45, 20, 3) },
    { guid: '00000000-0000-4000-8000-000000000002', name: b, current: metrics(b, 200, 180, 10, 2), previous: null },
    { guid: '00000000-0000-4000-8000-000000000003', name: c, current: null, previous: metrics(c) },
  ] };
}
test('protected snapshot parser preserves fixed periods and historical missingness', () => {
  const data = fixture(), parsed = parseEmailSnapshot(JSON.stringify(data));
  assert.deepEqual(parsed, data);
  assert.deepEqual(partitionEmailRows(parsed.rows), { current: parsed.rows.filter(r => r.current !== null), historical: parsed.rows.filter(r => r.current === null) });
});
test('snapshot parser projects known fields and drops extra configuration metadata', () => {
  const data = { ...fixture(), privateMetadata: 'not for client props' };
  assert.equal(Object.hasOwn(parseEmailSnapshot(JSON.stringify(data)), 'privateMetadata'), false);
});
test('snapshot parser fails closed for wrong windows, scope, identity, counts and rates', () => {
  const mutations: Array<(data: EmailSnapshot) => void> = [
    d => { d.periods.current.endDate = '2026-11-30'; },
    d => { d.rows.push(d.rows[0]); },
    d => { d.rows[0].name = 'INTERNAL-SYNTHETIC'; },
    d => { d.rows[0].guid = 'not-a-guid'; },
    d => { d.rows[0].current!.campaign_name = 'CON-END-DIFFERENT'; },
    d => { d.rows[0].current = null; d.rows[0].previous = null; },
    d => { d.rows[0].current!.total_sent = -1; },
    d => { d.rows[0].current!.total_sent = 1.5; },
    d => { d.rows[0].current!.unique_click_rate = 2; },
    d => { d.rows[0].current!.unique_clicked = 10000; },
    d => { d.rows[0].current!.total_sent = 1; },
    d => { d.extractedAt = 'not-a-date'; },
    d => { d.rows = []; },
  ];
  for (const mutate of mutations) { const data = fixture(); mutate(data); assert.throws(() => parseEmailSnapshot(JSON.stringify(data)), /Invalid NSI YTD email snapshot/); }
  for (const raw of ['', 'null', '[]', '{}', '{invalid']) assert.throws(() => parseEmailSnapshot(raw));
});
test('aggregate counts conserve returned groups, never reconstruct missing groups', () => {
  const rows = fixture().rows;
  for (const period of ['current', 'previous'] as const) {
    const expected = rows.flatMap(r => r[period] ? [r[period]!] : []).reduce((sum, m) => sum + m.total_sent!, 0);
    assert.equal(aggregateEmailRows(rows, period).sent, expected);
  }
});
test('aggregate rates use count weighting, not averages of group rates', () => {
  const rows = fixture().rows, a = aggregateEmailRows(rows, 'current');
  const native = rows.flatMap(r => r.current ? [r.current] : []);
  assert.equal(a.clickRate, a.clicked! / a.delivered!);
  assert.equal(a.openRate, a.opened! / a.delivered!);
  assert.notEqual(a.clickRate, native.reduce((sum, m) => sum + m.unique_click_rate!, 0) / native.length);
});
test('zero and missing baselines or denominators do not produce infinite changes', () => {
  assert.equal(emailSendChange(1, 0), null);
  assert.equal(emailSendChange(1, null), null);
  assert.equal(emailSendChange(null, 1), null);
  assert.equal(emailSendChange(0, 1), -1);
  assert.equal(emailSendChange(3, 2), (3 - 2) / 2);
  assert.equal(aggregateEmailRows([], 'current').clickRate, null);
  const row = fixture().rows[0];
  assert.equal(aggregateEmailRows([{ ...row, current: { ...row.current!, total_delivered: 0, unique_clicked: 0 } }], 'current').clickRate, null);
  assert.equal(aggregateEmailRows([{ ...row, current: { ...row.current!, total_sent: null } }], 'current').sent, null);
});
test('native click rate remains clicks/delivered, distinct from click-to-open', () => {
  for (const row of fixture().rows) for (const period of ['current', 'previous'] as const) {
    const m = row[period]; if (!m) continue;
    assert.equal(m.unique_click_rate, m.unique_clicked! / m.total_delivered!);
    assert.equal(m.click_through_rate, m.unique_clicked! / m.unique_opened!);
    assert.notEqual(m.unique_click_rate, m.click_through_rate);
  }
});
