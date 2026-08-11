import assert from 'node:assert/strict';
import { buildProductChannelKpiRows } from '../src/services/spartaco-product-channel-kpis.ts';

const zero = () => ({
  ad_impressions: 0,
  ad_clicks: 0,
  ad_cost: 0,
  ad_conversions: 0,
  ad_purchases: 0,
  ad_revenue: 0,
  ga4_sessions: 0,
  ga4_engaged_sessions: 0,
  ga4_total_revenue: 0,
  email_total_sent: 0,
  email_opens: 0,
  email_clicks: 0,
  gsc_clicks: 0,
  gsc_impressions: 0,
  gsc_avg_position: 0,
  social_impressions: 0,
  social_interactions: 0,
  social_engagement: 0,
});

{
  const current = {
    ...zero(),
    ad_impressions: 1000,
    ad_cost: 200,
    ad_revenue: 500,
    ga4_sessions: 800,
    ga4_engaged_sessions: 400,
    ga4_total_revenue: 900,
    email_total_sent: 100,
    email_clicks: 12,
    gsc_impressions: 3000,
    gsc_clicks: 150,
    social_impressions: 500,
    social_interactions: 25,
  };
  const previous = {
    ...zero(),
    ad_impressions: 500,
    ad_cost: 100,
    ad_revenue: 200,
    ga4_sessions: 400,
    ga4_engaged_sessions: 180,
    ga4_total_revenue: 450,
    email_total_sent: 80,
    email_clicks: 8,
    gsc_impressions: 1500,
    gsc_clicks: 75,
    social_impressions: 250,
    social_interactions: 10,
  };
  const rows = buildProductChannelKpiRows(current, previous);
  assert.deepEqual(rows.map(row => row.channel), ['Paid Media', 'Website', 'Email', 'Search', 'Social']);
  assert.deepEqual(rows.map(row => row.metric), ['ROAS', 'GA4 Revenue', 'Email Clicks', 'GSC Clicks', 'Social Interactions']);
  assert.equal(rows[0].value, 2.5);
  assert.equal(rows[0].previousValue, 2);
  assert.equal(rows[1].value, 900);
  assert.ok(rows.every(row => row.available));
}

{
  const current = { ...zero(), ad_impressions: 100, ad_cost: 50, ad_conversions: 4 };
  const rows = buildProductChannelKpiRows(current, zero());
  assert.equal(rows[0].metric, 'Leads');
  assert.equal(rows[0].value, 4);
  assert.equal(rows[0].format, 'number');
  assert.equal(rows[0].available, true);
  assert.equal(rows[1].available, false);
  assert.equal(rows[1].value, null);
}

{
  const current = { ...zero(), email_total_sent: 100, email_clicks: 0 };
  const rows = buildProductChannelKpiRows(current, zero());
  const email = rows.find(row => row.channel === 'Email');
  assert.equal(email?.available, true);
  assert.equal(email?.value, 0);
  assert.equal(email?.previousAvailable, false);
  assert.equal(email?.previousValue, null);
}

{
  const availability = { paid: true, website: false, email: false, search: false, social: false };
  const unavailable = { paid: false, website: false, email: false, search: false, social: false };
  const rows = buildProductChannelKpiRows(zero(), zero(), availability, unavailable);
  assert.equal(rows[0].metric, 'Leads');
  assert.equal(rows[0].available, true);
  assert.equal(rows[0].value, 0);
  assert.equal(rows[0].previousAvailable, false);
  assert.equal(rows[0].previousValue, null);
}

{
  const availability = { paid: true, website: false, email: false, search: false, social: false };
  const current = { ...zero(), ad_impressions: 100, ad_revenue: 100, ad_purchases: 1 };
  const rows = buildProductChannelKpiRows(current, zero(), availability, availability);
  assert.equal(rows[0].metric, 'ROAS');
  assert.equal(rows[0].available, true);
  assert.equal(rows[0].value, null);
  assert.equal(rows[0].previousValue, null);
}

console.log('Spartaco product channel KPI checks passed');
