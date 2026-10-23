import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATA_EVENT_CAMPAIGN_PREFIX,
  ATA_LINKEDIN_CAMPAIGNS,
  ATA_META_CAMPAIGNS,
  isAtaEventCampaignName,
} from './prepass-ata-scope.ts';

test('ATA LinkedIn scope uses the two verified campaign IDs', () => {
  assert.deepEqual(
    ATA_LINKEDIN_CAMPAIGNS.map(campaign => campaign.id),
    ['901952304', '903512924'],
  );
  assert.equal(
    ATA_LINKEDIN_CAMPAIGNS.some(campaign => campaign.name.startsWith(ATA_EVENT_CAMPAIGN_PREFIX)),
    false,
    'exact LinkedIn-name query must remain disjoint from the prefix query used by SMB trend subtraction',
  );
});

test('ATA campaign classifier includes the verified LinkedIn campaign names', () => {
  assert.equal(isAtaEventCampaignName('Retarget + Attendee List ATA MCE 2026'), true);
  assert.equal(isAtaEventCampaignName('Primer ATA 2026'), true);
  assert.equal(isAtaEventCampaignName('  Primer ATA 2026  '), true);
});

test('ATA campaign classifier includes only the verified Meta campaign names', () => {
  assert.deepEqual(
    ATA_META_CAMPAIGNS.map(campaign => campaign.id),
    ['120249523811860438', '120249616006280438'],
  );
  assert.equal(isAtaEventCampaignName('Website visits | PrePass | ATA MCE 2026 PreEvent'), true);
  assert.equal(isAtaEventCampaignName('Conversions | PrePass | ATA MCE 2026 PreEvent'), true);
  assert.equal(isAtaEventCampaignName('Website visits | PrePass | ATA MCE 2026 PreEvent - Copy'), false);
});

test('ATA campaign classifier preserves prefix matching without broad ATA matching', () => {
  assert.equal(isAtaEventCampaignName('ATA Event | PrePass | Search'), true);
  assert.equal(isAtaEventCampaignName('Primer ATA 2026 - Copy'), false);
  assert.equal(isAtaEventCampaignName('Unrelated ATA Campaign'), false);
  assert.equal(isAtaEventCampaignName(null), false);
});
