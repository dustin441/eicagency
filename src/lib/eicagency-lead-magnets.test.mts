import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EIC_LEAD_MAGNETS,
  campaignMatchesExactNames,
  leadMagnetForCampaign,
} from './eicagency-lead-magnets.ts';

test('maps the two requested lead magnets to their exact live Meta campaign names', () => {
  assert.deepEqual(EIC_LEAD_MAGNETS.map((item) => ({ id: item.id, label: item.label, campaignNames: item.campaignNames })), [
    {
      id: 'roi-calculator',
      label: 'ROI Calculator',
      campaignNames: ['EIC | Retarget | ROI Calculator'],
    },
    {
      id: 'scoreboard',
      label: 'Scoreboard',
      campaignNames: ['EIC | Retarget | Ads Ready Scorecard'],
    },
  ]);
});

test('matches campaign names exactly while ignoring harmless case and whitespace differences', () => {
  assert.equal(
    campaignMatchesExactNames('  eic | retarget | roi calculator  ', ['EIC | Retarget | ROI Calculator']),
    true,
  );
  assert.equal(
    campaignMatchesExactNames('EIC | Retarget | ROI Calculator - duplicate', ['EIC | Retarget | ROI Calculator']),
    false,
  );
});

test('keeps ROI Calculator and Scoreboard campaign data in separate lead-magnet groups', () => {
  assert.equal(leadMagnetForCampaign('EIC | Retarget | ROI Calculator')?.id, 'roi-calculator');
  assert.equal(leadMagnetForCampaign('EIC | Retarget | Ads Ready Scorecard')?.id, 'scoreboard');
  assert.equal(leadMagnetForCampaign('Traffic ROI'), undefined);
});
