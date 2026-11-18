import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEmailRows, customerEmailRows, type EmailCampaignRow, type EmailMetrics } from './nsi-ytd-email.ts';
const row = (name: string, sent: number): EmailCampaignRow => {
  const current: EmailMetrics = { campaign_name: name, total_sent: sent, total_delivered: sent, unique_opened: 1, unique_clicked: 0, unique_open_rate: null, unique_click_rate: null, click_through_rate: null, delivery_rate: null, unsubscribe_rate: null, spam_report_rate: null };
  return { guid: name, name, current, previous: null };
};
test('owner-excluded email groups do not contribute rows or headline totals; similar names remain', () => {
  // Synthetic metrics only. Exact names are explicit presentation rules, not send-count thresholds.
  const rows = [row('CON-CON-MCH', 17), row('CCF-CON-BPT', 19), row('CCF-CON-BPT2', 7), row('CCF-CON-SYNTHETIC', 11)];
  const before = structuredClone(rows);
  const visible = customerEmailRows(rows);
  assert.deepEqual(visible.map(x => x.name), ['CCF-CON-BPT2', 'CCF-CON-SYNTHETIC']);
  assert.equal(aggregateEmailRows(visible, 'current').sent, rows[2].current!.total_sent! + rows[3].current!.total_sent!);
  assert.equal(aggregateEmailRows(visible, 'current').delivered, rows[2].current!.total_delivered! + rows[3].current!.total_delivered!);
  assert.equal(customerEmailRows([row('  ccf-con-bpt  ', 5), row('con-con-mch', 5)]).length, 0);
  assert.deepEqual(rows, before);
});
