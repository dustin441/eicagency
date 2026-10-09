import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeAdCreatives, metaCampaignRows } from './eic-n8n-transforms.ts';

const leadMagnetActions = [
  { action_type: 'offsite_conversion.fb_pixel_custom', value: '24' },
  { action_type: 'offsite_conversion.custom.1783803712631173', value: '24' },
];

test('campaign rows use native custom-event results for the two lead magnets', () => {
  const rows = metaCampaignRows([{ data: [
    {
      date_start: '2026-10-08',
      campaign_name: 'EIC | Retarget | ROI Calculator',
      campaign_id: 'roi',
      actions: leadMagnetActions,
    },
    {
      date_start: '2026-10-08',
      campaign_name: 'EIC | Retarget | Ads Ready Scorecard',
      campaign_id: 'scoreboard',
      actions: [
        { action_type: 'offsite_conversion.fb_pixel_custom', value: '14' },
        { action_type: 'offsite_conversion.custom.1783803712631173', value: '13' },
      ],
    },
  ] }]);

  assert.equal(rows[0].leads, 24);
  assert.equal(rows[1].leads, 14);
});

test('ad rows use the same native result definition as campaign rows', () => {
  const rows = mergeAdCreatives([], [{
    date_start: '2026-10-08',
    campaign_name: 'EIC | Retarget | ROI Calculator',
    campaign_id: 'roi',
    ad_id: 'ad-1',
    actions: leadMagnetActions,
  }]);

  assert.equal(rows[0].leads, 24);
  assert.equal(rows[0].engagement_30s, 24);
});

test('unrelated campaigns preserve standard lead-event semantics', () => {
  const [campaign] = metaCampaignRows([{ data: [{
    date_start: '2026-10-08',
    campaign_name: 'EIC | Whitelabel | MOF',
    campaign_id: 'mof',
    actions: [
      { action_type: 'lead', value: '2' },
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '99' },
    ],
  }] }]);

  const [ad] = mergeAdCreatives([], [{
    date_start: '2026-10-08',
    campaign_name: 'EIC | Whitelabel | MOF',
    campaign_id: 'mof',
    ad_id: 'ad-2',
    actions: [
      { action_type: 'lead', value: '2' },
      { action_type: 'offsite_conversion.fb_pixel_custom', value: '99' },
    ],
  }]);

  assert.equal(campaign.leads, 2);
  assert.equal(ad.leads, 2);
});
