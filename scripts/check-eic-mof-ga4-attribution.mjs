import assert from 'node:assert/strict';
import { mergeAdCreatives, normalizeGa4 } from '../src/lib/eic-n8n-transforms.ts';

function ga4Row({
  source = 'fb',
  medium = 'paid_social',
  campaign,
  content,
  term,
  sessions,
  engaged,
  duration,
}) {
  return {
    dimensionValues: [
      { value: '20260722' },
      { value: source },
      { value: medium },
      { value: 'Paid Social' },
      { value: campaign },
      { value: content },
      { value: term },
      { value: '/?fbclid=ignored' },
    ],
    metricValues: [
      { value: String(sessions) },
      { value: String(engaged) },
      { value: String(engaged / sessions) },
      { value: String(1 - engaged / sessions) },
      { value: String(duration) },
      { value: String(sessions) },
      { value: '0' },
    ],
  };
}

const normalized = normalizeGa4({
  rows: [
    ga4Row({
      campaign: 'eic_whitelabel_mof_creative_test',
      content: 'reporting_proof',
      term: '120247713864190727',
      sessions: 6,
      engaged: 2,
      duration: 20,
    }),
    ga4Row({
      campaign: 'unrelated_meta_campaign',
      content: 'other',
      term: 'search-term',
      sessions: 3,
      engaged: 1,
      duration: 10,
    }),
  ],
}, '399325751');

const mof = normalized.find((row) => row.session_campaign_name === 'eic_whitelabel_mof_creative_test');
assert.ok(mof);
assert.equal(mof.campaign_id, '120247713853330727');
assert.equal(mof.adset_id, '120247713864190727');
assert.equal(mof.sessions, 6);
assert.equal(mof.engaged_sessions, 2);
assert.equal(mof.engagement_rate, 0.333333);

const unrelated = normalized.find((row) => row.session_campaign_name === 'unrelated_meta_campaign');
assert.ok(unrelated);
assert.equal(unrelated.campaign_id, '');
assert.equal(unrelated.adset_id, '');

const merged = mergeAdCreatives([
  { id: 'ad-1', creative: { id: 'creative-1', object_story_spec: {} } },
], [
  {
    ad_id: 'ad-1',
    ad_name: 'Reporting Proof',
    adset_id: '120247713864190727',
    adset_name: '02 | Reporting Proof | Warm Union',
    campaign_id: '120247713853330727',
    campaign_name: 'Whitelabel | MOF Creative Test | ABO | 4-Cell',
    date_start: '2026-07-22',
    spend: '10.00',
    impressions: '100',
    clicks: '5',
  },
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].campaign_id, '120247713853330727');
assert.equal(merged[0].adset_id, '120247713864190727');

console.log('EIC MOF GA4 attribution checks passed');
