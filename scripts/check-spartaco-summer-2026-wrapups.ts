import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getSpartacoWrapup, loadSpartacoProductWrapup } from '../src/services/spartaco-product-wrapups';

type Spec = {
  slug: string;
  start: string;
  end: string;
  before: readonly [string, string];
  after: readonly [string, string];
  emailTerm: string;
  expectedEmails: number;
  expectedPaid: boolean;
  metaFilter?: string;
};

const specs: readonly Spec[] = [
  {
    slug: 'jameson-tree-tools-added-value-kit-2026-06-10',
    start: '2026-06-10', end: '2026-06-24', before: ['2026-05-13', '2026-06-09'], after: ['2026-06-25', '2026-07-22'],
    emailTerm: '06-08', expectedEmails: 4, expectedPaid: false,
  },
  {
    slug: 'jameson-abm-tree-tools-arborists-2026-06-15',
    start: '2026-06-15', end: '2026-07-17', before: ['2026-05-18', '2026-06-14'], after: ['2026-07-18', '2026-08-14'],
    emailTerm: '06-15: ABM Tree Tools - Arborists', expectedEmails: 1, expectedPaid: true,
  },
  {
    slug: 'huskie-battery-tools-sla-725y-2026-06-23',
    start: '2026-06-23', end: '2026-07-24', before: ['2026-05-26', '2026-06-22'], after: ['2026-07-25', '2026-08-21'],
    emailTerm: '06-22: Huskie Battery Tools', expectedEmails: 2, expectedPaid: true,
  },
  {
    slug: 'jameson-abm-tree-tools-line-clearance-russo-2026-07-01',
    start: '2026-07-01', end: '2026-07-31', before: ['2026-06-03', '2026-06-30'], after: ['2026-08-01', '2026-08-28'],
    emailTerm: '06-29: ABM Tree Tools-Line Clearance-Russo', expectedEmails: 1, expectedPaid: false,
  },
  {
    slug: 'jameson-abm-tree-tools-heritage-landscapers-2026-07-07',
    start: '2026-07-07', end: '2026-08-07', before: ['2026-06-09', '2026-07-06'], after: ['2026-08-08', '2026-09-04'],
    emailTerm: '07-06: ABM Tree Tools-Heritage Landscapers', expectedEmails: 1, expectedPaid: true, metaFilter: 'Heritage',
  },
  {
    slug: 'jameson-abm-tree-tools-siteone-landscapers-2026-07-07',
    start: '2026-07-07', end: '2026-08-07', before: ['2026-06-09', '2026-07-06'], after: ['2026-08-08', '2026-09-04'],
    emailTerm: '07-06: ABM Tree Tools-SiteOne Landscapers', expectedEmails: 1, expectedPaid: true, metaFilter: 'SiteOne',
  },
  {
    slug: 'jameson-tree-tools-telecom-2026-07-16',
    start: '2026-07-16', end: '2026-08-14', before: ['2026-06-18', '2026-07-15'], after: ['2026-08-15', '2026-09-11'],
    emailTerm: '07-13: Tree Tools - Telecom', expectedEmails: 1, expectedPaid: true,
  },
  {
    slug: 'ronin-material-lifting-2026-07-14',
    start: '2026-07-14', end: '2026-08-14', before: ['2026-06-16', '2026-07-13'], after: ['2026-08-15', '2026-09-11'],
    emailTerm: '07-13: Ronin Material Lifting', expectedEmails: 1, expectedPaid: true,
  },
];

const expectedDuring = new Map([
  ['jameson-tree-tools-added-value-kit-2026-06-10', { sessions: 64, engaged: 29, impressions: 0, clicks: 0, cost: 0, leads: 0, emailSent: 24390, emailClicks: 330 }],
  ['jameson-abm-tree-tools-arborists-2026-06-15', { sessions: 681, engaged: 197, impressions: 35473, clicks: 608, cost: 553.75, leads: 1, emailSent: 137, emailClicks: 0 }],
  ['huskie-battery-tools-sla-725y-2026-06-23', { sessions: 714, engaged: 271, impressions: 183087, clicks: 3003, cost: 2005.67, leads: 303, emailSent: 7621, emailClicks: 374 }],
  ['jameson-abm-tree-tools-line-clearance-russo-2026-07-01', { sessions: 9, engaged: 1, impressions: 0, clicks: 0, cost: 0, leads: 0, emailSent: 15, emailClicks: 1 }],
  ['jameson-abm-tree-tools-heritage-landscapers-2026-07-07', { sessions: 53, engaged: 16, impressions: 987, clicks: 6, cost: 16.62, leads: 0, emailSent: 64, emailClicks: 8 }],
  ['jameson-abm-tree-tools-siteone-landscapers-2026-07-07', { sessions: 51, engaged: 18, impressions: 8265, clicks: 69, cost: 103.52, leads: 0, emailSent: 114, emailClicks: 1 }],
  ['jameson-tree-tools-telecom-2026-07-16', { sessions: 412, engaged: 256, impressions: 81442, clicks: 1774, cost: 2024.48, leads: 167, emailSent: 6701, emailClicks: 74 }],
  ['ronin-material-lifting-2026-07-14', { sessions: 1133, engaged: 506, impressions: 253267, clicks: 7881, cost: 3962.67, leads: 304, emailSent: 16693, emailClicks: 300 }],
]);

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) {
    if (process.env[key]) return process.env[key]!;
  }
  throw new Error(`Missing ${name}`);
}

async function main() {
  const url = env('SPARTACO_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SPARTACO_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const oldSlugs = [
    'jameson-tree-tools-added-value-kit-awareness-2026-03-19',
    'huskie-battery-tools-sla-725-2026-03-12',
    'ronin-material-lifting-2026-04-23',
  ];
  for (const slug of oldSlugs) assert.ok(getSpartacoWrapup(slug), `Expected preserved historical report ${slug}`);

  for (const spec of specs) {
    const config = getSpartacoWrapup(spec.slug);
    assert.ok(config, `Missing ${spec.slug}`);
    assert.equal(config.campaignStart, spec.start);
    assert.equal(config.campaignEnd, spec.end);
    assert.deepEqual([config.beforeStart, config.beforeEnd], spec.before);
    assert.deepEqual([config.afterStart, config.afterEnd], spec.after);
    assert.ok(config.campaignGroupName.includes('2026'), `${spec.slug} must show its run year`);
    assert.ok(config.campaignGroupName.includes('|'), `${spec.slug} must visibly include its run range`);

    const { data: emails, error: emailError } = await supabase
      .from('act_on_emails')
      .select('email_name,report_date')
      .gte('report_date', spec.start)
      .lte('report_date', spec.end)
      .ilike('email_name', `%${spec.emailTerm}%`)
      .limit(100);
    if (emailError) throw emailError;
    assert.equal(emails?.length ?? 0, spec.expectedEmails, `${spec.slug} email count changed`);

    if (spec.metaFilter) {
      assert.equal(config.paidMetricsSource, 'meta_ad_filter');
      assert.deepEqual(config.metaAdNameIncludes, [spec.metaFilter]);
      const { data, error } = await supabase
        .from('jameson_meta_ads')
        .select('ad_name,campaign_name')
        .gte('date', spec.start)
        .lte('date', spec.end)
        .in('campaign_name', config.campaignNames)
        .ilike('ad_name', `%${spec.metaFilter}%`)
        .limit(1000);
      if (error) throw error;
      assert.ok((data?.length ?? 0) > 0, `${spec.slug} filtered Meta rows missing`);
      assert.ok(data!.every((row) => row.ad_name?.includes(spec.metaFilter)), `${spec.slug} leaked the other distributor`);
    } else {
      const { data, error } = await supabase
        .from('spartaco_master_products')
        .select('campaign_name')
        .eq('source', 'ads')
        .gte('date', spec.start)
        .lte('date', spec.end)
        .in('campaign_name', config.campaignNames)
        .limit(10000);
      if (error) throw error;
      if (spec.expectedPaid) assert.ok((data?.length ?? 0) > 0, `${spec.slug} paid rows missing`);
      else assert.equal(data?.length ?? 0, 0, `${spec.slug} unexpectedly matched paid rows`);
    }

    const wrapup = await loadSpartacoProductWrapup(spec.slug);
    assert.ok(wrapup, `${spec.slug} failed to hydrate`);
    const before = wrapup.periods.find((period) => period.key === 'before')?.summary;
    const during = wrapup.periods.find((period) => period.key === 'during')?.summary;
    const after = wrapup.periods.find((period) => period.key === 'after')?.summary;
    assert.ok(before && during && after, `${spec.slug} missing comparison periods`);
    const expected = expectedDuring.get(spec.slug)!;
    assert.equal(during.ga4_sessions, expected.sessions);
    assert.equal(during.ga4_engaged_sessions, expected.engaged);
    assert.equal(during.ad_impressions, expected.impressions);
    assert.equal(during.ad_clicks, expected.clicks);
    assert.equal(Math.round(during.ad_cost * 100) / 100, expected.cost);
    assert.equal(during.ad_conversions, expected.leads);
    assert.equal(during.email_total_sent, expected.emailSent);
    assert.equal(during.email_clicks, expected.emailClicks);
    if (spec.metaFilter) {
      const awareness = wrapup.leadCaptureBreakdown.find((row) => row.label === 'Meta Awareness / Traffic');
      assert.ok(awareness, `${spec.slug} must not be labeled as Facebook Lead Ads`);
      assert.equal(awareness.leads, 0);
      assert.equal(wrapup.metaAds.length, 2);
      assert.ok(wrapup.metaAds.every((ad) => ad.adName?.includes(spec.metaFilter!)));
    }
    for (const summary of [before, after]) {
      assert.equal(summary.ad_impressions, 0, `${spec.slug} comparison paid impressions must be zero`);
      assert.equal(summary.ad_clicks, 0, `${spec.slug} comparison paid clicks must be zero`);
      assert.equal(summary.ad_cost, 0, `${spec.slug} comparison paid cost must be zero`);
      assert.equal(summary.ad_conversions, 0, `${spec.slug} comparison paid leads must be zero`);
    }
  }

  console.log('Eight summer 2026 Spartaco wrap-up config/source checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
