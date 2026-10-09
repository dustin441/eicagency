import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('EIC lead-magnets route is access-controlled and fetches each exact campaign separately', async () => {
  const page = await source('../app/dashboard/eicagency/lead-magnets/page.tsx');

  assert.match(page, /await requireClientAccess\('eicagency'\)/);
  assert.match(page, /EIC_LEAD_MAGNETS\.map/);
  assert.match(page, /campaignNames:\s*leadMagnet\.campaignNames/);
  assert.match(page, /Promise\.all/);
});

test('EIC analytics supports exact campaign-name scope without triggering the MOF engagement override', async () => {
  const service = await source('./eicagency-analytics.ts');

  assert.match(service, /campaignNames\?: readonly string\[\]/);
  assert.match(service, /campaignMatchesExactNames/);
  assert.match(service, /params\.campaignFilter\?\.toUpperCase\(\) === 'MOF'/);
});

test('lead-magnets presentation keeps both magnets separate and exposes KPIs plus available creatives', async () => {
  const component = await source('../components/EicLeadMagnetsDashboardClient.tsx');
  const layout = await source('../app/dashboard/layout.tsx');

  assert.match(layout, /name: 'Lead Magnets', href: '\/dashboard\/eicagency\/lead-magnets'/);
  assert.match(component, /ROI Calculator/);
  assert.match(component, /Scoreboard/);
  for (const label of ['Spend', 'Impressions', 'Clicks', 'CTR', 'Leads', 'CPL']) {
    assert.match(component, new RegExp(`label="${label}"`));
  }
  assert.match(component, /<MetaAdPreviews/);
  assert.match(component, /creatives=\{leadMagnet\.data\.metaCreatives\}/);
});
