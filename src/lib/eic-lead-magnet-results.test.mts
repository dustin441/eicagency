import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeAdCreatives, metaCampaignRows } from './eic-n8n-transforms.ts';

const genericActions = [
  { action_type: 'offsite_conversion.fb_pixel_custom', value: '24' },
  { action_type: 'offsite_conversion.custom.1783803712631173', value: '24' },
];

const leadMagnetRows = [
  {
    date_start: '2026-10-08',
    campaign_name: 'EIC | Retarget | ROI Calculator',
    campaign_id: 'roi',
    ad_id: 'ad-roi',
    actions: genericActions,
    conversions: [],
  },
  {
    date_start: '2026-10-08',
    campaign_name: 'EIC | Retarget | Ads Ready Scorecard',
    campaign_id: 'scoreboard',
    ad_id: 'ad-scoreboard',
    actions: [
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '14' },
      { action_type: 'offsite_conversion.custom.1783803712631173', value: '13' },
    ],
    conversions: [
      { action_type: 'offsite_conversion.fb_pixel_custom.ScorecardCompleted', value: '1' },
      { action_type: 'offsite_conversion.fb_pixel_custom.30s_Engaged', value: '13' },
    ],
  },
];

test('campaign rows use only each lead magnet specific conversion event', () => {
  const rows = metaCampaignRows([{ data: leadMagnetRows }]);

  assert.equal(rows[0].leads, 0);
  assert.equal(rows[1].leads, 1);
});

test('ad rows use the same specific conversion-event definition', () => {
  const rows = mergeAdCreatives([], leadMagnetRows);

  assert.equal(rows[0].leads, 0);
  assert.equal(rows[0].engagement_30s, 24);
  assert.equal(rows[1].leads, 1);
  assert.equal(rows[1].engagement_30s, 13);
});

test('unrelated campaigns preserve standard lead-event semantics', () => {
  const unrelated = {
    date_start: '2026-10-08',
    campaign_name: 'EIC | Whitelabel | MOF',
    campaign_id: 'mof',
    ad_id: 'ad-mof',
    actions: [
      { action_type: 'lead', value: '2' },
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '99' },
    ],
    conversions: [
      { action_type: 'offsite_conversion.fb_pixel_custom.ScorecardCompleted', value: '50' },
    ],
  };

  const [campaign] = metaCampaignRows([{ data: [unrelated] }]);
  const [ad] = mergeAdCreatives([], [unrelated]);

  assert.equal(campaign.leads, 2);
  assert.equal(ad.leads, 2);
});
