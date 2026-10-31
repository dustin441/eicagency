import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStackAdaptDelivery } from './eic-stackadapt-core.ts';

const record = (id = '3432126', advertiser = '150300') => ({ campaign: { id, name: 'EIC | Display | ABM', advertiser: { id: advertiser, name: 'EIC Agency' } }, granularity: { time: '2026-10-23' }, metrics: { cost: '17.24794', impressionsBigint: '3545', clicksBigint: '4' } });
const response = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null, totalCount = nodes.length) => ({ data: { advertisers: { nodes: [{ id: '150300', name: 'EIC Agency' }] }, campaignDelivery: { __typename: 'CampaignDeliveryOutcome', records: { nodes, pageInfo: { hasNextPage, endCursor }, totalCount } } } });

test('reads official advertiser-scoped daily delivery, paginates and preserves cost precision without inventing leads', async () => {
 const calls: any[] = [];
 const request = async (query: string, variables: any) => { calls.push({ query, variables }); return calls.length === 1 ? response([record()], true, 'next', 2) : response([record('3432127')], false, 'end', 2); };
 const rows = await fetchStackAdaptDelivery('2026-10-01', '2026-10-31', request);
 assert.equal(rows.length, 2);
 assert.equal(rows[0].cost, 17.24794);
 assert.equal(rows[0].clicks, 4);
 assert.equal(rows[0].impressions, 3545);
 assert.equal(rows[0].source, 'StackAdapt');
 assert.equal(rows[0].conversions, null);
 assert.equal(rows[0].purchases, null);
 assert.equal(calls[1].variables.after, 'next');
 assert.match(calls[0].query, /advertiserIds:\s*\["150300"\]/);
 assert.match(calls[0].query, /granularity:\s*DAILY/);
 assert.deepEqual(calls[0].variables.date, { from: '2026-10-01', to: '2026-11-01' });
});

test('fails closed on wrong advertiser, upstream errors, partial pages, duplicates, invalid metrics and dates', async () => {
 const good = response([record()]);
 const cases = [
  response([record('other', '130362')]),
  { ...good, errors: [{ message: 'private upstream details' }] },
  response([record()], false, null, 2),
  response([record(), record()]),
  response([{ ...record(), metrics: { ...record().metrics, cost: null } }]),
  response([{ ...record(), granularity: { time: '2026-09-30' } }]),
  response([{ ...record(), metrics: { ...record().metrics, impressionsBigint: 'not a number' } }]),
 ];
 for (const value of cases) await assert.rejects(fetchStackAdaptDelivery('2026-10-01', '2026-10-31', async () => value as any), /temporarily unavailable/);
 await assert.rejects(fetchStackAdaptDelivery('bad', '2026-10-31', async () => good), /temporarily unavailable/);
 await assert.rejects(fetchStackAdaptDelivery('2026-10-31', '2026-10-01', async () => good), /temporarily unavailable/);
 let calls = 0;
 await assert.rejects(fetchStackAdaptDelivery('2026-10-01', '2026-10-31', async () => { calls++; return response([record(String(calls))], true, 'repeated', 4); }), /temporarily unavailable/);
 assert.equal(calls, 2);
});
