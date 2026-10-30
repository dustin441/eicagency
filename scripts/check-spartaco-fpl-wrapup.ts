import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

const slug = 'ronin-florida-power-light-abm-2026-09-07';
const campaigns = [
  '[LEADS] 09-07: Florida Power & Light ABM',
  '[WEBSITE LEAD] 09-07: Florida Power & Light ABM',
  '[SALES] 09-07: Florida Power & Light ABM',
];

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) if (process.env[key]) return process.env[key]!;
  throw new Error(`Missing ${name}`);
}

const money = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const config = getSpartacoWrapup(slug);
  assert.ok(config, `Missing ${slug}`);
  assert.deepEqual(
    [config.campaignStart, config.campaignEnd, config.beforeStart, config.beforeEnd, config.afterStart, config.afterEnd],
    ['2026-09-07', '2026-10-02', '2026-08-10', '2026-09-06', '2026-10-03', '2026-10-30'],
  );
  assert.deepEqual(config.campaignNames, campaigns);
  assert.deepEqual(config.sourceMediumPagePaths, ['/lp/fpl-ronin-promotion']);
  assert.deepEqual(config.socialProductNames, ['Ascenders']);
  assert.equal(config.status, 'Ready for Review');

  const supabase = createClient(
    env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: ads, error: adsError } = await supabase
    .from('spartaco_master_products')
    .select('date,campaign_name,ad_impressions,ad_clicks,ad_cost,ad_conversions,ad_purchases,ad_revenue')
    .eq('source', 'ads')
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .in('campaign_name', campaigns)
    .limit(10000);
  if (adsError) throw adsError;
  assert.ok((ads?.length ?? 0) > 0, 'Paid source rows missing');
  assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_impressions || 0), 0), 124669);
  assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_clicks || 0), 0), 4238);
  assert.equal(money(ads!.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)), 2402.27);
  assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_conversions || 0), 0), 3);
  assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_purchases || 0), 0), 0);
  assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_revenue || 0), 0), 0);
  assert.equal([...ads!.map((row) => row.date)].sort().at(-1), '2026-10-01');

  const wrapup = await loadSpartacoProductWrapup(slug);
  assert.ok(wrapup, `${slug} failed to hydrate`);
  const before = wrapup.periods.find((period) => period.key === 'before')!;
  const during = wrapup.periods.find((period) => period.key === 'during')!;
  const after = wrapup.periods.find((period) => period.key === 'after')!;

  assert.deepEqual(
    [during.summary.ad_impressions, during.summary.ad_clicks, money(during.summary.ad_cost), during.summary.ad_conversions],
    [124669, 4238, 2402.27, 3],
  );
  assert.deepEqual(
    [during.summary.ga4_sessions, during.summary.ga4_engaged_sessions, during.summary.ga4_purchases, during.summary.ga4_total_revenue],
    [1257, 409, 0, 0],
  );
  assert.deepEqual(
    [during.summary.email_total_sent, during.summary.email_opens, during.summary.email_clicks],
    [0, 0, 0],
  );
  assert.deepEqual(
    [during.summary.social_post_count, during.summary.social_impressions, during.summary.social_interactions],
    [4, 276, 17],
  );
  assert.equal(during.sourceAvailability.paid, true);
  assert.equal(during.sourceAvailability.website, true);
  assert.equal(during.sourceAvailability.email, false);
  assert.equal(during.sourceAvailability.social, true);

  for (const comparison of [before, after]) {
    assert.equal(comparison.summary.ad_impressions, 0);
    assert.equal(comparison.summary.ad_clicks, 0);
    assert.equal(comparison.summary.ad_cost, 0);
    assert.equal(comparison.summary.ad_conversions, 0);
    assert.equal(comparison.summary.ga4_sessions, 0);
    assert.equal(comparison.summary.ga4_engaged_sessions, 0);
  }

  assert.equal(wrapup.metaAds.length, 8);
  assert.ok(wrapup.metaAds.every((ad) => campaigns.includes(ad.campaignName)));
  assert.ok(wrapup.metaAds.every((ad) => ad.destinationUrl.includes('/lp/fpl-ronin-promotion/')));
  assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl.startsWith('https://www.facebook.com/ads/library/')));
  assert.equal(wrapup.emailDetails.length, 0);

  const metaWebsite = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Website Conversions');
  const google = wrapup.leadCaptureBreakdown.find((row) => row.label === 'On-site / Google Ads');
  assert.ok(metaWebsite && google);
  assert.deepEqual([metaWebsite.leads, money(metaWebsite.cost)], [0, 132.53]);
  assert.deepEqual([google.leads, money(google.cost), money(google.cpl ?? 0)], [3, 1708.22, 569.41]);
  assert.deepEqual(
    [wrapup.outcomeAttribution.totalSessions, wrapup.outcomeAttribution.paidSessions, wrapup.outcomeAttribution.haloSessions],
    [1257, 929, 328],
  );

  console.log('Ronin Florida Power & Light ABM wrap-up config, source, creative, and period checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
