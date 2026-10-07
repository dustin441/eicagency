import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

const slug = 'jameson-rodders-hot-rodder-2026-07-22';
const campaigns = [
  '[LEAD] Performance Max | 07-20: Rodders: Hot Rodder',
  '[LEAD] 07-20: Rodders: Hot Rodder',
  '[WEBSITE LEAD] 07-20: Rodders: Hot Rodder',
];

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) if (process.env[key]) return process.env[key]!;
  throw new Error(`Missing ${name}`);
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const config = getSpartacoWrapup(slug);
  assert.ok(config, 'Expected Hot Rodder wrap-up config');
  assert.equal(config.brand, 'Jameson');
  assert.equal(config.product, 'Hot Rodder');
  assert.equal(config.parentProduct, 'Rodders');
  assert.deepEqual(config.campaignNames, campaigns);
  assert.deepEqual(config.sourceMediumPagePaths, [
    '/lp/jameson-hot-rodder',
    '/product/the-hot-rodder-duct-rod-and-duct-hunter-pusher-package',
  ]);
  assert.deepEqual(config.gscPageUrls, [
    'https://jamesontools.com/lp/jameson-hot-rodder/',
    'https://jamesontools.com/product/the-hot-rodder-duct-rod-and-duct-hunter-pusher-package/',
  ]);
  assert.deepEqual(
    [config.campaignStart, config.campaignEnd, config.beforeStart, config.beforeEnd, config.afterStart, config.afterEnd],
    ['2026-07-22', '2026-08-21', '2026-06-24', '2026-07-21', '2026-08-22', '2026-09-18'],
  );
  assert.equal(config.status, 'Ready for Review');
  assert.deepEqual(config.socialProductNames, ['Hot Rodder']);

  const supabase = createClient(
    env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: paid, error: paidError } = await supabase
    .from('spartaco_master_products')
    .select('date,campaign_name,ad_impressions,ad_clicks,ad_cost,ad_conversions,ad_purchases,ad_revenue')
    .eq('source', 'ads')
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .in('campaign_name', campaigns)
    .limit(10000);
  if (paidError) throw paidError;
  assert.equal(paid?.length, 63);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_impressions || 0), 0), 111_732);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_clicks || 0), 0), 3_098);
  assert.equal(roundMoney(paid!.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)), 2_052.32);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_conversions || 0), 0), 170);
  assert.equal(paid!.reduce((sum, row) => sum + Number(row.ad_purchases || 0), 0), 2);
  assert.equal(roundMoney(paid!.reduce((sum, row) => sum + Number(row.ad_revenue || 0), 0)), 3_150.97);

  const { data: meta, error: metaError } = await supabase
    .from('jameson_meta')
    .select('campaign_name,impressions,clicks,cost,conversions,purchases,revenue')
    .in('campaign_name', campaigns.slice(1))
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (metaError) throw metaError;
  assert.equal(meta?.length, 32);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 95_903);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 2_749);
  assert.equal(roundMoney(meta!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 1_297.87);
  assert.equal(meta!.reduce((sum, row) => sum + Number(row.conversions || 0), 0), 164);

  const { data: google, error: googleError } = await supabase
    .from('jameson_google')
    .select('impressions,clicks,cost,conversions,purchases,revenue')
    .eq('campaign_name', campaigns[0])
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .limit(1000);
  if (googleError) throw googleError;
  assert.equal(google?.length, 31);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.impressions || 0), 0), 15_829);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.clicks || 0), 0), 349);
  assert.equal(roundMoney(google!.reduce((sum, row) => sum + Number(row.cost || 0), 0)), 754.45);
  assert.equal(google!.reduce((sum, row) => sum + Number(row.conversions || 0), 0), 6);

  const wrapup = await loadSpartacoProductWrapup(slug);
  assert.ok(wrapup, 'Expected Hot Rodder wrap-up to hydrate');
  const before = wrapup.periods.find((period) => period.key === 'before')!;
  const during = wrapup.periods.find((period) => period.key === 'during')!;
  const after = wrapup.periods.find((period) => period.key === 'after')!;

  assert.deepEqual([before.summary.ga4_sessions, during.summary.ga4_sessions, after.summary.ga4_sessions], [24, 831, 61]);
  assert.deepEqual([before.summary.ga4_engaged_sessions, during.summary.ga4_engaged_sessions, after.summary.ga4_engaged_sessions], [18, 335, 29]);
  assert.deepEqual([before.summary.ga4_purchases, during.summary.ga4_purchases, after.summary.ga4_purchases], [0, 2, 0]);
  assert.equal(roundMoney(during.summary.ga4_total_revenue), 449.14);
  assert.deepEqual([before.summary.gsc_clicks, during.summary.gsc_clicks, after.summary.gsc_clicks], [0, 34, 4]);
  assert.deepEqual([before.summary.gsc_impressions, during.summary.gsc_impressions, after.summary.gsc_impressions], [2, 96, 25]);

  for (const comparison of [before, after]) {
    assert.equal(comparison.summary.ad_impressions, 0);
    assert.equal(comparison.summary.ad_clicks, 0);
    assert.equal(comparison.summary.ad_cost, 0);
    assert.equal(comparison.summary.ad_conversions, 0);
  }
  assert.equal(during.summary.ad_impressions, 111_732);
  assert.equal(during.summary.ad_clicks, 3_098);
  assert.equal(roundMoney(during.summary.ad_cost), 2_052.32);
  assert.equal(during.summary.ad_conversions, 170);
  assert.equal(during.summary.ad_purchases, 2);
  assert.equal(roundMoney(during.summary.ad_revenue), 3_150.97);
  assert.equal(during.summary.email_total_sent, 7_702);
  assert.equal(during.summary.email_opens, 983);
  assert.equal(during.summary.email_clicks, 335);
  assert.equal(during.summary.social_post_count, 17);
  assert.equal(during.summary.social_impressions, 98_914);
  assert.equal(during.summary.social_interactions, 2_993);

  assert.equal(wrapup.emailDetails.length, 1);
  assert.equal(wrapup.emailDetails[0].name, '07-20: Rodders: Hot Rodder');
  assert.equal(wrapup.emailDetails[0].totalSent, 7_702);
  assert.equal(wrapup.sourceMediumRows.reduce((sum, row) => sum + Number(row.ga4_sessions || 0), 0), 831);
  assert.equal(wrapup.metaAds.length, 9);
  assert.ok(wrapup.metaAds.every((ad) => campaigns.slice(1).includes(ad.campaignName)));
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl.startsWith('https://www.facebook.com/ads/library/')));
  assert.ok(wrapup.metaAds.every((ad) => ad.finalCreativeLink.startsWith('/spartaco-creatives/jameson-')));

  const nativeMeta = wrapup.leadCaptureBreakdown.find((row) => row.key === 'facebook_lead_ads');
  const websiteMeta = wrapup.leadCaptureBreakdown.find((row) => row.key === 'meta_website_conversions');
  const googleBreakdown = wrapup.leadCaptureBreakdown.find((row) => row.key === 'onsite_google_ads');
  assert.ok(nativeMeta && websiteMeta && googleBreakdown);
  assert.equal(nativeMeta.leads, 156);
  assert.equal(roundMoney(nativeMeta.cost), 882.35);
  assert.equal(websiteMeta.leads, 8);
  assert.equal(roundMoney(websiteMeta.cost), 415.52);
  assert.equal(googleBreakdown.leads, 6);
  assert.equal(roundMoney(googleBreakdown.cost), 754.45);
  assert.equal(wrapup.outcomeAttribution.paidAttributedSales, 2);

  console.log('Hot Rodder wrap-up config, paid, GA4, GSC, email, social, creative, and comparison checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
