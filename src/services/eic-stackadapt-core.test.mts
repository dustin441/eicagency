import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStackAdaptDelivery, fetchStackAdaptCampaignMetrics } from './eic-stackadapt-core.ts';

const nativeRecord = (id = '3432126') => ({ campaign: { id, name: 'EIC | Display | ABM', advertiser: { id: '150300' } }, metrics: { pageStartsBigint: '11', engagementsBigint: '5', engagementRate: 22.727, ecpe: '25.8341258', totalTime: 474 } });

test('reads native campaign TOTAL onsite metrics for the full inclusive period, independently of GA4', async () => {
 const calls: any[] = [];
 const rows = await fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async (query, variables) => {
  calls.push({ query, variables });
  return response([nativeRecord()], false) as any;
 });
 assert.deepEqual(rows, [{ campaign_name: 'EIC | Display | ABM', pageStarts: 11, engagements: 5, engagementRate: 22.727, costPerEngagement: 25.8341258, totalTime: 474 }]);
 assert.match(calls[0].query, /granularity:\s*TOTAL/);
 assert.match(calls[0].query, /advertiserIds:\s*\["150300"\]/);
 for (const field of ['pageStartsBigint', 'engagementsBigint', 'engagementRate', 'ecpe', 'totalTime']) assert.ok(calls[0].query.includes(field));
 assert.doesNotMatch(calls[0].query, /ga4|DAILY/);
 assert.deepEqual(calls[0].variables, { date: { from: '2026-10-01', to: '2026-11-01' }, after: null });
});

test('native metrics preserve real zero and unavailable/invalid values as null', async () => {
 const metricsCases = [
  { pageStartsBigint: '0', engagementsBigint: 0, engagementRate: 0, ecpe: '0', totalTime: 0 },
  { pageStartsBigint: null, engagementsBigint: null, engagementRate: null, ecpe: null, totalTime: null },
  { pageStartsBigint: '', engagementsBigint: 'bad', engagementRate: -1, ecpe: Infinity, totalTime: undefined },
  { pageStartsBigint: '9007199254740992', engagementsBigint: 1.5, engagementRate: ' ', ecpe: false, totalTime: {} },
 ];
 for (const [index, metrics] of metricsCases.entries()) {
  const rows = await fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async () => response([{ ...nativeRecord(), metrics }]) as any);
  assert.deepEqual(rows[0], { campaign_name: nativeRecord().campaign.name, pageStarts: index === 0 ? 0 : null, engagements: index === 0 ? 0 : null, engagementRate: index === 0 ? 0 : null, costPerEngagement: index === 0 ? 0 : null, totalTime: index === 0 ? 0 : null });
 }
});

test('native TOTAL pagination validates ownership, completeness, cursors, duplicate campaigns and dates', async () => {
 const good = response([nativeRecord()]);
 const badIdentity = { ...good, data: { ...good.data, advertisers: { nodes: [{ id: '150300', name: 'Not EIC' }] } } };
 const cases = [
  badIdentity,
  { ...good, errors: [{ message: 'private details' }] },
  response([{ ...nativeRecord(), campaign: { ...nativeRecord().campaign, advertiser: { id: '130362' } } }]),
  response([{ ...nativeRecord(), campaign: { ...nativeRecord().campaign, id: '' } }]),
  response([{ ...nativeRecord(), campaign: { ...nativeRecord().campaign, name: '' } }]),
  response([nativeRecord(), nativeRecord()]),
  response([nativeRecord()], false, null, 2),
  response([nativeRecord()], false, null, -1),
  response([nativeRecord()], true, null, 2),
  response([], true, 'next', 2),
  { data: { ...good.data, campaignDelivery: { __typename: 'DeliveryError' } } },
  { data: { ...good.data, campaignDelivery: { ...good.data.campaignDelivery, records: { nodes: [], totalCount: 0, pageInfo: {} } } } },
 ];
 for (const value of cases) await assert.rejects(fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async () => value as any), /temporarily unavailable/);
 for (const [start, end] of [['bad', '2026-10-31'], ['2026-02-30', '2026-10-31'], ['2026-10-31', '2026-10-01']]) {
  await assert.rejects(fetchStackAdaptCampaignMetrics(start, end, async () => good as any), /temporarily unavailable/);
 }
 let calls = 0;
 const rows = await fetchStackAdaptCampaignMetrics('2026-10-31', '2026-10-31', async (_query, variables) => {
  calls++;
  assert.equal(variables.after, calls === 1 ? null : 'next');
  return response([nativeRecord(String(calls))], calls === 1, calls === 1 ? 'next' : null, 2) as any;
 });
 assert.equal(rows.length, 2);
 assert.deepEqual(await fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async () => response([]) as any), []);
 calls = 0;
 await assert.rejects(fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async () => response([nativeRecord(String(++calls))], true, 'repeat', 4) as any), /temporarily unavailable/);
 assert.equal(calls, 2);
 calls = 0;
 await assert.rejects(fetchStackAdaptCampaignMetrics('2026-10-01', '2026-10-31', async () => response([nativeRecord(String(++calls))], calls === 1, 'next', calls === 1 ? 2 : 3) as any), /temporarily unavailable/);
});

const record = (id = '3432126', advertiser = '150300') => ({ campaign: { id, name: 'EIC | Display | ABM', advertiser: { id: advertiser, name: 'EIC Agency' } }, granularity: { time: '2026-10-23' }, metrics: { cost: '17.24794', impressionsBigint: '3545', clicksBigint: '4' } });
const response = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null, totalCount = nodes.length) => ({ data: { advertisers: { nodes: [{ id: '150300', name: 'EIC Agency' }] }, campaignDelivery: { __typename: 'CampaignDeliveryOutcome', records: { nodes: nodes as ReturnType<typeof record>[], pageInfo: { hasNextPage, endCursor }, totalCount } } } });

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
