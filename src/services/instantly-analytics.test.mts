import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInstantlyMonthlyGoal,
  mergeInstantlyCampaignComparisons,
  normalizeInstantlyCampaigns,
  normalizeInstantlySummary,
  normalizeInstantlyTrend,
} from './instantly-analytics-core.ts';

test('uses Instantly human replies directly because reply_count_unique already excludes automatic replies', () => {
  const summary = normalizeInstantlySummary({
    emails_sent_count: 1_500,
    contacted_count: 1_000,
    open_count_unique: 500,
    link_click_count_unique: 30,
    reply_count_unique: 20,
    reply_count_automatic_unique: 4,
    total_opportunities: 5,
  });

  assert.equal(summary.sends, 1_500);
  assert.equal(summary.contacts, 1_000);
  assert.equal(summary.openRate, 50);
  assert.equal(summary.clickRate, 3);
  assert.equal(summary.replies, 20);
  assert.equal(summary.replyRate, 2);
  assert.equal(summary.positiveReplyRate, 0.5);
});

test('normalizes, filters, and sorts campaigns with selected-period sends', () => {
  const campaigns = normalizeInstantlyCampaigns([
    {
      campaign_id: 'campaign-b',
      campaign_name: 'Agency Outreach B',
      campaign_status: 1,
      emails_sent_count: '500',
      contacted_count: '400',
      open_count_unique: '100',
      reply_count_unique: '8',
      reply_count_automatic_unique: '3',
      total_opportunities: '2',
    },
    {
      campaign_id: 'campaign-a',
      campaign_name: 'Agency Outreach A',
      campaign_status: 1,
      emails_sent_count: 1_000,
      contacted_count: 800,
      open_count_unique: 400,
      link_click_count_unique: 25,
      reply_count_unique: 16,
      reply_count_automatic_unique: 4,
      total_opportunities: 4,
    },
    {
      campaign_id: 'inactive-in-window',
      campaign_name: 'No delivery this period',
      emails_sent_count: 0,
      contacted_count: 10,
      open_count_unique: 10,
    },
  ]);

  assert.deepEqual(campaigns.map(row => row.campaignId), ['campaign-a', 'campaign-b']);
  assert.equal(campaigns[0].replyRate, 2);
  assert.equal(campaigns[0].positiveReplyRate, 0.5);
  assert.equal(campaigns[1].openRate, 25);
});

test('handles zero contacts and malformed numeric values without NaN rates', () => {
  const summary = normalizeInstantlySummary({
    emails_sent_count: 'not-a-number',
    contacted_count: 0,
    open_count_unique: 'also-not-a-number',
  });

  assert.equal(summary.sends, 0);
  assert.equal(summary.openRate, 0);
  assert.equal(summary.replyRate, 0);
});

test('projects monthly sends using elapsed time instead of treating today as complete', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const summary = normalizeInstantlySummary({
    emails_sent_count: 4_950,
    contacted_count: 3_841,
    reply_count_unique: 4,
    reply_count_automatic_unique: 3,
  });
  const goal = buildInstantlyMonthlyGoal(summary, now);

  assert.equal(goal.monthStart, '2026-09-01');
  assert.equal(goal.dataThrough, '2026-09-15');
  assert.equal(goal.sendProgress, 49.5);
  assert.equal(goal.replyRate, 4 / 3_841 * 100);
  assert.equal(Math.round(goal.projectedSends), 10_241);
});

test('merges current and comparison campaign rows, including comparison-only campaigns', () => {
  const current = normalizeInstantlyCampaigns([
    { campaign_id: 'a', campaign_name: 'Campaign A', emails_sent_count: 100, contacted_count: 80 },
  ]);
  const previous = normalizeInstantlyCampaigns([
    { campaign_id: 'a', campaign_name: 'Campaign A', emails_sent_count: 50, contacted_count: 40 },
    { campaign_id: 'b', campaign_name: 'Campaign B', emails_sent_count: 25, contacted_count: 20 },
  ]);

  const merged = mergeInstantlyCampaignComparisons(current, previous);
  assert.deepEqual(merged.map(row => row.campaignId), ['a', 'b']);
  assert.equal(merged[0].sends, 100);
  assert.equal(merged[0].comparison.sends, 50);
  assert.equal(merged[1].sends, 0);
  assert.equal(merged[1].comparison.sends, 25);
});

test('normalizes daily Instantly analytics into scorecard-compatible trend points', () => {
  const trend = normalizeInstantlyTrend([
    {
      date: '2026-09-10', sent: 100, contacted: 80, unique_opened: 20,
      unique_clicks: 4, unique_replies: 2, unique_replies_automatic: 9,
      unique_opportunities: 1,
    },
  ], '2026-09-10', '2026-09-10');

  assert.deepEqual(trend, [{
    date: '2026-09-10', sends: 100, contacts: 80, opens: 20, clicks: 4,
    replies: 2, positiveReplies: 1, openRate: 25, clickRate: 5,
    replyRate: 2.5, positiveReplyRate: 1.25,
  }]);
});

test('fills missing trend dates and leaves activity rates null when no contacts were sent', () => {
  const trend = normalizeInstantlyTrend([
    { date: '2026-09-10', sent: 100, contacted: 80, unique_opened: 20 },
    { date: '2026-09-12', sent: 0, contacted: 0, unique_opened: 5, unique_replies: 1 },
  ], '2026-09-10', '2026-09-12');

  assert.equal(trend.length, 3);
  assert.deepEqual(trend.map(point => point.date), ['2026-09-10', '2026-09-11', '2026-09-12']);
  assert.equal(trend[1].sends, 0);
  assert.equal(trend[1].openRate, null);
  assert.equal(trend[2].opens, 5);
  assert.equal(trend[2].openRate, null);
  assert.equal(trend[2].replyRate, null);
});
