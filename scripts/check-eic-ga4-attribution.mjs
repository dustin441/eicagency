import assert from 'node:assert/strict';

import { normalizeGa4 } from '../src/lib/eic-n8n-transforms.ts';

function ga4Response({ campaign, term, source = 'fb', medium = 'paid_social' }) {
  return {
    rows: [{
      dimensionValues: [
        { value: '20260809' },
        { value: source },
        { value: medium },
        { value: 'Paid Social' },
        { value: campaign },
        { value: 'creative' },
        { value: term },
        { value: '/white-label-ppc' },
      ],
      metricValues: [
        { value: '3' },
        { value: '1' },
        { value: '0.333333' },
        { value: '0.666667' },
        { value: '30' },
        { value: '4' },
        { value: '2' },
      ],
    }],
  };
}

const traffic = normalizeGa4(ga4Response({
  campaign: 'EIC | Whitelabel | Traffic',
  term: '120247191880760727',
}), '399325751')[0];
assert.equal(traffic.campaign_id, '120247191870600727');
assert.equal(traffic.adset_id, '120247191880760727');

const engagement = normalizeGa4(ga4Response({
  campaign: 'EIC | Whitelabel | Engagement',
  term: '120247191969080727',
}), '399325751')[0];
assert.equal(engagement.campaign_id, '120247191962310727');
assert.equal(engagement.adset_id, '120247191969080727');

const mof = normalizeGa4(ga4Response({
  campaign: 'eic_whitelabel_mof_creative_test',
  term: '120248089869310727',
}), '399325751')[0];
assert.equal(mof.campaign_id, '120247713853330727');
assert.equal(mof.adset_id, '120248089869310727');

const unknown = normalizeGa4(ga4Response({
  campaign: 'unmapped_campaign',
  term: 'keyword',
}), '399325751')[0];
assert.equal(unknown.campaign_id, '');
assert.equal(unknown.adset_id, '');

console.log('EIC GA4 attribution checks passed');