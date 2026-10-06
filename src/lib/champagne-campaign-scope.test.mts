import assert from 'node:assert/strict';
import test from 'node:test';
import {
  champagneClicksForScope,
  champagneCampaignMatchesScope,
  isChampagneHalloweenCampaign,
} from './champagne-campaign-scope.ts';

test('identifies the live Fangs & Flutes campaign as Halloween', () => {
  assert.equal(
    isChampagneHalloweenCampaign('Champagne Haus | Fangs & Flutes | Traffic | Link Clicks | 2026'),
    true,
  );
});

test('supports explicit Halloween campaign naming', () => {
  assert.equal(isChampagneHalloweenCampaign('Champagne Haus Halloween 2026'), true);
  assert.equal(isChampagneHalloweenCampaign('Fangs and Flutes Retargeting'), true);
});

test('keeps Halloween performance out of events-based lead gen', () => {
  const halloween = 'Champagne Haus | Fangs & Flutes | Traffic | Link Clicks | 2026';
  assert.equal(champagneCampaignMatchesScope(halloween, 'halloween'), true);
  assert.equal(champagneCampaignMatchesScope(halloween, 'events'), false);
});

test('keeps non-Halloween campaigns on events-based lead gen', () => {
  for (const campaign of ['[SEARCH] Corporate', 'Champagne Haus - Retarget', 'Champagne Haus - Prospecting | Leads']) {
    assert.equal(champagneCampaignMatchesScope(campaign, 'events'), true);
    assert.equal(champagneCampaignMatchesScope(campaign, 'halloween'), false);
  }
});

test('uses Meta link clicks for Halloween instead of all clicks', () => {
  assert.equal(champagneClicksForScope({
    scope: 'halloween',
    channel: 'Meta',
    clicks: 42,
    linkClicks: 17,
  }), 17);
  assert.equal(champagneClicksForScope({
    scope: 'halloween',
    channel: 'Meta',
    clicks: 42,
    linkClicks: null,
  }), 0);
});

test('preserves platform clicks outside Halloween Meta', () => {
  assert.equal(champagneClicksForScope({
    scope: 'events',
    channel: 'Meta',
    clicks: 42,
    linkClicks: 17,
  }), 42);
  assert.equal(champagneClicksForScope({
    scope: 'halloween',
    channel: 'Google',
    clicks: 42,
    linkClicks: null,
  }), 42);
});