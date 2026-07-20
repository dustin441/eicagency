import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates, toIsoDate } from '@/lib/date-utils';
import { isGoodGameEcommerceCampaign } from '@/lib/goodgame-campaign-scope';
import type { MetaCreative } from '@/services/analytics';

// ─── Good Game — Sales (eCommerce) tab ─────────────────────────────────────────
// Mirrors the Spartaco eCommerce tab (purchases + revenue → ROAS), but scoped to
// Good Game's eCommerce campaign taxonomy (Meta + Google) and with NO brand/product
// dimension — Good Game is a single brand. Data comes from the `goodgame_master`
// UNION view in the EIC Clients Supabase project (lozgnyxixzfxokllevtb).
//
// eCommerce campaigns are identified by the shared campaign classifier. Google stores its
// conversions/value in `conversions` / `revenue` (purchases is NULL for Google in
// the master view), so `rowPurchases()` falls back to `conversions`.

export type GoodGameSalesFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  channel: string; // 'all' | 'Google' | 'Meta'
};

export type GoodGameSalesSummary = {
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  revenue: number;
  ctr: number;   // ratio (clicks / impressions) — fmtPercent multiplies by 100
  cpc: number;
  roas: number;
  aov: number;   // revenue / purchases
  costPerPurchase: number;
};

export type GoodGameSalesChartPoint = {
  label: string;
  spend: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
};

export type GoodGameSalesBreakdownRow = {
  label: string;
  secondaryLabel?: string;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
  cost: number;
  prevCost: number;
  purchases: number;
  prevPurchases: number;
  revenue: number;
  prevRevenue: number;
};

export type GoodGameSalesBudgetPacing = {
  budget: number;
  metaSpend: number;
  googleSpend: number;
  totalSpend: number;
  monthStart: string;
  monthEnd: string;
};

export type GoodGameSalesDashboardData = {
  filterParams: GoodGameSalesFilterParams;
  summary: GoodGameSalesSummary;
  previousSummary: GoodGameSalesSummary;
  budgetPacing: GoodGameSalesBudgetPacing;
  daily: GoodGameSalesChartPoint[];
  weekly: GoodGameSalesChartPoint[];
  monthly: GoodGameSalesChartPoint[];
  channelRows: GoodGameSalesBreakdownRow[];
  campaignRows: GoodGameSalesBreakdownRow[];
  metaCreatives: MetaCreative[];
};

type SalesAdRow = {
  id: string;
  date: string;
  ad_id: string | null;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  cost: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  leads: number;
  final_creative_link: string | null;
  permanent_image_url: string | null;
  primary_text: string | null;
  headline: string | null;
  destination_url: string | null;
  cta_type: string | null;
  is_video: boolean | null;
  video_id: string | null;
  video_url: string | null;
  page_name: string | null;
  page_profile_image_url: string | null;
  preview_url: string | null;
};

// Ad Library URLs are not playable inline — route them to previewUrl instead.
function resolveVideoUrls(rawVideoUrl: string | null, rawPreviewUrl: string | null) {
  const isAdLibrary = rawVideoUrl?.startsWith('https://www.facebook.com/ads/library/') ?? false;
  return {
    videoUrl: !isAdLibrary && rawVideoUrl ? rawVideoUrl : '',
    previewUrl: isAdLibrary ? (rawVideoUrl ?? '') : (rawPreviewUrl ?? ''),
  };
}

function mapSalesCreatives(rows: SalesAdRow[], hiresMap: Map<string, string>): MetaCreative[] {
  const creativeMap = new Map<string, MetaCreative>();
  for (const r of rows) {
    const { videoUrl, previewUrl } = resolveVideoUrls(r.video_url, r.preview_url);
    const purchases = Number(r.purchases ?? 0);
    const existing = creativeMap.get(r.ad_name) ?? {
      name: r.ad_name || r.headline || r.campaign_name,
      campaign: r.campaign_name,
      adset: r.adset_name,
      headline: String(r.headline ?? ''),
      primaryText: String(r.primary_text ?? ''),
      finalCreativeLink: '',
      permanentImageUrl: '',
      destinationUrl: String(r.destination_url ?? ''),
      ctaType: String(r.cta_type ?? ''),
      isVideo: Boolean(r.is_video),
      videoId: String(r.video_id ?? ''),
      videoUrl,
      pageName: String(r.page_name ?? ''),
      pageProfileImageUrl: String(r.page_profile_image_url ?? ''),
      previewUrl,
      spend: 0,
      sales: 0,
      revenue: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
    };
    existing.spend += Number(r.cost ?? 0);
    existing.sales = Number(existing.sales ?? 0) + purchases;
    existing.revenue = Number(existing.revenue ?? 0) + Number(r.revenue ?? 0);
    existing.leads += purchases;
    existing.clicks += Number(r.clicks ?? 0);
    existing.impressions += Number(r.impressions ?? 0);
    existing.campaign = r.campaign_name;
    existing.adset = r.adset_name;
    const rawLink = hiresMap.get(r.ad_name) || (r.final_creative_link ?? '');
    if (rawLink) existing.finalCreativeLink = rawLink;
    if (r.permanent_image_url) existing.permanentImageUrl = r.permanent_image_url;
    if (r.headline) existing.headline = String(r.headline);
    if (r.primary_text) existing.primaryText = String(r.primary_text);
    if (r.destination_url) existing.destinationUrl = String(r.destination_url);
    if (r.cta_type) existing.ctaType = String(r.cta_type);
    if (r.is_video !== null && r.is_video !== undefined) existing.isVideo = Boolean(r.is_video);
    if (r.video_id) existing.videoId = String(r.video_id);
    if (videoUrl) existing.videoUrl = videoUrl;
    if (previewUrl) existing.previewUrl = previewUrl;
    creativeMap.set(r.ad_name, existing);
  }
  return Array.from(creativeMap.values()).sort((a, b) => b.spend - a.spend);
}

type MasterRow = {
  date: string;
  campaign_name: string;
  ad_channel: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number | null;
  purchases: number | null;
  revenue: number;
};

const SUPABASE_PAGE_SIZE = 1000;
const GOODGAME_SALES_MONTHLY_BUDGET = 5000;

// Google stores conversions in `conversions`; Meta stores purchases in `purchases`.
function rowPurchases(r: MasterRow): number {
  return Number(r.purchases ?? r.conversions ?? 0);
}

async function fetchPagedRows<T>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(error.message ?? 'Supabase query failed');
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

export function goodgameSalesParamsFromSearch(
  p: Record<string, string | undefined>
): GoodGameSalesFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('last30')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const { compStart, compEnd } = computeCompDates(start, end, 'prev_period');
  return {
    start,
    end,
    compStart: p.comp_start ?? compStart,
    compEnd: p.comp_end ?? compEnd,
    channel: p.channel ?? 'all',
  };
}

function summarise(rows: MasterRow[]): GoodGameSalesSummary {
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
  const cost = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const purchases = rows.reduce((s, r) => s + rowPurchases(r), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return {
    impressions,
    clicks,
    cost,
    purchases,
    revenue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    roas: cost > 0 ? revenue / cost : 0,
    aov: purchases > 0 ? revenue / purchases : 0,
    costPerPurchase: purchases > 0 ? cost / purchases : 0,
  };
}

function weekStart(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function labelForBucket(bucket: string, grain: 'day' | 'week' | 'month') {
  if (grain === 'day') {
    return new Date(`${bucket}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (grain === 'week') {
    const start = new Date(`${bucket}T12:00:00`);
    const end = new Date(`${bucket}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return new Date(`${bucket}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function aggregateTime(rows: MasterRow[], grain: 'day' | 'week' | 'month'): GoodGameSalesChartPoint[] {
  const bucketMap = new Map<string, { spend: number; clicks: number; purchases: number; revenue: number }>();
  for (const row of rows) {
    const bucket =
      grain === 'day' ? row.date :
      grain === 'week' ? weekStart(row.date) :
      row.date.slice(0, 7);
    const entry = bucketMap.get(bucket) ?? { spend: 0, clicks: 0, purchases: 0, revenue: 0 };
    entry.spend += Number(row.cost ?? 0);
    entry.clicks += Number(row.clicks ?? 0);
    entry.purchases += rowPurchases(row);
    entry.revenue += Number(row.revenue ?? 0);
    bucketMap.set(bucket, entry);
  }
  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      label: labelForBucket(bucket, grain),
      spend: v.spend,
      clicks: v.clicks,
      purchases: v.purchases,
      revenue: v.revenue,
      roas: v.spend > 0 ? v.revenue / v.spend : 0,
    }));
}

function aggregateBreakdown(
  currentRows: MasterRow[],
  prevRows: MasterRow[],
  keyFn: (row: MasterRow) => string,
  secondaryFn?: (row: MasterRow) => string | undefined
): GoodGameSalesBreakdownRow[] {
  const map = new Map<string, GoodGameSalesBreakdownRow>();

  function apply(rows: MasterRow[], isPrev: boolean) {
    for (const row of rows) {
      const key = keyFn(row);
      const entry = map.get(key) ?? {
        label: keyFn(row),
        secondaryLabel: secondaryFn?.(row),
        impressions: 0, prevImpressions: 0,
        clicks: 0, prevClicks: 0,
        cost: 0, prevCost: 0,
        purchases: 0, prevPurchases: 0,
        revenue: 0, prevRevenue: 0,
      };
      if (isPrev) {
        entry.prevImpressions += Number(row.impressions ?? 0);
        entry.prevClicks += Number(row.clicks ?? 0);
        entry.prevCost += Number(row.cost ?? 0);
        entry.prevPurchases += rowPurchases(row);
        entry.prevRevenue += Number(row.revenue ?? 0);
      } else {
        entry.impressions += Number(row.impressions ?? 0);
        entry.clicks += Number(row.clicks ?? 0);
        entry.cost += Number(row.cost ?? 0);
        entry.purchases += rowPurchases(row);
        entry.revenue += Number(row.revenue ?? 0);
      }
      map.set(key, entry);
    }
  }

  apply(currentRows, false);
  apply(prevRows, true);

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export async function fetchGoodGameSalesData(
  params: GoodGameSalesFilterParams
): Promise<GoodGameSalesDashboardData> {
  const db = createSpartacoSupabaseClient();
  const select = 'date,campaign_name,ad_channel,impressions,clicks,cost,conversions,purchases,revenue';

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yday = new Date(now);
  yday.setDate(yday.getDate() - 1);
  const monthEnd = yday.toISOString().split('T')[0] < monthStart ? monthStart : yday.toISOString().split('T')[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyChannel(q: any) {
    return params.channel !== 'all' ? q.eq('ad_channel', params.channel) : q;
  }

  const creativeSelect = 'id,date,ad_id,ad_name,adset_name,campaign_name,cost,impressions,clicks,purchases,revenue,leads,final_creative_link,permanent_image_url,primary_text,headline,destination_url,cta_type,is_video,video_id,video_url,page_name,page_profile_image_url,preview_url';
  const [allCurrentRows, allPrevRows, allPacingRows, budgetRes, allCreativeRows, hiresRes] = await Promise.all([
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyChannel(
        db.from('goodgame_master').select(select).gte('date', params.start).lte('date', params.end)
      )
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyChannel(
        db.from('goodgame_master').select(select).gte('date', params.compStart).lte('date', params.compEnd)
      )
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    fetchPagedRows<MasterRow>(async (from, to) =>
      await applyChannel(
        db.from('goodgame_master').select(select).gte('date', monthStart).lte('date', monthEnd)
      )
        .order('date', { ascending: true })
        .order('campaign_name', { ascending: true })
        .order('ad_channel', { ascending: true })
        .range(from, to)
    ),
    db.from('budgets').select('budget').eq('client', 'goodgame_sales').order('period_start', { ascending: false }).limit(1),
    params.channel === 'Google'
      ? Promise.resolve([] as SalesAdRow[])
      : fetchPagedRows<SalesAdRow>(async (from, to) =>
          await db.from('goodgame_meta_ads')
            .select(creativeSelect)
            .gte('date', params.start)
            .lte('date', params.end)
            .order('date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to)
        ),
    db.from('goodgame_ad_hires').select('ad_name,hires_url'),
  ]);

  const currentRows = allCurrentRows.filter((row) => isGoodGameEcommerceCampaign(row.campaign_name));
  const prevRows = allPrevRows.filter((row) => isGoodGameEcommerceCampaign(row.campaign_name));
  const pacingRows = allPacingRows.filter((row) => isGoodGameEcommerceCampaign(row.campaign_name));
  const creativeRows = allCreativeRows.filter((row) => isGoodGameEcommerceCampaign(row.campaign_name));
  const hiresMap = new Map<string, string>();
  for (const row of (hiresRes.data ?? []) as unknown as { ad_name: string; hires_url: string | null }[]) {
    if (row.hires_url) hiresMap.set(row.ad_name, row.hires_url);
  }
  const metaCreatives = mapSalesCreatives(creativeRows, hiresMap);
  const metaSpend = pacingRows
    .filter((row) => row.ad_channel === 'Meta')
    .reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const googleSpend = pacingRows
    .filter((row) => row.ad_channel === 'Google')
    .reduce((sum, row) => sum + Number(row.cost ?? 0), 0);

  const budgetRows = (budgetRes.data ?? []) as unknown as { budget: number }[];
  const monthlyBudget = budgetRows[0] ? Number(budgetRows[0].budget) : GOODGAME_SALES_MONTHLY_BUDGET;

  return {
    filterParams: params,
    summary: summarise(currentRows),
    previousSummary: summarise(prevRows),
    budgetPacing: {
      budget: monthlyBudget,
      metaSpend,
      googleSpend,
      totalSpend: metaSpend + googleSpend,
      monthStart,
      monthEnd,
    },
    daily: aggregateTime(currentRows, 'day'),
    weekly: aggregateTime(currentRows, 'week'),
    monthly: aggregateTime(currentRows, 'month'),
    channelRows: aggregateBreakdown(currentRows, prevRows, (row) => row.ad_channel),
    campaignRows: aggregateBreakdown(
      currentRows,
      prevRows,
      (row) => `${row.campaign_name}||${row.ad_channel}`,
      (row) => row.ad_channel
    ),
    metaCreatives,
  };
}
