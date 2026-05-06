import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { computeCompDates, getPresetDates } from '@/lib/date-utils';

// ── Product family definitions ────────────────────────────────────────────────
// Revenue campaigns: exact nsi_revenue.campaign values for each family.
// Media identifiers: family-tree tokens used to bucket nsi_master_campaign_daily
// rows via sub_campaign first, then campaign_name as fallback. This keeps
// future monthly rows grouped correctly without requiring Supabase schema changes.

const FAMILY_DEFS = {
  BPT: {
    revCampaigns: ['CCF-CON-BPT2'],
    mediaIdentifiers: ['BPT', 'LQT', 'PEN-100'],
    label: 'BPT',
    description: 'BPT product family — revenue tracked via CCF-CON-BPT2',
  },
  POL: {
    revCampaigns: ['CON-CON-POL2', 'CON-CON-CMP'],
    mediaIdentifiers: ['POL', 'CMP', 'LSS', 'MCH'],
    label: 'POL',
    description: 'POL product family — revenue tracked via POL2 + CMP campaigns',
  },
  CMP: {
    revCampaigns: ['CON-CON-CMP'],
    mediaIdentifiers: ['CMP'],
    label: 'CMP',
    description: 'CMP campaign only',
  },
} as const;

export const FAMILY_LABELS = ['Combined', 'BPT', 'POL', 'CMP'] as const;
export type ProductFamily = (typeof FAMILY_LABELS)[number];

export type RevenueFilterParams = {
  start: string;
  end: string;
  compStart: string;
  compEnd: string;
  compMode: 'prev_period' | 'prev_year' | 'custom';
};

export function revenueParamsFromSearch(p: Record<string, string | undefined>): RevenueFilterParams {
  const { start: defStart, end: defEnd } = getPresetDates('trailing12')!;
  const start = p.start ?? defStart;
  const end = p.end ?? defEnd;
  const compMode = (p.comp_mode as RevenueFilterParams['compMode']) ?? 'prev_period';

  let compStart: string;
  let compEnd: string;
  if (compMode === 'custom' && p.comp_start && p.comp_end) {
    compStart = p.comp_start;
    compEnd = p.comp_end;
  } else if (compMode === 'prev_year') {
    const computed = computeCompDates(start, end, 'prev_year');
    compStart = p.comp_start ?? computed.compStart;
    compEnd = p.comp_end ?? computed.compEnd;
  } else {
    const computed = computeCompDates(start, end, 'prev_period');
    compStart = p.comp_start ?? computed.compStart;
    compEnd = p.comp_end ?? computed.compEnd;
  }

  return { start, end, compStart, compEnd, compMode };
}

function firstOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

export type NsiRevenueResult = {
  data: NsiRevenueData;
  comp: NsiRevenueData;
};

const ALL_REV_CAMPAIGNS = [...new Set(Object.values(FAMILY_DEFS).flatMap((d) => d.revCampaigns))];
const ALL_MEDIA_IDENTIFIERS = [...new Set(Object.values(FAMILY_DEFS).flatMap((d) => d.mediaIdentifiers))];

export type NsiRevenuePoint = {
  monthStart: string;  // ISO "2023-01-01" for sorting
  label: string;       // "Jan 2023" for display
  revenue: number;
  spend: number;
  impressions: number;
  roas: number;        // revenue / spend, 0 when spend = 0
};

export type NsiRevenueData = {
  Combined: NsiRevenuePoint[];
  BPT: NsiRevenuePoint[];
  POL: NsiRevenuePoint[];
  CMP: NsiRevenuePoint[];
};

type RevRow = { month_start: string; campaign: string; revenue: string };
type MediaRow = {
  date: string;
  sub_campaign: string | null;
  campaign_name: string | null;
  cost: string;
  impressions: string;
};

function labelMonth(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function includesAnyIdentifier(value: string | null | undefined, identifiers: readonly string[]): boolean {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized !== '' && identifiers.some((identifier) => normalized.includes(identifier));
}

function matchesMediaFamily(row: MediaRow, identifiers: readonly string[]): boolean {
  return (
    includesAnyIdentifier(row.sub_campaign, identifiers) ||
    includesAnyIdentifier(row.campaign_name, identifiers)
  );
}

function buildSeries(
  revRows: RevRow[],
  mediaRows: MediaRow[],
  revCampaigns: readonly string[],
  mediaIdentifiers: readonly string[]
): NsiRevenuePoint[] {
  const mediaByMonth = new Map<string, { spend: number; impressions: number }>();
  for (const r of mediaRows) {
    if (!matchesMediaFamily(r, mediaIdentifiers)) continue;
    const month = r.date.slice(0, 7) + '-01';
    const prev = mediaByMonth.get(month) ?? { spend: 0, impressions: 0 };
    prev.spend += Number(r.cost) || 0;
    prev.impressions += Number(r.impressions) || 0;
    mediaByMonth.set(month, prev);
  }

  const revByMonth = new Map<string, number>();
  for (const r of revRows) {
    if (!revCampaigns.includes(r.campaign)) continue;
    revByMonth.set(r.month_start, (revByMonth.get(r.month_start) ?? 0) + (Number(r.revenue) || 0));
  }

  const allMonths = new Set([...revByMonth.keys(), ...mediaByMonth.keys()]);

  return Array.from(allMonths)
    .sort()
    .map((monthStart) => {
      const revenue = revByMonth.get(monthStart) ?? 0;
      const media = mediaByMonth.get(monthStart) ?? { spend: 0, impressions: 0 };
      return {
        monthStart,
        label: labelMonth(monthStart),
        revenue,
        spend: media.spend,
        impressions: media.impressions,
        roas: media.spend > 0 ? (revenue * 0.01) / media.spend : 0,
      };
    });
}

const PAGE_SIZE = 1000;

async function fetchPaged<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null; error?: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? 'Query failed');
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildAll(revRows: RevRow[], mediaRows: MediaRow[]): NsiRevenueData {
  return {
    BPT:      buildSeries(revRows, mediaRows, FAMILY_DEFS.BPT.revCampaigns,  FAMILY_DEFS.BPT.mediaIdentifiers),
    POL:      buildSeries(revRows, mediaRows, FAMILY_DEFS.POL.revCampaigns,  FAMILY_DEFS.POL.mediaIdentifiers),
    CMP:      buildSeries(revRows, mediaRows, FAMILY_DEFS.CMP.revCampaigns,  FAMILY_DEFS.CMP.mediaIdentifiers),
    Combined: buildSeries(revRows, mediaRows, ALL_REV_CAMPAIGNS,             ALL_MEDIA_IDENTIFIERS),
  };
}

export async function fetchNsiRevenueData(params: RevenueFilterParams): Promise<NsiRevenueResult> {
  const supabase = createSpartacoSupabaseClient();

  const fetchRevRows = (start: string, end: string) =>
    supabase
      .from('nsi_revenue')
      .select('month_start, campaign, revenue')
      .in('campaign', ALL_REV_CAMPAIGNS)
      .gte('month_start', firstOfMonth(start))
      .lte('month_start', firstOfMonth(end))
      .order('month_start')
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as RevRow[];
      });

  const fetchMediaRows = (start: string, end: string) =>
    fetchPaged<MediaRow>(async (from, to) =>
      supabase
        .from('nsi_master_campaign_daily')
        .select('date, sub_campaign, campaign_name, cost, impressions')
        .gte('date', start)
        .lte('date', end)
        .range(from, to)
    );

  const [revRows, mediaRows, compRevRows, compMediaRows] = await Promise.all([
    fetchRevRows(params.start, params.end),
    fetchMediaRows(params.start, params.end),
    fetchRevRows(params.compStart, params.compEnd),
    fetchMediaRows(params.compStart, params.compEnd),
  ]);

  return {
    data: buildAll(revRows, mediaRows),
    comp: buildAll(compRevRows, compMediaRows),
  };
}
