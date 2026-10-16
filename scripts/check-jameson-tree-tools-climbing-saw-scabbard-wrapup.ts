import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

const slug = 'jameson-tree-tools-climbing-saw-scabbard-2026-08-20';
const campaigns = [
  '[LEAD] Performance Max | 08-17: Tree Tools-Climbing Saw & Scabbard',
  '[WEBSITE LEAD] 08-17: Tree Tools-Climbing Saw & Scabbard',
];
const landingPage = '/lp/jameson-tree-tools-climbing-saw-hard-scabbard';

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) if (process.env[key]) return process.env[key]!;
  throw new Error(`Missing ${name}`);
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const config = getSpartacoWrapup(slug);
  assert.ok(config, 'Expected Climbing Saw & Scabbard wrap-up config');
  assert.equal(config.brand, 'Jameson');
  assert.equal(config.product, 'Climbing Saw');
  assert.equal(config.parentProduct, 'Tree Tools & Poles');
  assert.deepEqual(config.campaignNames, campaigns);
  assert.deepEqual(config.sourceMediumPagePaths, [landingPage]);
  assert.deepEqual(
    [config.campaignStart, config.campaignEnd, config.beforeStart, config.beforeEnd, config.afterStart, config.afterEnd],
    ['2026-08-20', '2026-09-18', '2026-07-23', '2026-08-19', '2026-09-19', '2026-10-16'],
  );
  assert.equal(config.status, 'Ready for Review');
  assert.deepEqual(config.socialProductNames, ['Climbing Saw']);
  assert.deepEqual(config.gscPageUrls, [
    'https://jamesontools.com/lp/jameson-tree-tools-climbing-saw-hard-scabbard/',
  ]);
  assert.equal(config.includeLeadCampaignPurchases, true);

  const supabase = createClient(
    env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: paid, error: paidError } = await supabase
    .from('spartaco_master_products')
    .select('date,campaign_name,ad_channel,ad_impressions,ad_clicks,ad_cost,ad_conversions,ad_purchases,ad_revenue')
    .eq('source', 'ads')
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .in('campaign_name', campaigns)
    .limit(10000);
  if (paidError) throw paidError;
  assert.equal(paid?.length, 43);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_impressions || 0), 0), 78_514);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_clicks || 0), 0), 1_956);
  assert.equal(roundMoney(paid!.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)), 2_313.06);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_conversions || 0), 0), 28);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_purchases || 0), 0), 3);
  assert.equal(roundMoney(paid!.reduce((sum, row) => sum + Number(row.ad_revenue || 0), 0)), 2_464.63);

  const { data: meta, error: metaError } = await supabase
    .from('jameson_meta')
    .select('date,impressions,clicks,cost,conversions,purchases,revenue')
    .eq('campaign_name', campaigns[1])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (metaError) throw metaError;
  assert.equal(meta?.length, 30);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 52_290);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 1_346);
  assert.equal(roundMoney(meta!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 1_890.37);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.conversions || 0), 0), 25);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.purchases || 0), 0), 3);
  assert.equal(roundMoney(meta!.reduce((sum, row) => sum + Number(row.revenue || 0), 0)), 2_464.63);

  const { data: google, error: googleError } = await supabase
    .from('jameson_google')
    .select('date,impressions,clicks,cost,conversions,purchases,revenue')
    .eq('campaign_name', campaigns[0])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (googleError) throw googleError;
  assert.equal(google?.length, 13);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 26_224);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 610);
  assert.equal(roundMoney(google!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 422.69);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.conversions || 0), 0), 3);

  const { data: metaAds, error: metaAdsError } = await supabase
    .from('jameson_meta_ads')
    .select('ad_id,impressions,clicks,cost,leads,purchases,revenue,preview_url,destination_url')
    .eq('campaign_name', campaigns[1])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(10000);
  if (metaAdsError) throw metaAdsError;
  assert.equal(metaAds?.length, 150);
  assert.equal(new Set(metaAds!.map((row) => row.ad_id)).size, 16);
  assert.equal(metaAds!.reduce((sum, row) => sum + Number(row.leads || 0), 0), 19);
  assert.ok(metaAds!.every((row) => String(row.destination_url).includes(`${landingPage}/`)));
  assert.ok(metaAds!.every((row) => String(row.preview_url).startsWith('https://www.facebook.com/ads/library/')));

  const wrapup = await loadSpartacoProductWrapup(slug);
  assert.ok(wrapup, 'Expected Climbing Saw & Scabbard wrap-up to hydrate');
  const before = wrapup.periods.find((period) => period.key === 'before')!;
  const during = wrapup.periods.find((period) => period.key === 'during')!;
  const after = wrapup.periods.find((period) => period.key === 'after')!;

  assert.deepEqual(
    [before.summary.ga4_sessions, during.summary.ga4_sessions, after.summary.ga4_sessions],
    [33, 1_329, 831],
  );
  assert.deepEqual(
    [before.summary.ga4_engaged_sessions, during.summary.ga4_engaged_sessions, after.summary.ga4_engaged_sessions],
    [29, 610, 325],
  );
  for (const comparison of [before, after]) {
    assert.equal(comparison.summary.ad_impressions, 0);
    assert.equal(comparison.summary.ad_clicks, 0);
    assert.equal(comparison.summary.ad_cost, 0);
    assert.equal(comparison.summary.ad_conversions, 0);
    assert.equal(comparison.summary.ad_purchases, 0);
    assert.equal(comparison.summary.ad_revenue, 0);
  }
  assert.equal(during.summary.ad_impressions, 78_514);
  assert.equal(during.summary.ad_clicks, 1_956);
  assert.equal(roundMoney(during.summary.ad_cost), 2_313.06);
  assert.equal(during.summary.ad_conversions, 28);
  assert.equal(during.summary.ad_purchases, 3);
  assert.equal(roundMoney(during.summary.ad_revenue), 2_464.63);
  assert.equal(during.summary.ga4_purchases, 0);
  assert.equal(during.summary.ga4_total_revenue, 0);
  assert.equal(during.summary.email_total_sent, 23_021);
  assert.equal(during.summary.email_opens, 2_849);
  assert.equal(during.summary.email_clicks, 502);
  assert.equal(during.summary.social_post_count, 20);
  assert.equal(during.summary.social_impressions, 2_566);
  assert.equal(during.summary.social_interactions, 47);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.ok(wrapup.emailDetails[0].name.includes('Climbing Saw & Scabbard'));
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + Number(row.ga4_sessions || 0), 0), 1_329);
  assert.equal(wrapup.metaAds.length, 16);
  assert.ok(wrapup.metaAds.every((ad) => ad.campaignName === campaigns[1]));
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl.startsWith('https://www.facebook.com/ads/library/')));
  assert.ok(wrapup.metaAds.every((ad) => ad.destinationUrl.includes(`${landingPage}/`)));
  assert.ok(wrapup.metaAds.some((ad) => ad.finalCreativeLink === '/spartaco-creatives/jameson-120252416799500216.jpg'));
  assert.ok(wrapup.metaAds.some((ad) => ad.finalCreativeLink === '/spartaco-creatives/jameson-120252474192870216.jpg'));

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.campaigns.includes(campaigns[1]));
  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.campaigns.includes(campaigns[0]));
  assert.ok(metaBreakdown);
  assert.ok(googleBreakdown);
  assert.equal(metaBreakdown.label, 'Meta Website Conversions');
  assert.equal(metaBreakdown.leads, 25);
  assert.equal(googleBreakdown.leads, 3);
  assert.ok(config.caveats.some((text) => text.includes('83 landing-page sessions')));
  assert.ok(config.caveats.some((text) => text.includes('748 sessions')));

  console.log('Climbing Saw & Scabbard wrap-up config, source, landing-page, email, social, creative, attribution, and comparison checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
