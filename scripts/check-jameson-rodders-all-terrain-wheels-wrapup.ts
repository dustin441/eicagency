import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

const slug = 'jameson-rodders-all-terrain-wheels-2026-08-12';
const campaigns = [
  '[LEAD] Performance Max | 08-10: Rodders - All Terrain Wheels',
  '[WEBSITE LEAD] 08-10: Rodders-All Terrain Wheels',
];

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) if (process.env[key]) return process.env[key]!;
  throw new Error(`Missing ${name}`);
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const config = getSpartacoWrapup(slug);
  assert.ok(config, 'Expected All-Terrain Wheels wrap-up config');
  assert.equal(config.brand, 'Jameson');
  assert.equal(config.product, 'Rodders');
  assert.equal(config.parentProduct, 'Rodders');
  assert.deepEqual(config.campaignNames, campaigns);
  assert.deepEqual(config.sourceMediumPagePaths, ['/lp/jameson_duct-rodders_duct-hunter_selector-tool']);
  assert.deepEqual(
    [config.campaignStart, config.campaignEnd, config.beforeStart, config.beforeEnd, config.afterStart, config.afterEnd],
    ['2026-08-12', '2026-09-09', '2026-07-15', '2026-08-11', '2026-09-10', '2026-10-07'],
  );
  assert.equal(config.status, 'Ready for Review');
  assert.deepEqual(config.socialProductNames, ['Rodders']);

  const supabase = createClient(
    env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: paid, error: paidError } = await supabase
    .from('spartaco_master_products')
    .select('date,campaign_name,ad_channel,ad_impressions,ad_clicks,ad_cost,ad_conversions')
    .eq('source', 'ads')
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .in('campaign_name', campaigns)
    .limit(10000);
  if (paidError) throw paidError;
  assert.equal(paid?.length, 42);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_impressions || 0), 0), 31_288);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_clicks || 0), 0), 571);
  assert.equal(roundMoney(paid!.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)), 1_011.04);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_conversions || 0), 0), 12);
  assert.equal(paid!.filter((row) => row.campaign_name === campaigns[0]).length, 13);
  assert.equal(paid!.filter((row) => row.campaign_name === campaigns[1]).length, 29);

  const { data: metaCampaign, error: metaCampaignError } = await supabase
    .from('jameson_meta')
    .select('date,impressions,clicks,cost,conversions')
    .eq('campaign_name', campaigns[1])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (metaCampaignError) throw metaCampaignError;
  assert.equal(metaCampaign?.length, 29);
  assert.equal(metaCampaign!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 25_895);
  assert.equal(metaCampaign!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 481);
  assert.equal(roundMoney(metaCampaign!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 878.73);
  assert.equal(metaCampaign!.reduce((sum, row) => sum + Number(row.conversions || 0), 0), 12);

  const { data: metaAds, error: metaAdsError } = await supabase
    .from('jameson_meta_ads')
    .select('ad_id,impressions,clicks,cost,leads,preview_url,destination_url')
    .eq('campaign_name', campaigns[1])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(10000);
  if (metaAdsError) throw metaAdsError;
  assert.equal(metaAds?.length, 108);
  assert.equal(metaAds!.reduce((sum, row) => sum + Number(row.leads || 0), 0), 11);
  assert.ok(metaAds!.every((row) => String(row.destination_url).includes('/lp/jameson_duct-rodders_duct-hunter_selector-tool/')));
  assert.ok(metaAds!.every((row) => String(row.preview_url).startsWith('https://www.facebook.com/ads/library/')));

  const { data: google, error: googleError } = await supabase
    .from('jameson_google')
    .select('date,impressions,clicks,cost,conversions')
    .eq('campaign_name', campaigns[0])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (googleError) throw googleError;
  assert.equal(google?.length, 13);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 5_393);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 90);
  assert.equal(roundMoney(google!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 132.31);

  const wrapup = await loadSpartacoProductWrapup(slug);
  assert.ok(wrapup, 'Expected All-Terrain Wheels wrap-up to hydrate');
  const before = wrapup.periods.find((period) => period.key === 'before')!;
  const during = wrapup.periods.find((period) => period.key === 'during')!;
  const after = wrapup.periods.find((period) => period.key === 'after')!;

  assert.deepEqual(
    [before.summary.ga4_sessions, during.summary.ga4_sessions, after.summary.ga4_sessions],
    [37, 358, 5],
  );
  assert.deepEqual(
    [before.summary.ga4_engaged_sessions, during.summary.ga4_engaged_sessions, after.summary.ga4_engaged_sessions],
    [21, 153, 4],
  );
  for (const comparison of [before, after]) {
    assert.equal(comparison.summary.ad_impressions, 0);
    assert.equal(comparison.summary.ad_clicks, 0);
    assert.equal(comparison.summary.ad_cost, 0);
    assert.equal(comparison.summary.ad_conversions, 0);
  }
  assert.equal(during.summary.ad_impressions, 31_288);
  assert.equal(during.summary.ad_clicks, 571);
  assert.equal(roundMoney(during.summary.ad_cost), 1_011.04);
  assert.equal(during.summary.ad_conversions, 12);
  assert.equal(during.summary.ad_purchases, 0);
  assert.equal(during.summary.ad_revenue, 0);
  assert.equal(during.summary.email_total_sent, 7_399);
  assert.equal(during.summary.email_opens, 781);
  assert.equal(during.summary.email_clicks, 89);
  assert.equal(during.summary.social_post_count, 2);
  assert.equal(during.summary.social_impressions, 2_487);
  assert.equal(during.summary.social_interactions, 9);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.ok(wrapup.emailDetails[0].name.includes('All Terrain Wheels'));
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + Number(row.ga4_sessions || 0), 0), 358);
  assert.equal(wrapup.metaAds.length, 13);
  assert.ok(wrapup.metaAds.every((ad) => campaigns.includes(ad.campaignName)));
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl.startsWith('https://www.facebook.com/ads/library/')));
  assert.ok(wrapup.metaAds.every((ad) => ad.destinationUrl.includes('/lp/jameson_duct-rodders_duct-hunter_selector-tool/')));
  assert.ok(wrapup.metaAds.filter((ad) => ad.isVideo).every((ad) => ad.finalCreativeLink.startsWith('/spartaco-creatives/')));

  const metaBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.campaigns.includes(campaigns[1]));
  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.campaigns.includes(campaigns[0]));
  assert.ok(metaBreakdown);
  assert.ok(googleBreakdown);
  assert.equal(metaBreakdown.leads, 12);
  assert.equal(googleBreakdown.leads, 0);

  console.log('All-Terrain Wheels wrap-up config, native-source, landing-page, email, social, creative, and comparison checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
