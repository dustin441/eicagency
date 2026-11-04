import assert from 'node:assert/strict';
import { fetchNsiYtdData } from '../src/services/nsi-ytd';
import { createSpartacoSupabaseClient } from '../src/lib/spartaco-supabase-server';

const data = await fetchNsiYtdData();
const close = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 0.01, `${label}: ${actual} != ${expected}`);
for (const [name, rows] of Object.entries({ channels: data.channels, audiences: data.audiences, campaignTypes: data.campaignTypes, campaigns: data.campaigns })) {
  close(rows.reduce((sum, row) => sum + row.cost, 0), data.summary.cost, `${name} current spend conservation`);
  close(rows.reduce((sum, row) => sum + row.prevCost, 0), data.prevSummary.cost, `${name} previous spend conservation`);
  close(rows.reduce((sum, row) => sum + row.conversions, 0), data.summary.conversions, `${name} current conversion conservation`);
  close(rows.reduce((sum, row) => sum + row.impressions, 0), data.summary.impressions, `${name} current impression conservation`);
  close(rows.reduce((sum, row) => sum + row.clicks, 0), data.summary.clicks, `${name} current click conservation`);
  close(rows.reduce((sum, row) => sum + row.engagedSessions, 0), data.summary.engagedSessions, `${name} current onsite conservation`);
}
close(data.revenueFamilies.filter(row => row.key !== 'CMP').reduce((sum, row) => sum + row.spend, 0), data.summary.cost, 'nonoverlapping family spend');
close(data.monthly.reduce((sum, row) => sum + row.currentSpend, 0), data.summary.cost, 'monthly spend');
const combined = data.revenueFamilies.filter(row => row.key === 'BPT' || row.key === 'POL').reduce((sum, row) => sum + (row.current ?? 0), 0);
close(data.monthly.reduce((sum, row) => sum + (row.currentRevenue ?? 0), 0), combined, 'monthly combined revenue');
assert.equal(data.monthly.length, 10);
assert.ok(data.revenueFamilies.filter(row => row.key !== 'OTHER').every(row => row.months === 10 && row.previousMonths === 10));
close(data.conversionBreakout.productSubmittals + data.conversionBreakout.hubspotFormFills + data.conversionBreakout.metaLeads, data.summary.conversions, 'conversion subtype conservation');
assert.equal(data.prevSummary.conversions, 0, 'prior conversion comparison suppressed');
close(data.summary.ctr, data.summary.clicks / data.summary.impressions, 'weighted CTR');
close(data.summary.cpc, data.summary.cost / data.summary.clicks, 'weighted CPC');

// Independently read the live fact grain and check that paging did not truncate.
const client = createSpartacoSupabaseClient();
const evidence = [];
for (const [start, end, expected] of [[data.start, data.end, data.summary.cost], [data.compStart, data.compEnd, data.prevSummary.cost]] as const) {
  let sum = 0; let count = 0; const ids = new Set<string>(); const months = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await client.from('nsi_master_campaign_daily').select('id,date,cost').gte('date', start).lte('date', end).order('date').order('id').range(from, from + 999);
    if (error || !rows) throw new Error(error?.message ?? 'no source response');
    for (const row of rows) { ids.add(String(row.id)); months.add(row.date.slice(0, 7)); sum += Number(row.cost ?? 0); }
    count += rows.length;
    if (rows.length < 1000) break;
  }
  assert.equal(ids.size, count, 'stable paging has no duplicate source IDs');
  assert.ok(count > 1000, 'live validation exercises multiple source pages');
  assert.equal(months.size, 10, 'ten observed months, not a completeness proof');
  close(sum, expected, 'independent fact-to-service spend');
  evidence.push({ start, end, rowCount: count, distinctIds: ids.size, observedMonths: months.size, spend: sum });
}
console.log(JSON.stringify({ status: 'PASS', evidence, combinedRevenue: combined, note: 'Warehouse consistency only. Native-source reconciliation is separate.' }, null, 2));
