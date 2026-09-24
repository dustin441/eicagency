import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../src/', import.meta.url);
const layout = fs.readFileSync(new URL('app/dashboard/layout.tsx', root), 'utf8');
const authGuard = fs.readFileSync(new URL('lib/auth-guard.ts', root), 'utf8');
const login = fs.readFileSync(new URL('app/login/page.tsx', root), 'utf8');
const service = fs.readFileSync(new URL('services/medibrane-analytics.ts', root), 'utf8');
const page = fs.readFileSync(new URL('app/dashboard/medibrane/page.tsx', root), 'utf8');
const actions = fs.readFileSync(new URL('app/dashboard/medibrane/actions.ts', root), 'utf8');
const component = fs.readFileSync(new URL('components/MedibraneDashboardClient.tsx', root), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/medibrane_meta.sql', import.meta.url), 'utf8');
const googleMigration = fs.readFileSync(new URL('../supabase/medibrane_google.sql', import.meta.url), 'utf8');
const creativeService = fs.readFileSync(new URL('services/medibrane-creative-analytics.ts', root), 'utf8');
const creativePage = fs.readFileSync(new URL('app/dashboard/medibrane/creatives/page.tsx', root), 'utf8');
const creativeComponent = fs.readFileSync(new URL('components/MedibraneCreativeAnalysisClient.tsx', root), 'utf8');
const adPreviews = fs.readFileSync(new URL('components/AdPreviews.tsx', root), 'utf8');
const creativeDeepDive = fs.readFileSync(new URL('components/CreativeDeepDiveSections.tsx', root), 'utf8');
const creativeMigration = fs.readFileSync(new URL('../supabase/medibrane_creative_analytics.sql', import.meta.url), 'utf8');
const sync = await import('./sync-medibrane-meta.mjs');

assert.match(layout, /id:\s*'medibrane'/, 'Medibrane must be available in the client switcher');
assert.match(layout, /name:\s*'MediBraine'/, 'Use the requested client-facing MediBraine name');
assert.match(layout, /\/dashboard\/medibrane/, 'Medibrane navigation must point to its dashboard');
assert.match(layout, /\/dashboard\/medibrane\/creatives/, 'Medibrane navigation must include Ad Analysis');
assert.match(authGuard, /medibrane:\s*'\/dashboard\/medibrane'/, 'Server access fallback must know the Medibrane route');
assert.match(login, /medibrane:\s*'\/dashboard\/medibrane'/, 'Login redirect must know the Medibrane route');
assert.match(page, /requireClientAccess\('medibrane'\)/, 'The page must enforce client access server-side');
assert.match(service, /fetchPagedRows\(db, 'medibrane_meta'/, 'Dashboard analytics must read the Medibrane Meta table');
assert.match(service, /fetchPagedRows\(db, 'medibrane_google'/, 'Dashboard analytics must read the Medibrane Google table');
assert.match(service, /\.order\('campaign_id'/, 'Paged reads must use immutable campaign ID as a deterministic tie-breaker');
assert.match(service, /const key = `\$\{row\.campaign_id\}/, 'Campaign comparisons must use immutable campaign IDs');
assert.match(service, /currency:\s*'ILS'/, 'Meta rows must be tagged with ILS');
assert.match(service, /currency:\s*'USD'/, 'Google rows must be tagged with USD');
assert.match(actions, /\.eq\('id', latest\.id\)/, 'Budget edits must update only the latest budget period');
assert.match(component, /Meta & Google Ads Performance Dashboard/, 'Dashboard must identify both paid-media sources');
assert.match(component, />MediBraine</, 'Dashboard must use the client-facing MediBraine name');
assert.doesNotMatch(component, /label="Leads"/, 'Platform-attributed leads must not be summed across Meta and Google');
assert.match(component, /label="Meta Leads"/, 'Meta-attributed leads must remain separate');
assert.match(component, /label="Google Leads"/, 'Google-attributed leads must remain separate');
assert.match(service, /hasCurrentData:\s*curr\.length > 0/, 'Channel reporting must distinguish unavailable source data from a real zero');
assert.match(component, /Unavailable/, 'Unavailable source periods must be labeled rather than rendered as zero');
assert.doesNotMatch(component, /key: 'conversions' as const/, 'Cross-channel trends must not sum platform-attributed leads');
assert.match(component, /label="Meta Spend"/, 'Meta spend must have its own ILS KPI');
assert.match(component, /label="Meta Cost \/ Lead"/, 'Meta cost per lead must have its own ILS KPI');
assert.match(component, /label="Google Spend"/, 'Google spend must have its own USD KPI');
assert.match(component, /label="Google Cost \/ Lead"/, 'Google cost per lead must have its own USD KPI');
assert.match(component, /<FilterBar showChannel=\{false\}/, 'Dashboard must not expose a selector that is not wired into Medibrane queries');
assert.doesNotMatch(component, /Spend & Performance/, 'The cross-channel trend must not mix ILS and USD spend');
assert.match(component, /Volume Trends/, 'The cross-channel trend must show only safely aggregatable volume metrics');
assert.match(component, /Meta Weekly Executive Summary/, 'The existing weekly readout must remain explicitly Meta-only');
assert.match(component, /Meta Budget Pacing \(ILS\)/, 'Budget pacing must remain explicitly Meta/ILS');
assert.match(component, /fmtMoney\(row\.spend, row\.currency\)/, 'Channel spend must use the row currency');
assert.match(component, /groupedRows/, 'Campaigns must be grouped by channel before monetary sorting');
assert.match(migration, /create table if not exists public\.medibrane_meta/i, 'Migration must create the Meta performance table');
assert.match(migration, /unique \(date, campaign_id\)/i, 'Daily campaign rows must be idempotently upsertable');
assert.match(googleMigration, /create table if not exists public\.medibrane_google/i, 'Migration must create the Google performance table');
assert.match(googleMigration, /account_id text not null check \(account_id = '8502300209'\)/i, 'Google table must be locked to the approved account');
assert.match(googleMigration, /currency text not null default 'USD' check \(currency = 'USD'\)/i, 'Google rows must declare USD');
assert.match(googleMigration, /campaign_status text/i, 'Google rows must retain campaign status');
assert.match(googleMigration, /campaign_type text/i, 'Google rows must retain campaign type');
assert.match(googleMigration, /cost numeric\(18, 6\)/i, 'Google spend must preserve native micro-unit precision');
assert.match(googleMigration, /conversion action 7769953817/i, 'Google conversions must be scoped to the approved HubSpot lead action');
assert.match(googleMigration, /unique \(date, campaign_id\)/i, 'Google daily campaign rows must be idempotently upsertable');
assert.match(googleMigration, /America\/Los_Angeles/, 'Google schema must document the account timezone');
assert.match(creativePage, /requireClientAccess\('medibrane'\)/, 'Ad Analysis must enforce client access server-side');
assert.match(creativeService, /medibrane_meta_ads_creatives/, 'Ad Analysis must read ad-level Meta creative performance');
assert.match(creativeService, /medibrane_creative_ai_insights/, 'Ad Analysis must read persisted Creative Vision insights');
assert.match(creativeService, /days - 1/, 'A 30-day creative window must contain exactly 30 inclusive UTC dates');
assert.match(creativeService, /\.lte\('date', end\)/, 'Creative analytics must cap the rolling window at its declared end date');
assert.match(creativeService, /\.order\('ad_id'/, 'Creative pagination must use a stable ad ID tie-breaker');
assert.match(creativeService, /referenceMeta/, 'Creative recommendations must use evidence from the insight period');
assert.match(creativeComponent, /CreativeDeepDiveSections/, 'Ad Analysis must render structured creative recommendations');
assert.match(creativeComponent, /MetaAdPreviews/, 'Ad Analysis must render real Meta ad creatives');
assert.match(creativeComponent, /currencySymbol="₪"/, 'MediBraine creative costs must use the Meta account currency');
assert.match(creativeComponent, /referenceCandidates=\{referenceCandidates\}/, 'AI test references must use the insight-period evidence snapshot');
assert.match(adPreviews, /currencySymbol = '\$'/, 'Shared Meta previews must preserve USD as the default for existing clients');
assert.match(creativeDeepDive, /currencySymbol = '\$'/, 'Shared deep-dive cards must preserve USD as the default for existing clients');
assert.match(creativeDeepDive, /fmtMoney\(leader\.spend, currencySymbol\)/, 'Deep-dive leader spend must honor the client currency');
assert.match(creativeMigration, /create table if not exists public\.medibrane_meta_ads_creatives/i, 'Creative migration must create ad-level storage');
assert.match(creativeMigration, /unique \(ad_id, date\)/i, 'Creative rows must be idempotently upsertable');
assert.match(creativeMigration, /create table if not exists public\.medibrane_creative_ai_insights/i, 'Creative migration must persist AI insights');
assert.match(service, /medibrane_weekly_readout/, 'Performance dashboard must load the published weekly readout');

const leadActions = [
  { action_type: 'lead', value: '2' },
  { action_type: 'onsite_conversion.lead_grouped', value: '3' },
  { action_type: 'landing_page_view', value: '99' },
];
assert.equal(sync.extractLeads(leadActions), 2, 'Canonical lead actions must take precedence so grouped aliases are not double-counted');
assert.equal(
  sync.extractLeads([{ action_type: 'leadgen_grouped', value: '4' }]),
  4,
  'Lead-form fallback aliases must still be counted when the canonical aggregate is absent',
);
assert.equal(sync.extractLeads([{ action_type: 'landing_page_view', value: '10' }]), 0, 'Traffic actions must not be relabeled as leads');

const row = sync.toDailyRow({
  account_id: '1532993340786486',
  campaign_id: '120249033603090491',
  campaign_name: 'MED | BOF | Retargeting | USA | Leads',
  spend: '85.34',
  impressions: '1324',
  clicks: '19',
  inline_link_clicks: '14',
  actions: leadActions,
  date_start: '2026-09-21',
  date_stop: '2026-09-21',
});
assert.deepEqual(row, {
  date: '2026-09-21',
  account_id: '1532993340786486',
  campaign_id: '120249033603090491',
  campaign_name: 'MED | BOF | Retargeting | USA | Leads',
  ad_channel: 'Meta',
  impressions: 1324,
  clicks: 19,
  link_clicks: 14,
  cost: 85.34,
  conversions: 2,
});
assert.throws(
  () => sync.toDailyRow({ ...row, account_id: 'wrong', date_start: '2026-09-21' }),
  /account/i,
  'Sync must fail closed if Meta returns another account',
);

const usageHeaders = new Headers({
  'x-app-usage': JSON.stringify({ call_count: 12, total_cputime: 8, total_time: 9 }),
  'x-ad-account-usage': JSON.stringify({ acc_id_util_pct: 27, account_id: '1532993340786486' }),
});
assert.equal(sync.parseUsage(usageHeaders), 27, 'Usage parsing must ignore numeric account IDs and read utilization percentages only');
assert.match(sync.assertSafeGraphUrl('https://graph.facebook.com/v25.0/act_1/insights'), /^https:\/\/graph\.facebook\.com\//);
assert.throws(
  () => sync.assertSafeGraphUrl('https://example.com/steal-token'),
  /untrusted/i,
  'Meta bearer tokens must never be forwarded to untrusted pagination hosts',
);

console.log('Medibrane dashboard contract checks passed.');
