import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as email from './nsi-ytd-email.ts';
import type { EmailCampaignRow, EmailMetrics } from './nsi-ytd-email.ts';
const client = readFileSync(new URL('../components/NsiYtdClient.tsx', import.meta.url), 'utf8');
const section = readFileSync(new URL('../components/NsiYtdEmailSection.tsx', import.meta.url), 'utf8');
test('executive finance has three pillars and immediately follows them with the scenario', () => {
  assert.doesNotMatch(client, /label="Contractor360 revenue"|The monthly picture|This first draft/);
  assert.match(client, /xl:grid-cols-3" aria-label="Revenue by business pillar"/);
  assert.match(client, /Revenue by business pillar[^]*?<\/div>\s*<Section title=\{MODELED_ROAS_LABEL\}/);
  assert.match(client, /Revenue by business pillar"\] \{ grid-template-columns: repeat\(3,/);
});
test('form-fill scope identifies the imported landing-page action without broadening the count', () => {
  assert.match(client, /Google Ads-attributed Go\.NSI landing-page form conversions/);
  assert.match(client, /Separate main-site brand-page form actions are not included/);
  assert.doesNotMatch(client, /exact eligible-form coverage needs upstream verification/);
  assert.match(client, /current=\{b\.hubspotFormFills\}/);
});

test('sales handoff distinguishes reported scoring from outcomes and readiness-gated Q1 goal', () => {
  assert.match(client, /November 11/);
  assert.match(client, /scoring was reported updated/i);
  assert.match(client, /Q1[^]*readiness/);
  assert.doesNotMatch(client, /Updated scoring was still pending/);
});
test('summary PDF is default with opt-in detail, and incomplete-cost return has no YoY', () => {
  assert.match(client, /includeAppendix, setIncludeAppendix\] = useState\(false\)/);
  assert.match(client, /data-print-detail=\{includeAppendix \? 'full' : 'summary'\}/);
  assert.match(client, /data-print-detail="summary"\] \.nsi-ytd-appendix \{ display: none/);
  const model = client.slice(client.indexOf('<Section title={MODELED_ROAS_LABEL}'), client.indexOf('</Section>', client.indexOf('<Section title={MODELED_ROAS_LABEL}')));
  assert.doesNotMatch(model, /previous=\{/);
  assert.match(model, /Technology expenses are not included/);
});
test('email presentation contains only current customer sends without forced history', () => {
  assert.match(section, /customerEmailRows\(snapshot.rows\)/);
  assert.doesNotMatch(section, /Sent 2025|Send change|Historical-only|previous\.sent|compared with/);
  assert.match(section, /Unsubscribe rate/);
});
test('customer email scope requires observed sends and excludes internal and noncustomer groups without mutation', () => {
  const metrics = (name: string, sent: number | null): EmailMetrics => ({ campaign_name: name, total_sent: sent, total_delivered: 9, unique_opened: 3, unique_clicked: 1, unique_open_rate: 1 / 3, unique_click_rate: 1 / 9, click_through_rate: 1 / 3, delivery_rate: .9, unsubscribe_rate: 0, spam_report_rate: 0 });
  const names = ['CCF-CON-SYNTHETIC', 'CON-END-SYNTHETIC', 'NEL-CON-SYNTHETIC', 'CCF-END-EZL', 'CCF-PEN-SYNTHETIC', 'CCF-REP-SYNTHETIC', 'CCF-CON-TEST', 'CCF-CON-INTERNAL', 'CCF-CON-DRAFT', 'CCF-CON-UNSENT', 'CCF-CON-MISSING', 'CCF-CON-HISTORY'];
  const rows: EmailCampaignRow[] = names.map((name, i) => ({ guid: String(i), name, current: i === 11 ? null : metrics(name, i === 8 || i === 9 ? 0 : i === 10 ? null : 10), previous: metrics(name, 100) }));
  const before = structuredClone(rows);
  assert.equal(typeof email.customerEmailRows, 'function');
  assert.deepEqual(email.customerEmailRows(rows).map(row => row.name), names.slice(0, 3));
  assert.equal(email.aggregateEmailRows(email.customerEmailRows(rows), 'current').sent, 30);
  assert.deepEqual(rows, before);
});
