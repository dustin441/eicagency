import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductAwareMetaRows, productLineFromFields } from './durodyne-product-metrics.ts';

const mixedCampaign = 'HVAC | Custom Audiences | Landing Page | Duro Line & Dyna-Tite';

test('specific ad-set identity overrides a mixed-product campaign name', () => {
  assert.equal(productLineFromFields({
    campaignName: mixedCampaign,
    adsetName: 'Duro Line - Lookalike form fill audience',
  }), 'Duraline');
  assert.equal(productLineFromFields({
    campaignName: mixedCampaign,
    adsetName: 'dyna tite Screw Launch Target Companies - Contractor (Copy)',
  }), 'Dynatite');
});

test('a mixed campaign without product-specific fields remains unclassified', () => {
  assert.equal(productLineFromFields({ campaignName: mixedCampaign }), null);
});

test('Meta ad rows are split into product-aware daily performance rows', () => {
  const rows = buildProductAwareMetaRows([
    {
      date: '2026-10-25', campaign_name: mixedCampaign,
      adset_name: 'Duro Line - Retargeting landing page visits with no form fill',
      ad_name: 'Winner 01', destination_url: 'https://duroline.online/duro-line',
      impressions: 100, clicks: 20, spend: 50, leads: 2,
    },
    {
      date: '2026-10-25', campaign_name: mixedCampaign,
      adset_name: 'Duro Line - Lookalike form fill audience',
      ad_name: 'Winner 03', destination_url: 'https://duroline.online/duro-line',
      impressions: 200, clicks: 30, spend: 75, leads: 1,
    },
    {
      date: '2026-10-25', campaign_name: mixedCampaign,
      adset_name: 'dyna tite Screw Launch Target Companies - Contractor (Copy)',
      ad_name: 'Dyna Tite | V30 | Stock the System', destination_url: 'https://durodyne.online/dyna-tite',
      impressions: 300, clicks: 10, spend: 90, leads: 3,
    },
  ]);

  assert.deepEqual(rows.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name)), [
    {
      date: '2026-10-25', campaign_name: `${mixedCampaign} | Duraline`, ad_channel: 'Meta',
      impressions: 300, clicks: 50, cost: 125, conversions: 3,
    },
    {
      date: '2026-10-25', campaign_name: `${mixedCampaign} | Dynatite`, ad_channel: 'Meta',
      impressions: 300, clicks: 10, cost: 90, conversions: 3,
    },
  ]);
});
