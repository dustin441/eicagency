import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { daysBetween } from '@/lib/date-utils';
import type { SpartacoFilterParams } from './spartaco-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductPerformanceRow = {
  product: string;
  brand: string;
  // Ads
  ad_impressions: number;
  ad_clicks: number;
  ad_cost: number;
  ad_conversions: number;
  ad_purchases: number;
  ad_revenue: number;
  // GA4
  ga4_sessions: number;
  ga4_engaged_sessions: number;
  ga4_pageviews: number;
  ga4_total_users: number;
  ga4_purchases: number;
  ga4_total_revenue: number;
  ga4_add_to_carts: number;
  ga4_checkouts: number;
  // Email
  email_total_sent: number;
  email_opens: number;
  email_clicks: number;
  // GSC
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_avg_position: number;   // weighted average: SUM(impressions×position) / SUM(impressions)
  gsc_keywords_ranked: number; // COUNT(DISTINCT gsc_query) per product
  // Social
  social_impressions: number;
  social_engagement: number;
  social_interactions: number;
  social_post_count: number;  // COUNT(DISTINCT social_post_id) per product
};

export type TimeSeriesGrain = 'day' | 'week' | 'month';

export type ProductTimeSeriesPoint = {
  bucket: string;
  label: string;
  // Paid
  ad_cost: number;
  ad_impressions: number;
  ad_clicks: number;
  ad_conversions: number;
  ad_purchases: number;
  ad_revenue: number;
  ad_roas: number;
  ad_cpl: number;
  // GA4
  ga4_sessions: number;
  ga4_engaged_sessions: number;
  ga4_purchases: number;
  ga4_revenue: number;
  // Email
  email_total_sent: number;
  email_opens: number;
  email_clicks: number;
  email_open_rate: number;
  email_click_rate: number;
  // GSC
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_ctr: number;
  gsc_avg_position: number;
  gsc_keywords_ranked: number;
  // Social
  social_post_count: number;
  social_impressions: number;
  social_interactions: number;
  social_engagement: number;
  social_engagement_rate: number;
};

export type TrafficBreakdownRow = {
  label: string;
  sublabel?: string;
  channelGroup?: string;
  ga4_sessions: number;
  prev_sessions: number;
  ga4_engaged_sessions: number;
  prev_engaged: number;
  tracked_leads: number;
  prev_tracked_leads: number;
  ga4_purchases: number;
  prev_purchases: number;
  ga4_total_revenue: number;
  prev_revenue: number;
  ga4_add_to_carts: number;
  prev_carts: number;
};

export type ProductDashboardData = {
  filterParams: SpartacoFilterParams;
  summary: ProductPerformanceRow;
  previousSummary: ProductPerformanceRow;
  productRows: ProductPerformanceRow[];
  previousProductRows: ProductPerformanceRow[];
  channelGroupRows: TrafficBreakdownRow[];
  sourceMediumRows: TrafficBreakdownRow[];
  timeSeries: ProductTimeSeriesPoint[];
  timeSeriesGrain: TimeSeriesGrain;
  filterOptions: {
    brands: string[];
    products: string[];
    channelGroups: string[];
    sourceMediums: string[];
  };
};

type ProductSourceRow = {
  date: string;
  source: string | null;
  brand: string | null;
  product: string | null;
  monday_product: string | null;
  parent_product: string | null;
  campaign_name: string | null;
  email_name: string | null;
  ad_channel: string | null;
  ad_origem: string | null;
  ad_impressions: number | null;
  ad_clicks: number | null;
  ad_cost: number | null;
  ad_conversions: number | null;
  ad_purchases: number | null;
  ad_revenue: number | null;
  ga4_sessions: number | null;
  ga4_engaged_sessions: number | null;
  ga4_pageviews: number | null;
  ga4_total_users: number | null;
  ga4_purchases: number | null;
  ga4_total_revenue: number | null;
  ga4_add_to_carts: number | null;
  ga4_checkouts: number | null;
  email_total_sent: number | null;
  email_opens: number | null;
  email_clicks: number | null;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_position: number | null;
  gsc_query: string | null;
  page_path: string | null;
  ga4_source: string | null;
  ga4_medium: string | null;
  ga4_default_channel_group: string | null;
  social_impressions: number | null;
  social_engagement: number | null;
  social_interactions: number | null;
  social_post_id: string | null;
};

const PRODUCT_SELECT = [
  'date',
  'source',
  'brand',
  'product',
  'monday_product',
  'parent_product',
  'campaign_name',
  'ad_channel',
  'ad_origem',
  'ad_impressions',
  'ad_clicks',
  'ad_cost',
  'ad_conversions',
  'ad_purchases',
  'ad_revenue',
  'ga4_sessions',
  'ga4_engaged_sessions',
  'ga4_pageviews',
  'ga4_total_users',
  'ga4_purchases',
  'ga4_total_revenue',
  'ga4_add_to_carts',
  'ga4_checkouts',
  'email_name',
  'email_total_sent',
  'email_opens',
  'email_clicks',
  'gsc_clicks',
  'gsc_impressions',
  'gsc_position',
  'gsc_query',
  'page_path',
  'social_impressions',
  'social_engagement',
  'social_interactions',
  'social_post_id',
  'ga4_source',
  'ga4_medium',
  'ga4_default_channel_group',
].join(',');

const SUPABASE_PAGE_SIZE = 1000;
type EqQuery<T> = { eq(column: string, value: string): T };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_ROW: ProductPerformanceRow = {
  product: 'Total', brand: 'Total',
  ad_impressions: 0, ad_clicks: 0, ad_cost: 0, ad_conversions: 0, ad_purchases: 0, ad_revenue: 0,
  ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_pageviews: 0, ga4_total_users: 0,
  ga4_purchases: 0, ga4_total_revenue: 0, ga4_add_to_carts: 0, ga4_checkouts: 0,
  email_total_sent: 0, email_opens: 0, email_clicks: 0,
  gsc_clicks: 0, gsc_impressions: 0, gsc_avg_position: 0, gsc_keywords_ranked: 0,
  social_impressions: 0, social_engagement: 0, social_interactions: 0, social_post_count: 0,
};

/**
 * Sum all rows into a single summary row.
 * gsc_avg_position uses impressions-weighted average.
 * gsc_keywords_ranked and social_post_count are summed (acceptable at merge level).
 */
function summarize(rows: ProductPerformanceRow[]): ProductPerformanceRow {
  const acc = { ...EMPTY_ROW };
  for (const row of rows) {
    acc.ad_impressions       += Number(row.ad_impressions)       || 0;
    acc.ad_clicks            += Number(row.ad_clicks)            || 0;
    acc.ad_cost              += Number(row.ad_cost)              || 0;
    acc.ad_conversions       += Number(row.ad_conversions)       || 0;
    acc.ad_purchases         += Number(row.ad_purchases)         || 0;
    acc.ad_revenue           += Number(row.ad_revenue)           || 0;
    acc.ga4_sessions         += Number(row.ga4_sessions)         || 0;
    acc.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
    acc.ga4_pageviews        += Number(row.ga4_pageviews)        || 0;
    acc.ga4_total_users      += Number(row.ga4_total_users)      || 0;
    acc.ga4_purchases        += Number(row.ga4_purchases)        || 0;
    acc.ga4_total_revenue    += Number(row.ga4_total_revenue)    || 0;
    acc.ga4_add_to_carts     += Number(row.ga4_add_to_carts)     || 0;
    acc.ga4_checkouts        += Number(row.ga4_checkouts)        || 0;
    acc.email_total_sent     += Number(row.email_total_sent)     || 0;
    acc.email_opens          += Number(row.email_opens)          || 0;
    acc.email_clicks         += Number(row.email_clicks)         || 0;
    acc.gsc_clicks           += Number(row.gsc_clicks)           || 0;
    // Weighted average position: must update avg BEFORE updating impressions total
    const rowImp = Number(row.gsc_impressions) || 0;
    const rowPos = Number(row.gsc_avg_position) || 0;
    const newImp = acc.gsc_impressions + rowImp;
    acc.gsc_avg_position = newImp > 0
      ? (acc.gsc_avg_position * acc.gsc_impressions + rowPos * rowImp) / newImp
      : 0;
    acc.gsc_impressions      = newImp;
    acc.gsc_keywords_ranked  += Number(row.gsc_keywords_ranked)  || 0;
    acc.social_impressions   += Number(row.social_impressions)   || 0;
    acc.social_engagement    += Number(row.social_engagement)    || 0;
    acc.social_interactions  += Number(row.social_interactions)  || 0;
    acc.social_post_count    += Number(row.social_post_count)    || 0;
  }
  return acc;
}

/** Merge rows that share the same product name (collapse brand dimension) */
function mergeByProduct(rows: ProductPerformanceRow[]): ProductPerformanceRow[] {
  const map = new Map<string, ProductPerformanceRow>();
  for (const row of rows) {
    const key = row.product || 'Unknown';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, product: key });
    } else {
      const merged = summarize([existing, row]);
      merged.product = key;
      merged.brand = row.brand;
      map.set(key, merged);
    }
  }
  return Array.from(map.values());
}

/**
 * For rows whose monday_product/parent_product were not set in the DB (e.g. email/GA4 'Other'
 * rows remapped in JS by remapOtherRow), derive the values from the product + brand.
 */
function textMatchesAny(text: string | null | undefined, patterns: string[]): boolean {
  const normalized = (text ?? '').toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function isHuskieNewCuttingToolsRow(row: ProductSourceRow): boolean {
  const brand = row.brand ?? '';
  const product = row.product ?? '';
  if (brand !== 'Huskie' && product !== 'New Cutting Tools') return false;

  return (
    product === 'New Cutting Tools' ||
    textMatchesAny(row.campaign_name, ['new cutting tool', 'new cutters']) ||
    textMatchesAny(row.email_name, ['new cutting tool', 'new cutters']) ||
    textMatchesAny(row.page_path, ['/lp/new-cutting-tools'])
  );
}

function applyMondayProduct(row: ProductSourceRow): ProductSourceRow {
  const p = row.product ?? '';
  const b = row.brand ?? '';
  const inferredBrand = row.brand ?? (p === 'Material Lifting' ? 'Ronin' : null);

  // Monday has Huskie "New Cutting Tools" as its own campaign/product item. Some source
  // rows currently arrive under the broader Cut/Crimp Tools bucket, so preserve the
  // Monday-aligned breakout whenever the row text/page path identifies the campaign.
  if (isHuskieNewCuttingToolsRow(row)) {
    return {
      ...row,
      brand: 'Huskie',
      monday_product: 'New Cutting Tools',
      parent_product: 'New Cutting Tools',
    };
  }

  if (row.monday_product) return { ...row, brand: inferredBrand };
  let monday = p;
  let parent = p;
  if (p === 'Fiber Driver') { monday = 'Fiber Drivers'; parent = 'Fiber Drivers'; }
  else if (p === 'Little Buddy') { monday = 'Fishtape / Little Buddy'; parent = 'Rodders'; }
  else if ((p === 'Pro Climber' || p === 'Telescoping Poles') && b === 'Jameson') { parent = 'Tree Tools & Poles'; }

  // Act-On rows are sometimes product-attributed but have no brand value in the ingest.
  // Material Lifting is a Ronin product, so fill the brand here or Ronin wrap-ups will
  // incorrectly show zero product email sends.
  const brand = inferredBrand;

  return { ...row, brand, monday_product: monday || null, parent_product: parent || null };
}

function normalizeProductRow(row: ProductSourceRow): ProductPerformanceRow {
  const gscImp = Number(row.gsc_impressions) || 0;
  const gscPos = Number(row.gsc_position) || 0;
  return {
    product: row.monday_product || row.product || 'Unknown',
    brand: row.brand || 'Unknown',
    ad_impressions:       Number(row.ad_impressions)       || 0,
    ad_clicks:            Number(row.ad_clicks)            || 0,
    ad_cost:              Number(row.ad_cost)              || 0,
    ad_conversions:       Number(row.ad_conversions)       || 0,
    ad_purchases:         Number(row.ad_purchases)         || 0,
    ad_revenue:           Number(row.ad_revenue)           || 0,
    ga4_sessions:         Number(row.ga4_sessions)         || 0,
    ga4_engaged_sessions: Number(row.ga4_engaged_sessions) || 0,
    ga4_pageviews:        Number(row.ga4_pageviews)        || 0,
    ga4_total_users:      Number(row.ga4_total_users)      || 0,
    ga4_purchases:        Number(row.ga4_purchases)        || 0,
    ga4_total_revenue:    Number(row.ga4_total_revenue)    || 0,
    ga4_add_to_carts:     Number(row.ga4_add_to_carts)     || 0,
    ga4_checkouts:        Number(row.ga4_checkouts)        || 0,
    email_total_sent:     Number(row.email_total_sent)     || 0,
    email_opens:          Number(row.email_opens)          || 0,
    email_clicks:         Number(row.email_clicks)         || 0,
    gsc_clicks:           Number(row.gsc_clicks)           || 0,
    gsc_impressions:      gscImp,
    gsc_avg_position:     gscImp > 0 ? gscPos : 0,
    gsc_keywords_ranked:  0, // overridden by Set count in aggregateByProductAndBrand
    social_impressions:   Number(row.social_impressions)   || 0,
    social_engagement:    Number(row.social_engagement)    || 0,
    social_interactions:  Number(row.social_interactions)  || 0,
    social_post_count:    0, // overridden by Set count in aggregateByProductAndBrand
  };
}

/**
 * Remap 'Other' product rows to real products based on campaign name.
 * Returns null for rows that should be excluded from the product dashboard.
 * Non-'Other' rows pass through unchanged.
 */
function remapOtherRow(row: ProductSourceRow): ProductSourceRow | null {
  // GA4 stores Pole Puller sessions under brand='Huskie' — remap brand to Tiiger so this
  // data is included when filtering by Tiiger and appears correctly in the product dropdown.
  if (row.brand === 'Huskie' && row.product === 'Pole Puller') {
    return { ...row, brand: 'Tiiger' };
  }
  if (row.brand === 'Huskie' && row.product === 'Pole Maintenance') {
    return { ...row, brand: 'Tiiger' };
  }

  if (row.product !== 'Other') return row;

  // ── Email 'Other' rows: remap by email_name patterns ────────────────────────
  if (row.source === 'email') {
    const name = (row.email_name ?? '').toLowerCase();
    if (name.includes('ps-5fs') || name.includes('ps5fs'))
      return { ...row, brand: 'Jameson', product: 'Pole Saw PS-5FS' };
    if (name.includes('petzl') || name.includes('fall arrest') || name.includes('ascend'))
      return { ...row, brand: 'Ronin', product: 'Ascenders' };
    if (name.includes('tiiger')) {
      if (name.includes('long handled')) return { ...row, brand: 'Tiiger', product: 'Long Handled Tools' };
      return { ...row, brand: 'Tiiger', product: 'Pole Puller' };
    }
    if (name.includes('pole puller'))
      return { ...row, brand: 'Tiiger', product: 'Pole Puller' };
    if (name.includes('sla-725') || name.includes('sla 725') || name.includes('sla battery'))
      return { ...row, brand: 'Huskie', product: 'Battery Tools: SLA 725' };
    if (
      name.includes('new cutting tool') || name.includes('sla-7nd')   || name.includes('sla-7r13') ||
      name.includes('sla-7500')         || name.includes('sla-7336')  || name.includes('sla-760')  ||
      name.includes('cut/crimp')        || name.includes('cut-crimp') || name.includes('4 new sla') ||
      name.includes('4 job built sla')
    ) return { ...row, brand: 'Huskie', product: 'New Cutting Tools' };
    if (name.includes('60-100 ton') || name.includes('60t/100t'))
      return { ...row, brand: 'Huskie', product: 'Huskie 60-100 Ton Presses' };
    if (name.includes('fiber driver') || name.includes('air boost'))
      return { ...row, brand: 'Jameson', product: 'Fiber Driver' };
    if (name.includes('hot-stick') || name.includes('hot stick') || name.includes('hotstick'))
      return { ...row, brand: 'Jameson', product: 'Hot-Stick' };
    if (name.includes('cable bender') || name.includes('bulldog'))
      return { ...row, brand: 'Jameson', product: 'Cable Benders' };
    if (name.includes('vine puller'))
      return { ...row, brand: 'Jameson', product: 'Vine Pullers' };
    if (name.includes('rodder') || name.includes('good buddy'))
      return { ...row, brand: 'Jameson', product: 'Rodders' };
    if (name.includes('little buddy') || name.includes('fishtape'))
      return { ...row, brand: 'Jameson', product: 'Little Buddy' };
    if (name.includes('tree tool') || name.includes('tree tools') || name.includes('alum pole') || name.includes('aluminum pole'))
      return { ...row, brand: 'Jameson', product: 'Long Handled Tools' };
    // Brand-level / general campaign (expo, announcement, etc.) — exclude from product dashboard
    return null;
  }

  // GA4 'Other' rows: remap Pole Maintenance page paths; exclude everything else
  if (row.source === 'ga4') {
    const path = (row.page_path ?? '').toLowerCase();
    if (path.includes('utility-pole-maintenance') || path.includes('pole-maintenance'))
      return { ...row, brand: 'Tiiger', product: 'Pole Maintenance' };
    return null;
  }

  // Social 'Other' rows have no product-identifying text — excluded until n8n stores post captions
  if (row.source === 'social') return null;

  // Non-ads, non-email 'Other' rows are homepage visits / brand searches — excluded
  if (row.source !== 'ads') return null;

  const c = (row.campaign_name ?? '').toLowerCase();
  const brand = row.brand ?? 'Unknown';

  // ── Filter out ──────────────────────────────────────────────────────────────
  if (c.includes('distributor stock up')) return null;
  if (c === '[lead] z' || c.trim() === 'z') return null;

  // ── Tiiger brand (mis-filed under Huskie) ───────────────────────────────────
  if (c.includes('tiiger')) {
    const product =
      c.includes('long handled')                          ? 'Long Handled Tools' :
      c.includes('pole puller')                           ? 'Pole Puller'        :
      c.includes('pole maintenance') || c.includes('utility pole') ? 'Pole Maintenance' :
      null;
    if (!product) return null;
    return { ...row, brand: 'Tiiger', product };
  }

  // ── Shopping / DSA / general ────────────────────────────────────────────────
  if (
    c.includes('shopping')           ||
    c.includes('merchant center')    ||
    c.includes('dsa')                ||
    c.includes('dynamic search')     ||
    c.includes('utilities & industrial')
  ) return { ...row, product: 'Shopping' };

  // ── Promotional campaigns ────────────────────────────────────────────────────
  if (
    c.includes('10 off')             ||
    c.includes('10% off')            ||
    c.includes('ecommerce promotion')||
    (c.includes('promo') && c.includes('10'))
  ) return { ...row, product: '10% Off Promo' };

  // ── Jameson products ─────────────────────────────────────────────────────────
  if (c.includes('tree tool') || c.includes('tree tools') || c.includes('alum pole'))
    return { ...row, brand, product: 'Long Handled Tools' };
  if (c.includes('rodder'))
    return { ...row, brand, product: 'Rodders' };
  if (c.includes('little buddy') || c.includes('fishtape'))
    return { ...row, brand, product: 'Little Buddy' };
  if (c.includes('pro climber'))
    return { ...row, brand, product: 'Pro Climber' };
  if (c.includes('telescoping pole'))
    return { ...row, brand, product: 'Telescoping Poles' };

  // ── Huskie products ──────────────────────────────────────────────────────────
  if (
    c.includes('60-100 ton') || c.includes('60t/100t') ||
    c.includes('crimp press')
  ) return { ...row, brand, product: 'Huskie 60-100 Ton Presses' };
  if (c.includes('cut/crimp') || c.includes('sla 758'))
    return { ...row, brand, product: 'Cut/Crimp Tools' };
  if (c.includes('pole maintenance') || c.includes('pole removal'))
    return { ...row, brand, product: 'Pole Maintenance' };

  // Can't attribute — exclude from product dashboard
  return null;
}

function aggregateByProductAndBrand(rows: ProductSourceRow[]): ProductPerformanceRow[] {
  const grouped  = new Map<string, ProductPerformanceRow>();
  const queries  = new Map<string, Set<string>>();
  const postIds  = new Map<string, Set<string>>();

  for (const row of rows) {
    const normalized = normalizeProductRow(row);
    const key = `${normalized.product}::${normalized.brand}`;

    // Track distinct gsc_query and social_post_id per product+brand
    if (!queries.has(key))  queries.set(key, new Set());
    if (!postIds.has(key))  postIds.set(key, new Set());
    if (row.gsc_query)       queries.get(key)!.add(row.gsc_query);
    if (row.social_post_id)  postIds.get(key)!.add(row.social_post_id);

    const existing = grouped.get(key);
    if (existing) {
      const merged = summarize([existing, normalized]);
      merged.product = normalized.product;
      merged.brand   = normalized.brand;
      grouped.set(key, merged);
    } else {
      grouped.set(key, normalized);
    }
  }

  // Apply distinct counts from Sets
  for (const [key, row] of grouped.entries()) {
    row.gsc_keywords_ranked = queries.get(key)?.size ?? 0;
    row.social_post_count   = postIds.get(key)?.size  ?? 0;
  }

  return Array.from(grouped.values()).sort((a, b) => b.ad_cost - a.ad_cost);
}

const IGNORED_SOURCES = new Set(['(not set)', '(data not available)', null, undefined]);

function sourceMediumMeta(row: ProductSourceRow): { key: string | null; label: string; sublabel: string; channelGroup?: string } {
  const ga4Source = row.ga4_source;
  const ga4Medium = row.ga4_medium;
  if (ga4Source && !IGNORED_SOURCES.has(ga4Source)) {
    const medium = ga4Medium ?? '(none)';
    return {
      key: `${ga4Source} / ${medium}`,
      label: ga4Source,
      sublabel: medium,
      channelGroup: row.ga4_default_channel_group ?? undefined,
    };
  }

  // Ads rows carry conversions/leads but not GA4 source/medium. Map the ad channel to
  // the matching source/medium bucket so the wrap-up can show traffic + paid leads together.
  if (row.source === 'ads') {
    const channel = (row.ad_channel ?? '').toLowerCase();
    if (channel.includes('google')) {
      return { key: 'google / cpc', label: 'google', sublabel: 'cpc', channelGroup: 'Paid Search / Cross-network' };
    }
    if (channel.includes('meta') || channel.includes('facebook') || channel.includes('instagram')) {
      return { key: 'fb / paid', label: 'fb', sublabel: 'paid', channelGroup: 'Paid Social' };
    }
    if (channel) {
      return { key: `${channel} / paid`, label: channel, sublabel: 'paid', channelGroup: 'Paid' };
    }
  }

  return { key: null, label: '', sublabel: '' };
}

function buildTrafficRows(
  currentRows: ProductSourceRow[],
  previousRows: ProductSourceRow[],
  keyFn: (r: ProductSourceRow) => string | null,
  metaFn: (r: ProductSourceRow) => { label: string; sublabel?: string; channelGroup?: string },
): TrafficBreakdownRow[] {
  type Acc = { sessions: number; engaged: number; leads: number; purchases: number; revenue: number; carts: number };
  const zero = (): Acc => ({ sessions: 0, engaged: 0, leads: 0, purchases: 0, revenue: 0, carts: 0 });

  const curr = new Map<string, { meta: ReturnType<typeof metaFn> } & Acc>();
  const prev = new Map<string, Acc>();

  for (const row of currentRows) {
    const key = keyFn(row);
    if (!key) continue;
    const entry = curr.get(key) ?? { meta: metaFn(row), ...zero() };
    entry.sessions  += Number(row.ga4_sessions)         || 0;
    entry.engaged   += Number(row.ga4_engaged_sessions) || 0;
    entry.leads     += Number(row.ad_conversions)       || 0;
    entry.purchases += Number(row.ga4_purchases)        || 0;
    entry.revenue   += Number(row.ga4_total_revenue)    || 0;
    entry.carts     += Number(row.ga4_add_to_carts)     || 0;
    curr.set(key, entry);
  }

  for (const row of previousRows) {
    const key = keyFn(row);
    if (!key) continue;
    const entry = prev.get(key) ?? zero();
    entry.sessions  += Number(row.ga4_sessions)         || 0;
    entry.engaged   += Number(row.ga4_engaged_sessions) || 0;
    entry.leads     += Number(row.ad_conversions)       || 0;
    entry.purchases += Number(row.ga4_purchases)        || 0;
    entry.revenue   += Number(row.ga4_total_revenue)    || 0;
    entry.carts     += Number(row.ga4_add_to_carts)     || 0;
    prev.set(key, entry);
  }

  return Array.from(curr.entries())
    .map(([key, c]) => {
      const p = prev.get(key) ?? zero();
      return {
        ...c.meta,
        ga4_sessions:         c.sessions,
        prev_sessions:        p.sessions,
        ga4_engaged_sessions: c.engaged,
        prev_engaged:         p.engaged,
        tracked_leads:        c.leads,
        prev_tracked_leads:   p.leads,
        ga4_purchases:        c.purchases,
        prev_purchases:       p.purchases,
        ga4_total_revenue:    c.revenue,
        prev_revenue:         p.revenue,
        ga4_add_to_carts:     c.carts,
        prev_carts:           p.carts,
      };
    })
    .sort((a, b) => b.ga4_sessions - a.ga4_sessions);
}

// ─── Time Series ──────────────────────────────────────────────────────────────

function weekStartKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function bucketKey(dateStr: string, grain: TimeSeriesGrain): string {
  if (grain === 'day')  return dateStr;
  if (grain === 'week') return weekStartKey(dateStr);
  return dateStr.slice(0, 7); // YYYY-MM
}

function bucketLabel(bucket: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') {
    const d = new Date(bucket + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  if (grain === 'week') {
    const d = new Date(bucket + 'T00:00:00');
    return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const [yr, mo] = bucket.split('-');
  const d = new Date(Number(yr), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildTimeSeries(rows: ProductSourceRow[], grain: TimeSeriesGrain): ProductTimeSeriesPoint[] {
  type Acc = {
    ad_cost: number; ad_impressions: number; ad_clicks: number; ad_conversions: number;
    ad_purchases: number; ad_revenue: number;
    ga4_sessions: number; ga4_engaged_sessions: number; ga4_purchases: number; ga4_revenue: number;
    email_total_sent: number; email_opens: number; email_clicks: number;
    gsc_clicks: number; gsc_impressions: number; _gsc_imp_x_pos: number;
    social_impressions: number; social_interactions: number; social_engagement: number;
    _queries: Set<string>; _posts: Set<string>;
  };

  const newAcc = (): Acc => ({
    ad_cost: 0, ad_impressions: 0, ad_clicks: 0, ad_conversions: 0,
    ad_purchases: 0, ad_revenue: 0,
    ga4_sessions: 0, ga4_engaged_sessions: 0, ga4_purchases: 0, ga4_revenue: 0,
    email_total_sent: 0, email_opens: 0, email_clicks: 0,
    gsc_clicks: 0, gsc_impressions: 0, _gsc_imp_x_pos: 0,
    social_impressions: 0, social_interactions: 0, social_engagement: 0,
    _queries: new Set(), _posts: new Set(),
  });

  const map = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.date) continue;
    const bk = bucketKey(row.date, grain);
    const b = map.get(bk) ?? newAcc();

    b.ad_cost              += Number(row.ad_cost)              || 0;
    b.ad_impressions       += Number(row.ad_impressions)       || 0;
    b.ad_clicks            += Number(row.ad_clicks)            || 0;
    b.ad_conversions       += Number(row.ad_conversions)       || 0;
    b.ad_purchases         += Number(row.ad_purchases)         || 0;
    b.ad_revenue           += Number(row.ad_revenue)           || 0;
    b.ga4_sessions         += Number(row.ga4_sessions)         || 0;
    b.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
    b.ga4_purchases        += Number(row.ga4_purchases)        || 0;
    b.ga4_revenue          += Number(row.ga4_total_revenue)    || 0;
    b.email_total_sent     += Number(row.email_total_sent)     || 0;
    b.email_opens          += Number(row.email_opens)          || 0;
    b.email_clicks         += Number(row.email_clicks)         || 0;
    b.gsc_clicks           += Number(row.gsc_clicks)           || 0;
    const imp               = Number(row.gsc_impressions)      || 0;
    b.gsc_impressions      += imp;
    b._gsc_imp_x_pos       += imp * (Number(row.gsc_position) || 0);
    b.social_impressions   += Number(row.social_impressions)   || 0;
    b.social_interactions  += Number(row.social_interactions)  || 0;
    b.social_engagement    += Number(row.social_engagement)    || 0;
    if (row.gsc_query)      b._queries.add(row.gsc_query);
    if (row.social_post_id) b._posts.add(row.social_post_id);

    map.set(bk, b);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bk, b]) => ({
      bucket: bk,
      label:  bucketLabel(bk, grain),
      ad_cost:              b.ad_cost,
      ad_impressions:       b.ad_impressions,
      ad_clicks:            b.ad_clicks,
      ad_conversions:       b.ad_conversions,
      ad_purchases:         b.ad_purchases,
      ad_revenue:           b.ad_revenue,
      ad_roas:              b.ad_cost > 0 ? b.ad_revenue / b.ad_cost : 0,
      ad_cpl:               b.ad_conversions > 0 ? b.ad_cost / b.ad_conversions : 0,
      ga4_sessions:         b.ga4_sessions,
      ga4_engaged_sessions: b.ga4_engaged_sessions,
      ga4_purchases:        b.ga4_purchases,
      ga4_revenue:          b.ga4_revenue,
      email_total_sent:     b.email_total_sent,
      email_opens:          b.email_opens,
      email_clicks:         b.email_clicks,
      email_open_rate:      b.email_total_sent > 0 ? b.email_opens  / b.email_total_sent : 0,
      email_click_rate:     b.email_total_sent > 0 ? b.email_clicks / b.email_total_sent : 0,
      gsc_clicks:           b.gsc_clicks,
      gsc_impressions:      b.gsc_impressions,
      gsc_ctr:              b.gsc_impressions > 0 ? b.gsc_clicks / b.gsc_impressions : 0,
      gsc_avg_position:     b.gsc_impressions > 0 ? b._gsc_imp_x_pos / b.gsc_impressions : 0,
      gsc_keywords_ranked:  b._queries.size,
      social_post_count:    b._posts.size,
      social_impressions:   b.social_impressions,
      social_interactions:  b.social_interactions,
      social_engagement:    b.social_engagement,
      social_engagement_rate: b.social_impressions > 0 ? b.social_interactions / b.social_impressions : 0,
    }));
}

async function fetchPagedProductRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: unknown[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      throw new Error(error.message ?? 'Supabase query failed');
    }

    const page = (data ?? []) as unknown as T[];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export async function fetchSpartacoProductData(
  params: SpartacoFilterParams
): Promise<ProductDashboardData> {
  const supabase = createSpartacoSupabaseClient();

  const brandArg   = params.brand   && params.brand   !== 'all' ? params.brand   : null;
  const productArg = params.product && params.product !== 'all' ? params.product : null;

  function applyProductFilters<T extends EqQuery<T>>(query: T) {
    let next = query;
    if (brandArg) {
      if (brandArg === 'Tiiger') {
        // Tiiger data lives in three places in the DB:
        // 1. Direct brand='Tiiger' rows
        // 2. brand='Huskie' / product='Other' ads rows — campaign names map to Tiiger via remapOtherRow()
        // 3. brand='Huskie' / product='Pole Puller' GA4 rows — stored under wrong brand; remapOtherRow()
        //    re-brands these to Tiiger. Without this clause, all Pole Puller site traffic is invisible.
        next = (next as unknown as { or(f: string): T }).or('brand.eq.Tiiger,and(brand.eq.Huskie,product.eq.Other),and(brand.eq.Huskie,product.eq.Pole Puller),and(brand.eq.Huskie,product.eq.Pole Maintenance)');
      } else {
        // Include email rows too: Act-On product rows can have brand=NULL at ingest time,
        // then get a product-based brand inferred in applyMondayProduct().
        next = (next as unknown as { or(f: string): T }).or(`brand.eq.${brandArg},source.eq.email`);
      }
    }
    // productArg is NOT applied at the DB level because many products (e.g. 'Pole Maintenance',
    // 'Shopping', 'Cut/Crimp Tools') only exist after remapOtherRow() transforms 'Other' rows.
    // Filtering by product in the DB would return zero rows for those products. Instead,
    // product filtering happens in JavaScript after remapping (see currentSourceRows below).
    return next;
  }

  // DB-level filter: for 'Other' product rows, only load ads-source rows (for remapping).
  // GA4/GSC/email/social 'Other' rows are homepage/brand-level data not relevant to
  // product performance. This eliminates 800k+ rows from being transferred.
  //
  // The options query intentionally omits brand AND product filters so the dropdowns
  // always show all available choices — not just the currently-selected value.
  const OPTION_SELECT = 'date,source,brand,product,monday_product,parent_product,campaign_name,email_name';
  const [rawCurrentRows, rawPreviousRows, rawOptionRows] = await Promise.all([
    fetchPagedProductRows<ProductSourceRow>(async (from, to) =>
      await applyProductFilters(
        supabase
          .from('spartaco_master_products')
          .select(PRODUCT_SELECT)
          .gte('date', params.start)
          .lte('date', params.end)
          .or('product.neq.Other,source.eq.ads,source.eq.email')
          .order('date',    { ascending: true })
          .order('brand',   { ascending: true })
          .order('product', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedProductRows<ProductSourceRow>(async (from, to) =>
      await applyProductFilters(
        supabase
          .from('spartaco_master_products')
          .select(PRODUCT_SELECT)
          .gte('date', params.compStart)
          .lte('date', params.compEnd)
          .or('product.neq.Other,source.eq.ads,source.eq.email')
          .order('date',    { ascending: true })
          .order('brand',   { ascending: true })
          .order('product', { ascending: true })
          .range(from, to)
      )
    ),
    fetchPagedProductRows<ProductSourceRow>(async (from, to) =>
      supabase
        .from('spartaco_master_products')
        .select(OPTION_SELECT)
        .gte('date', params.start)
        .lte('date', params.end)
        .or('product.neq.Other,source.eq.ads,source.eq.email')
        .range(from, to)
    ),
  ]);

  // Remap 'Other' ads rows to real products; filter out unresolvable ones and null-brand rows.
  // After remapping, applyMondayProduct fills in monday_product/parent_product for rows
  // that were remapped in JS (those columns are NULL in the DB for 'Other' rows).
  // Product filter uses monday_product for ad rows and parent_product for all other sources
  // (GA4, email, GSC, social) so selecting "Air Boost" shows Air Boost ads but all
  // Fiber Drivers GA4/email traffic, matching Monday.com's rollup model.
  const remappedOptionRows = rawOptionRows
    .map(remapOtherRow)
    .filter((r): r is ProductSourceRow => r !== null)
    .map(applyMondayProduct)
    .filter((r): r is ProductSourceRow => r.brand !== null);

  // Build monday → parent lookup from the unfiltered option set
  const mondayParentMap = new Map<string, string>();
  for (const r of remappedOptionRows) {
    const m = r.monday_product || r.product;
    const p = r.parent_product || r.monday_product || r.product;
    if (m && p) mondayParentMap.set(m, p);
  }
  // If productArg is not found in the map, it's a stale/invalid URL param — treat as no filter.
  const effectiveProductArg = (productArg && mondayParentMap.has(productArg)) ? productArg : null;
  const effectiveParentArg  = effectiveProductArg ? (mondayParentMap.get(effectiveProductArg) ?? effectiveProductArg) : null;

  function applyProductFilter(r: ProductSourceRow): boolean {
    if (!effectiveProductArg) return true;
    const monday = r.monday_product || r.product;
    if (r.source === 'ads') return monday === effectiveProductArg;
    const parent = r.parent_product || r.monday_product || r.product;
    return parent === effectiveParentArg;
  }

  const currentSourceRows  = rawCurrentRows
    .map(remapOtherRow)
    .filter((r): r is ProductSourceRow => r !== null)
    .map(applyMondayProduct)
    .filter((r): r is ProductSourceRow => r.brand !== null)
    .filter(r => !brandArg || r.brand === brandArg)
    .filter(applyProductFilter);
  const previousSourceRows = rawPreviousRows
    .map(remapOtherRow)
    .filter((r): r is ProductSourceRow => r !== null)
    .map(applyMondayProduct)
    .filter((r): r is ProductSourceRow => r.brand !== null)
    .filter(r => !brandArg || r.brand === brandArg)
    .filter(applyProductFilter);

  const current             = aggregateByProductAndBrand(currentSourceRows);
  const previous            = aggregateByProductAndBrand(previousSourceRows);
  const productRows         = mergeByProduct(current);
  const previousProductRows = mergeByProduct(previous);

  // Summary-level distinct counts use the raw source rows for accuracy
  const summaryCurrentRaw  = summarize(current);
  summaryCurrentRaw.gsc_keywords_ranked = new Set(
    currentSourceRows.map(r => r.gsc_query).filter((q): q is string => !!q)
  ).size;
  summaryCurrentRaw.social_post_count = new Set(
    currentSourceRows.map(r => r.social_post_id).filter((p): p is string => !!p)
  ).size;

  const summaryPreviousRaw = summarize(previous);
  summaryPreviousRaw.gsc_keywords_ranked = new Set(
    previousSourceRows.map(r => r.gsc_query).filter((q): q is string => !!q)
  ).size;
  summaryPreviousRaw.social_post_count = new Set(
    previousSourceRows.map(r => r.social_post_id).filter((p): p is string => !!p)
  ).size;

  const channelGroupRows = buildTrafficRows(
    currentSourceRows,
    previousSourceRows,
    r => r.ga4_default_channel_group || null,
    r => ({ label: r.ga4_default_channel_group ?? 'Unknown' }),
  );

  const sourceMediumRows = buildTrafficRows(
    currentSourceRows,
    previousSourceRows,
    r => sourceMediumMeta(r).key,
    r => {
      const meta = sourceMediumMeta(r);
      return {
        label:        meta.label,
        sublabel:     meta.sublabel,
        channelGroup: meta.channelGroup,
      };
    },
  );

  const totalDays = daysBetween(params.start, params.end);
  const grain: TimeSeriesGrain = totalDays <= 30 ? 'day' : totalDays <= 90 ? 'week' : 'month';

  // Build filter options from the unfiltered options query (remappedOptionRows already built above).
  const EXCLUDED_PRODUCTS = new Set(['Other', 'Brand', 'Shopping', '10% Off Promo', null, undefined, 'Unknown', '']);

  const allBrands = [
    ...new Set(remappedOptionRows.map(r => r.brand).filter((b): b is string => !!b && b !== 'Unknown')),
  ].sort();

  // Product dropdown uses monday_product (the Monday.com-aligned label).
  // Options are brand-filtered when a brand is selected; never filtered by product itself.
  const allProducts = [
    ...new Set(
      remappedOptionRows
        .filter(r => !brandArg || r.brand === brandArg)
        .map(r => r.monday_product || r.product)
        .filter((p): p is string => !!p && !EXCLUDED_PRODUCTS.has(p)),
    ),
  ].sort() as string[];

  return {
    filterParams:         params,
    summary:              summaryCurrentRaw,
    previousSummary:      summaryPreviousRaw,
    productRows,
    previousProductRows,
    channelGroupRows,
    sourceMediumRows,
    timeSeries:           buildTimeSeries(currentSourceRows, grain),
    timeSeriesGrain:      grain,
    filterOptions: {
      brands:        allBrands,
      products:      allProducts,
      channelGroups: channelGroupRows.map(r => r.label).filter(l => l !== 'Unassigned'),
      sourceMediums: sourceMediumRows.slice(0, 25).map(r => `${r.label} / ${r.sublabel ?? ''}`),
    },
  };
}
