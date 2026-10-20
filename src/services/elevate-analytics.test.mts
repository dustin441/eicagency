import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildElevateDashboardData, type ElevatePerformanceRow } from './elevate-analytics-core.ts';
import { positionViewportPopover } from '../lib/popover-position.ts';

const rows: ElevatePerformanceRow[] = [
  { date: '2026-10-15', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 1000, clicks: 50, spend: 25, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: { link_clicks: 50 } },
  { date: '2026-10-16', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 500, clicks: 20, spend: 10, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: { link_clicks: 20 } },
  { date: '2026-10-16', platform: 'Google Search', account_id: '2', campaign_id: 'g1', campaign_name: 'Elevate Search', creative_id: 'g-ad', creative_name: 'Responsive search ad', impressions: 200, clicks: 10, spend: 30, form_fills: 2, preview_url: null, destination_url: 'https://example.com', metadata: {} },
];

test('aggregates selected rows and keeps creative-level performance', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.equal(data.totalSpend, 65);
  assert.equal(data.totalImpressions, 1700);
  assert.equal(data.totalClicks, 80);
  assert.equal(data.ctr, 80 / 1700 * 100);
  assert.equal(data.formFills, 2);
  assert.equal(data.metricCoverage.formFills, 'partial');
  assert.equal(data.creatives.length, 2);
  const meta = data.creatives.find(row => row.creativeId === 'a1');
  assert.equal(meta?.spend, 35);
  assert.equal(meta?.impressions, 1500);
  assert.equal(meta?.formFills, null);
});

test('uses Meta link clicks and exposes the approved campaign and channel budgets', () => {
  const metaRows: ElevatePerformanceRow[] = [
    { ...rows[0], clicks: 50, metadata: { link_clicks: 41 } },
    { ...rows[1], clicks: 20, metadata: { link_clicks: 19 } },
  ];
  const all = buildElevateDashboardData(metaRows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.equal(all.budget, 5000);
  assert.equal(all.totalClicks, 60);
  assert.equal(all.ctr, 60 / 1500 * 100);
  assert.deepEqual(Object.fromEntries(all.channels.map(channel => [channel.platform, channel.budget])), {
    'Google Search': 800,
    Meta: 1700,
    LinkedIn: 1200,
    GroundTruth: 1300,
  });
  assert.equal(all.creatives[0].clicks, 60);

  const filtered = buildElevateDashboardData(metaRows, { start: '2026-10-15', end: '2026-10-16', channel: 'Meta' });
  assert.equal(filtered.budget, 1700);
});

test('does not relabel broader Meta clicks as link clicks when link-click metadata is invalid', () => {
  for (const metadata of [{}, { link_clicks: '' }, { link_clicks: 'not-a-number' }, { link_clicks: -1 }]) {
    const data = buildElevateDashboardData(
      [{ ...rows[0], clicks: 50, metadata }],
      { start: '2026-10-15', end: '2026-10-15', channel: 'Meta' },
    );
    assert.equal(data.totalClicks, null);
    assert.equal(data.ctr, null);
    assert.equal(data.metricCoverage.clicks, 'unavailable');
    assert.equal(data.channels.find(channel => channel.platform === 'Meta')?.clicks, null);
    assert.equal(data.adPreviews.meta[0]?.clicksAvailable, false);
  }
});

test('fails Meta previews closed when link-click coverage is partial', () => {
  const data = buildElevateDashboardData(
    [
      { ...rows[0], metadata: { link_clicks: 10 } },
      { ...rows[1], metadata: {} },
    ],
    { start: '2026-10-15', end: '2026-10-16', channel: 'Meta' },
  );
  assert.equal(data.totalClicks, 10);
  assert.equal(data.metricCoverage.clicks, 'partial');
  assert.equal(data.ctr, null);
  assert.equal(data.creatives[0]?.clicks, 10);
  assert.equal(data.creatives[0]?.ctr, null);
  assert.equal(data.adPreviews.meta[0]?.clicksAvailable, false);
});

test('builds inline ad preview models from provider creative metadata', () => {
  const previewRows: ElevatePerformanceRow[] = [
    {
      ...rows[0],
      metadata: {
        adset_name: 'Dallas agency owners',
        headline: 'Build Your 2027 Agency Plan',
        primary_text: 'Two focused days to build a practical plan.',
        image_url: 'https://cdn.example.com/elevate.jpg',
        destination_url: 'https://anagencystory.com/agency-planning-workshop/',
        cta_type: 'LEARN_MORE',
        is_video: true,
        video_id: 'video-1',
      },
    },
    {
      ...rows[2],
      metadata: {
        headlines: ['An Event for Agency Owners', 'Build Your 2027 Agency Plan'],
        descriptions: ['A hands-on Dallas workshop.', 'Build a practical roadmap.'],
      },
    },
    {
      ...rows[0],
      platform: 'LinkedIn',
      creative_id: 'li-1',
      creative_name: 'Build 2027',
      preview_url: 'https://www.linkedin.com/feed/update/urn:li:share:1',
      metadata: {},
    },
  ];
  const data = buildElevateDashboardData(previewRows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.equal(data.adPreviews.meta.length, 1);
  assert.equal(data.adPreviews.meta[0].finalCreativeLink, 'https://cdn.example.com/elevate.jpg');
  assert.equal(data.adPreviews.meta[0].headline, 'Build Your 2027 Agency Plan');
  assert.equal(data.adPreviews.meta[0].ctaType, 'LEARN_MORE');
  assert.equal(data.adPreviews.google.length, 1);
  assert.deepEqual(data.adPreviews.google[0].headlines, ['An Event for Agency Owners', 'Build Your 2027 Agency Plan']);
  assert.equal(data.adPreviews.linkedin[0].previewUrl, 'https://www.linkedin.com/feed/update/urn:li:share:1');
});

test('renders the standard ad previews inline without a separate dashboard tab', () => {
  const component = readFileSync(new URL('../components/ElevateDashboardClient.tsx', import.meta.url), 'utf8');
  const previews = readFileSync(new URL('../components/AdPreviews.tsx', import.meta.url), 'utf8');
  assert.match(component, /<MetaAdPreviews/);
  assert.match(component, /<GoogleAdPreviews/);
  assert.match(component, /LinkedIn Sponsored Content/);
  assert.ok(component.indexOf('<MetaAdPreviews creatives=') < component.indexOf('Performance by creative'), 'previews should appear before the performance table');
  assert.doesNotMatch(component, />Open preview</);
  assert.doesNotMatch(component, /Ad Previews Tab|setActiveTab/);
  assert.match(component, /Campaign budget/);
  assert.match(component, /Meta link clicks/);
  assert.match(component, /money\(channel\.budget\)[\s\S]*channel\.status !== 'represented'/);
  assert.doesNotMatch(component, /label="Form fills"/);
  assert.match(previews, /ad\.clicksAvailable === false \? 'Unavailable'/);
  assert.match(previews, /c\.clicksAvailable === false \? 'Unavailable' : fmtN\(c\.clicks\)/);
  assert.match(previews, /Avg CTR \{avgCtrAvailable \? `\$\{avgCtr\.toFixed\(2\)\}%` : 'Unavailable'\}/);
});

test('clamps the date picker inside narrow and short viewports', () => {
  assert.deepEqual(positionViewportPopover({ triggerLeft: 52, triggerBottom: 122, viewportWidth: 430, viewportHeight: 713 }), {
    left: 16,
    top: 130,
    width: 398,
    maxHeight: 567,
  });
  const short = positionViewportPopover({ triggerLeft: 900, triggerBottom: 650, viewportWidth: 1440, viewportHeight: 720 });
  assert.equal(short.left, 900);
  assert.equal(short.width, 400);
  assert.equal(short.top, 544);
  assert.equal(short.maxHeight, 160);
});

test('filters by channel without converting unavailable form fills to zero', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'Meta' });
  assert.equal(data.totalSpend, 35);
  assert.equal(data.formFills, null);
  assert.equal(data.metricCoverage.formFills, 'unavailable');
});

test('represents every required channel and documents unavailable sources', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.deepEqual(data.channels.map(channel => channel.platform), ['Google Search', 'Meta', 'LinkedIn', 'GroundTruth']);
  assert.equal(data.channels.find(channel => channel.platform === 'Meta')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'Google Search')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'LinkedIn')?.status, 'represented');
  assert.match(data.channels.find(channel => channel.platform === 'GroundTruth')?.limitation ?? '', /manually/i);
});

test('labels supplied GroundTruth report data as manual without hiding its metrics', () => {
  const groundTruth: ElevatePerformanceRow[] = [
    { ...rows[0], platform: 'GroundTruth', creative_id: 'gt-1', spend: 18.04, impressions: 1323, clicks: 31, form_fills: 0 },
  ];
  const data = buildElevateDashboardData(groundTruth, { start: '2026-10-15', end: '2026-10-16', channel: 'GroundTruth' });
  const channel = data.channels.find(row => row.platform === 'GroundTruth');
  assert.equal(channel?.status, 'manual');
  assert.equal(channel?.spend, 18.04);
  assert.equal(data.selectionUnavailable, false);
  assert.match(channel?.limitation ?? '', /manually loaded/i);
});

test('does not convert missing GroundTruth delivery metrics to zero', () => {
  const partial: ElevatePerformanceRow[] = [
    { ...rows[0], date: '2026-10-19', platform: 'GroundTruth', creative_id: 'gt-1', spend: 2.16, impressions: 0, clicks: 0, form_fills: null, metadata: { metrics_status: 'partial: delivery metrics unavailable in supplied report' } },
  ];
  const data = buildElevateDashboardData(partial, { start: '2026-10-19', end: '2026-10-19', channel: 'GroundTruth' });
  const channel = data.channels.find(row => row.platform === 'GroundTruth');
  assert.equal(data.totalSpend, 2.16);
  assert.equal(data.totalImpressions, null);
  assert.equal(data.totalClicks, null);
  assert.equal(data.ctr, null);
  assert.equal(channel?.impressions, null);
  assert.equal(channel?.clicks, null);
  assert.equal(channel?.ctr, null);
  assert.match(channel?.limitation ?? '', /unavailable values are not treated as zero/i);
});

test('reconciles a complete GroundTruth selection to the native campaign total and discloses rounding', () => {
  const metadata = { reported_campaign_total: { spend: 18.04 }, displayed_daily_spend_sum: 18.03 };
  const groundTruth: ElevatePerformanceRow[] = [
    { ...rows[0], date: '2026-10-15', platform: 'GroundTruth', creative_id: 'gt-1', spend: 15.87, impressions: 1323, clicks: 31, form_fills: 0, metadata },
    { ...rows[0], date: '2026-10-19', platform: 'GroundTruth', creative_id: 'gt-1', spend: 2.16, impressions: 0, clicks: 0, form_fills: null, metadata: { ...metadata, metrics_status: 'partial: delivery metrics unavailable in supplied report' } },
  ];
  const data = buildElevateDashboardData(groundTruth, { start: '2026-10-14', end: '2026-10-19', channel: 'GroundTruth' });
  assert.equal(data.totalSpend, 18.04);
  assert.equal(data.totalImpressions, 1323);
  assert.equal(data.totalClicks, 31);
  assert.equal(data.metricCoverage.impressions, 'partial');
  assert.equal(data.metricCoverage.clicks, 'partial');
  assert.equal(data.ctr, null);
  assert.equal(data.creatives[0].spend, 18.04);
  assert.equal(data.creatives[0].ctr, null);
  assert.match(data.spendReconciliationNote ?? '', /daily rows differ by \$0\.01/i);
});

test('marks an empty all-channel selection unavailable instead of measured zero', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-11-01', end: '2026-11-02', channel: 'all' });
  assert.equal(data.selectionUnavailable, true);
  assert.equal(data.totalSpend, null);
  assert.equal(data.totalImpressions, null);
  assert.equal(data.totalClicks, null);
  assert.equal(data.ctr, null);
  assert.equal(data.formFills, null);
});

test('does not convert unavailable or partially available spend to an undisclosed zero', () => {
  const unavailable = buildElevateDashboardData(
    [{ ...rows[0], spend: null }],
    { start: '2026-10-15', end: '2026-10-15', channel: 'all' },
  );
  assert.equal(unavailable.totalSpend, null);
  assert.equal(unavailable.metricCoverage.spend, 'unavailable');

  const partial = buildElevateDashboardData(
    [{ ...rows[0], spend: 10 }, { ...rows[1], spend: null }],
    { start: '2026-10-15', end: '2026-10-16', channel: 'all' },
  );
  assert.equal(partial.totalSpend, 10);
  assert.equal(partial.metricCoverage.spend, 'partial');
});

test('fails closed on a source error and rejects unsafe creative URLs', () => {
  const unsafeRows: ElevatePerformanceRow[] = [
    { ...rows[0], preview_url: 'javascript:alert(1)', destination_url: 'data:text/html,unsafe' },
  ];
  const data = buildElevateDashboardData(unsafeRows, { start: '2026-10-14', end: '2026-10-18', channel: 'all' }, 'Source unavailable');
  const meta = data.channels.find(channel => channel.platform === 'Meta');
  assert.equal(meta?.status, 'represented');
  assert.equal(meta?.spend, null);
  assert.match(meta?.limitation ?? '', /temporarily unavailable/i);
  assert.equal(data.creatives[0].previewUrl, null);
  assert.equal(data.creatives[0].destinationUrl, null);
});

test('marks a selected channel without source rows as unavailable instead of measured zero', () => {
  const metaOnly = rows.filter(row => row.platform === 'Meta');
  const data = buildElevateDashboardData(metaOnly, { start: '2026-10-15', end: '2026-10-16', channel: 'Google Search' });
  assert.equal(data.selectionUnavailable, true);
  assert.equal(data.channels.find(channel => channel.platform === 'Google Search')?.status, 'represented');
});
