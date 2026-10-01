import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

type Spec = {
  slug: string;
  dates: readonly [string, string, string, string, string, string];
  campaigns: string[];
  page: string;
  socialProduct: string;
  emailTerm: string;
  totals: {
    impressions: number; clicks: number; cost: number; leads: number;
    sessions: number; engaged: number; emailSent: number; emailOpens: number; emailClicks: number;
    socialPosts: number; socialImpressions: number; socialInteractions: number;
  };
  metaCount: number;
};

const specs: Spec[] = [
  {
    slug: 'huskie-hero-evs-rounding-jaw-2026-07-28',
    dates: ['2026-07-28', '2026-08-28', '2026-06-30', '2026-07-27', '2026-08-29', '2026-09-25'],
    campaigns: [
      '07-27: Battery Powered Tools HERO EVS Rounding Jaw - EVS-RRJAW',
      '[WEBSITE LEAD] 07-27: Battery Powered Tools HERO EVS Rounding Jaw - EVS-RRJAW',
    ],
    page: '/lp/huskie_evs-rounding-jaw-battery-powered-tool', socialProduct: 'EVS Rounding Jaw',
    emailTerm: 'EVS Rounding Jaw', metaCount: 16,
    totals: { impressions: 212020, clicks: 5341, cost: 3406.99, leads: 170, sessions: 1547, engaged: 657, emailSent: 15032, emailOpens: 1871, emailClicks: 614, socialPosts: 17, socialImpressions: 6032, socialInteractions: 170 },
  },
  {
    slug: 'huskie-hero-sla-cutters-2026-08-04',
    dates: ['2026-08-04', '2026-09-01', '2026-07-07', '2026-08-03', '2026-09-02', '2026-09-29'],
    campaigns: [
      '08-03: Battery-Powered Tools HERO-SLA Cutters',
      '08-03: Battery-Powered Tools HERO-SLA',
      '[WEBSITE LEAD] 08-03: Battery-Powered Tools HERO-SLA',
    ],
    page: '/lp/new-cutting-tools', socialProduct: 'Battery Tools: SLA 725',
    emailTerm: 'HERO-SLA Cutters', metaCount: 15,
    totals: { impressions: 176468, clicks: 4049, cost: 2572.90, leads: 81, sessions: 3376, engaged: 1783, emailSent: 7835, emailOpens: 1956, emailClicks: 1333, socialPosts: 2, socialImpressions: 911, socialInteractions: 3 },
  },
  {
    slug: 'jameson-tree-tools-vegetation-management-2026-08-06',
    dates: ['2026-08-06', '2026-09-04', '2026-07-09', '2026-08-05', '2026-09-05', '2026-10-02'],
    campaigns: [
      '[LEAD] Performance Max | 08-31: Tree Tools - Vegetation Management',
      '[LEAD] Performance Max | 08-31: Tree Tools - Vegetation Management - New Test',
      '[WEBSITE LEAD] 08-31: Tree Tools - Vegetation Management',
      '[WEBSITE LEAD] 08-31: Tree Tools - Vegetation Management - Interests',
    ],
    page: '/lp/jameson_tree-tools-vegetation-management', socialProduct: 'Tree Tools',
    emailTerm: 'Vegetation Management', metaCount: 20,
    totals: { impressions: 53005, clicks: 1274, cost: 1905.49, leads: 14, sessions: 937, engaged: 448, emailSent: 22803, emailOpens: 3483, emailClicks: 376, socialPosts: 5, socialImpressions: 890, socialInteractions: 23 },
  },
];

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) if (process.env[key]) return process.env[key]!;
  throw new Error(`Missing ${name}`);
}
const roundMoney = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const supabase = createClient(
    env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false } },
  );

  for (const spec of specs) {
    const config = getSpartacoWrapup(spec.slug);
    assert.ok(config, `Missing ${spec.slug}`);
    assert.deepEqual([
      config.campaignStart, config.campaignEnd, config.beforeStart, config.beforeEnd, config.afterStart, config.afterEnd,
    ], spec.dates);
    assert.deepEqual(config.campaignNames, spec.campaigns);
    assert.deepEqual(config.sourceMediumPagePaths, [spec.page]);
    assert.deepEqual(config.socialProductNames, [spec.socialProduct]);
    assert.equal(config.status, 'Ready for Review');

    const { data: ads, error: adsError } = await supabase
      .from('spartaco_master_products')
      .select('date,campaign_name,ad_impressions,ad_clicks,ad_cost,ad_conversions')
      .eq('source', 'ads').gte('date', spec.dates[0]).lte('date', spec.dates[1])
      .in('campaign_name', spec.campaigns).limit(10000);
    if (adsError) throw adsError;
    assert.ok((ads?.length ?? 0) > 0, `${spec.slug} paid rows missing`);
    assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_impressions || 0), 0), spec.totals.impressions);
    assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_clicks || 0), 0), spec.totals.clicks);
    assert.equal(roundMoney(ads!.reduce((sum, row) => sum + Number(row.ad_cost || 0), 0)), spec.totals.cost);
    assert.equal(ads!.reduce((sum, row) => sum + Number(row.ad_conversions || 0), 0), spec.totals.leads);

    const { data: emails, error: emailError } = await supabase
      .from('act_on_emails').select('email_name,total_sent,opens,clicks,report_date')
      .gte('report_date', spec.dates[0]).lte('report_date', spec.dates[1])
      .or(`email_name.ilike.%${spec.emailTerm}%,subject_line.ilike.%${spec.emailTerm}%`).limit(100);
    if (emailError) throw emailError;
    assert.ok((emails?.length ?? 0) > 0, `${spec.slug} email source missing`);

    const wrapup = await loadSpartacoProductWrapup(spec.slug);
    assert.ok(wrapup, `${spec.slug} failed to hydrate`);
    const before = wrapup.periods.find((period) => period.key === 'before')!;
    const during = wrapup.periods.find((period) => period.key === 'during')!;
    const after = wrapup.periods.find((period) => period.key === 'after')!;
    for (const comparison of [before, after]) {
      assert.equal(comparison.summary.ad_impressions, 0);
      assert.equal(comparison.summary.ad_clicks, 0);
      assert.equal(comparison.summary.ad_cost, 0);
      assert.equal(comparison.summary.ad_conversions, 0);
    }
    assert.equal(during.summary.ad_impressions, spec.totals.impressions);
    assert.equal(during.summary.ad_clicks, spec.totals.clicks);
    assert.equal(roundMoney(during.summary.ad_cost), spec.totals.cost);
    assert.equal(during.summary.ad_conversions, spec.totals.leads);
    assert.equal(during.summary.ga4_sessions, spec.totals.sessions);
    assert.equal(during.summary.ga4_engaged_sessions, spec.totals.engaged);
    assert.equal(during.summary.email_total_sent, spec.totals.emailSent);
    assert.equal(during.summary.email_opens, spec.totals.emailOpens);
    assert.equal(during.summary.email_clicks, spec.totals.emailClicks);
    assert.equal(during.summary.social_post_count, spec.totals.socialPosts);
    assert.equal(during.summary.social_impressions, spec.totals.socialImpressions);
    assert.equal(during.summary.social_interactions, spec.totals.socialInteractions);
    assert.equal(during.sourceAvailability.social, true);
    assert.equal(wrapup.metaAds.length, spec.metaCount);
    assert.ok(wrapup.metaAds.every((ad) => spec.campaigns.includes(ad.campaignName)));
    assert.ok(wrapup.metaAds.every((ad) => ad.previewUrl.startsWith('https://www.facebook.com/ads/library/')));
  }

  const evs = await loadSpartacoProductWrapup(specs[0].slug);
  assert.equal(evs!.leadCaptureBreakdown[0]?.label, 'Meta Lead / Website Conversions');
  assert.ok(evs!.metaAds.some((ad) => ad.destinationUrl.includes('huskie_evs-rounding-jaw-battery-powered-tool')));

  const sla = await loadSpartacoProductWrapup(specs[1].slug);
  assert.equal(sla!.leadCaptureBreakdown[0]?.label, 'Meta Website Conversions');
  assert.ok(sla!.metaAds.every((ad) => ad.destinationUrl.includes('/lp/new-cutting-tools/')));
  assert.ok(sla!.metaAds.some((ad) => ad.adName.includes('Retargeting')));
  assert.ok(sla!.metaAds.every((ad) => !ad.campaignName.includes('09-07')));

  const vegetation = await loadSpartacoProductWrapup(specs[2].slug);
  assert.equal(vegetation!.leadCaptureBreakdown[0]?.label, 'Meta Website Conversions');
  assert.ok(vegetation!.metaAds.some((ad) => ad.adName.includes('Awareness')));
  assert.ok(vegetation!.metaAds.some((ad) => ad.adName.includes('Trust')));
  assert.ok(vegetation!.metaAds.some((ad) => ad.adName.includes('V1')));
  assert.ok(vegetation!.metaAds.some((ad) => ad.adName.includes('V2')));
  assert.ok(vegetation!.metaAds.every((ad) => ad.destinationUrl.includes('/lp/jameson_tree-tools-vegetation-management/')));
  assert.ok(vegetation!.config.caveats.some((text) => text.includes('social source does not store post captions')));

  console.log('Three Spartaco catch-up wrap-up config, native-source, social, creative, and period checks passed');
}

main().catch((error) => { console.error(error); process.exit(1); });
