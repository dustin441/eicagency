import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildElevateDashboardData, type ElevatePerformanceRow } from './elevate-analytics-core.ts';
import { positionViewportPopover } from '../lib/popover-position.ts';

const rows: ElevatePerformanceRow[] = [
  { date: '2026-10-15', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 1000, clicks: 50, spend: 25, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: {} },
  { date: '2026-10-16', platform: 'Meta', account_id: '1', campaign_id: 'm1', campaign_name: 'Elevate Meta', creative_id: 'a1', creative_name: 'Workshop video', impressions: 500, clicks: 20, spend: 10, form_fills: null, preview_url: 'https://example.com/a1', destination_url: null, metadata: {} },
  { date: '2026-10-16', platform: 'Google Search', account_id: '2', campaign_id: 'g1', campaign_name: 'Elevate Search', creative_id: 'g-ad', creative_name: 'Responsive search ad', impressions: 200, clicks: 10, spend: 30, form_fills: 2, preview_url: null, destination_url: 'https://example.com', metadata: {} },
];

test('aggregates selected rows and keeps creative-level performance', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.equal(data.totalSpend, 65);
  assert.equal(data.totalImpressions, 1700);
  assert.equal(data.totalClicks, 80);
  assert.equal(data.ctr, 80 / 1700 * 100);
  assert.equal(data.formFills, 2);
  assert.equal(data.formFillCoverage, 'partial');
  assert.equal(data.creatives.length, 2);
  const meta = data.creatives.find(row => row.creativeId === 'a1');
  assert.equal(meta?.spend, 35);
  assert.equal(meta?.impressions, 1500);
  assert.equal(meta?.formFills, null);
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
  assert.match(component, /<MetaAdPreviews/);
  assert.match(component, /<GoogleAdPreviews/);
  assert.match(component, /LinkedIn Sponsored Content/);
  assert.ok(component.indexOf('<MetaAdPreviews creatives=') < component.indexOf('Performance by creative'), 'previews should appear before the performance table');
  assert.doesNotMatch(component, />Open preview</);
  assert.doesNotMatch(component, /Ad Previews Tab|setActiveTab/);
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
  assert.equal(data.formFillCoverage, 'unavailable');
});

test('represents every required channel and documents unavailable sources', () => {
  const data = buildElevateDashboardData(rows, { start: '2026-10-15', end: '2026-10-16', channel: 'all' });
  assert.deepEqual(data.channels.map(channel => channel.platform), ['Google Search', 'Meta', 'LinkedIn', 'GroundTruth']);
  assert.equal(data.channels.find(channel => channel.platform === 'Meta')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'Google Search')?.status, 'connected');
  assert.equal(data.channels.find(channel => channel.platform === 'LinkedIn')?.status, 'represented');
  assert.match(data.channels.find(channel => channel.platform === 'GroundTruth')?.limitation ?? '', /manually/i);
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
