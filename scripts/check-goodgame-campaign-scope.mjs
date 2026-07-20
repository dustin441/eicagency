import assert from 'node:assert/strict';
import {
  isGoodGameEcommerceCampaign,
  matchesGoodGameCampaignScope,
} from '../src/lib/goodgame-campaign-scope.ts';

const ecommerceCampaigns = [
  '[SALES] Purchase | Retarget | Limited Offer',
  'Good Game | LAL Customers | Sales | 2026-03-25',
  'Pmax | E-commerce | New LP',
  'Search | ECOMMERCE | New LP',
  'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
  'MT-MOF-Retargeting Catalog',
  'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
  'MT | TOF | IC Opt | Headline Test | Sep 14 2025',
];

const footTrafficCampaigns = [
  'Traffic | Get Directions | Retailers',
  'Engagement | Video Views | T-Pain',
  'Pmax | Awareness',
  'CTV | Prospecting',
  'DOOH | Phoenix',
  'Search | Brand & 5-Hour Energy',
  'MT-TOFU-Testing broad dynamic creative',
  '',
  null,
];

for (const name of ecommerceCampaigns) {
  assert.equal(isGoodGameEcommerceCampaign(name), true, `${name} should be eCommerce`);
  assert.equal(matchesGoodGameCampaignScope(name, 'ecommerce'), true);
  assert.equal(matchesGoodGameCampaignScope(name, 'foot_traffic'), false);
  assert.equal(matchesGoodGameCampaignScope(name, 'all'), true);
}

for (const name of footTrafficCampaigns) {
  assert.equal(isGoodGameEcommerceCampaign(name), false, `${name} should be Foot Traffic`);
  assert.equal(matchesGoodGameCampaignScope(name, 'ecommerce'), false);
  assert.equal(matchesGoodGameCampaignScope(name, 'foot_traffic'), true);
  assert.equal(matchesGoodGameCampaignScope(name, 'all'), true);
}

console.log(`Verified ${ecommerceCampaigns.length} eCommerce and ${footTrafficCampaigns.length} Foot Traffic campaign examples.`);
