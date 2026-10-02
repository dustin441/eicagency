import type { ChannelRow } from './analytics';
import { platformMatchesFocusChannel } from './prepass-platform-normalization';

export type CampaignSourceRow = {
  campaign_name: string | null;
  platform: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  platform_conversions: number | string;
  mqls: number | string;
  sqls: number | string;
  closed_won: number | string;
};

export type CampaignAliasSourceRow = {
  platform: string;
  campaign_id: string;
  alias_name: string;
  canonical_name: string;
};

export type CampaignAliasMap = ReadonlyMap<string, string>;

export const normalizeCampaignName = (name: string | null) => (name ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function normalizeAliasPlatform(platform: string | null | undefined): string {
  const value = String(platform ?? '').trim().toLowerCase();
  if (['meta', 'fb', 'facebook', 'ig', 'instagram'].includes(value)) return 'Meta';
  if (value === 'google') return 'Google';
  if (value.replace(/[\s_-]/g, '') === 'stackadapt') return 'StackAdapt';
  return String(platform ?? '').trim();
}

function campaignAliasKey(platform: string, name: string | null): string {
  return `${platform}\u0000${normalizeCampaignName(name)}`;
}

/** Build a fail-closed lookup from stable campaign IDs collected by Meta/Google.
 * A legacy label is mapped only when every observed row agrees on one current name. */
export function buildCampaignAliasMap(rows: CampaignAliasSourceRow[]): Map<string, string> {
  const candidates = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const platform = normalizeAliasPlatform(row.platform);
    const alias = normalizeCampaignName(row.alias_name);
    const canonical = String(row.canonical_name ?? '').trim();
    if (!platform || !row.campaign_id || !alias || !canonical) continue;
    const identity = `${platform}\u0000${row.campaign_id}\u0000${canonical}`;
    for (const key of [campaignAliasKey(platform, row.alias_name), campaignAliasKey('*', row.alias_name)]) {
      const identities = candidates.get(key) ?? new Map<string, string>();
      identities.set(identity, canonical);
      candidates.set(key, identities);
    }
  }
  const aliases = new Map<string, string>();
  candidates.forEach((identities, key) => {
    const canonical = identities.values().next().value;
    if (identities.size === 1 && typeof canonical === 'string') aliases.set(key, canonical);
  });
  return aliases;
}

function canonicalCampaignName(name: string | null, platform: string | null, aliases: CampaignAliasMap): string | null {
  if (!name) return name;
  if (platform) {
    const scopedPlatform = normalizeAliasPlatform(platform);
    return (scopedPlatform ? aliases.get(campaignAliasKey(scopedPlatform, name)) : undefined) ?? name;
  }
  return aliases.get(campaignAliasKey('*', name)) ?? name;
}

function isRealCampaignName(name: string | null): boolean {
  const normalized = normalizeCampaignName(name);
  return normalized !== '' && normalized !== 'tempregistrationcode' && !normalized.includes('landingpageadjustments');
}

export type QualifiedCounts = { leads: number; mqls: number; sqls: number; won: number };
export type AbmSubmission = {
  id_marketo: string; marketo_guid: string; activity_date: string;
  fleet_size: string | null; utm_campaign: string | null;
};
export type QualifiedCohort = { submissions: AbmSubmission[]; mqls: string[]; sqls: string[]; won: string[] };

/** Mirrors DISTINCT ON id_marketo, latest activity then GUID; qualify AFTER dedup. */
export function latestQualifiedSubmissions(submissions: AbmSubmission[]): AbmSubmission[] {
  const latest = new Map<string, AbmSubmission>();
  for (const row of submissions) {
    const old = latest.get(row.id_marketo);
    const date = new Date(row.activity_date).getTime();
    const oldDate = old ? new Date(old.activity_date).getTime() : -Infinity;
    if (!old || date > oldDate || (date === oldDate && row.marketo_guid > old.marketo_guid)) latest.set(row.id_marketo, row);
  }
  return Array.from(latest.values()).filter(row => row.fleet_size === '101-500' || row.fleet_size === '500+');
}

/** Use the UNFILTERED current+previous MMP identity universe. Never select a
 * winning platform for campaign-name collisions or allocate global fleet totals.
 * Stage membership is lifetime membership of the dated submission cohort.
 */
export function addQualifiedCampaignMetrics(
  rows: ChannelRow[], current: CampaignSourceRow[], previous: CampaignSourceRow[],
  cohort: QualifiedCohort, prevCohort: QualifiedCohort, channel: string | null,
  campaignAliases: CampaignAliasMap = new Map(),
): ChannelRow[] {
  const normalize = normalizeCampaignName;
  const identities = new Map<string, Set<string>>();
  for (const row of [...current, ...previous]) {
    const platform = (['Google', 'Meta', 'StackAdapt'] as const)
      .find(c => platformMatchesFocusChannel(row.platform, c, 'ABM')) ?? row.platform;
    const campaign = canonicalCampaignName(row.campaign_name, platform, campaignAliases);
    const key = normalize(campaign);
    if (!key) continue;
    const names = identities.get(key) ?? new Set<string>();
    names.add(`${campaign} · ${platform}`);
    identities.set(key, names);
  }
  const empty = (): QualifiedCounts => ({ leads: 0, mqls: 0, sqls: 0, won: 0 });
  const result = rows.map(row => ({ ...row, qualified: empty(), prevQualified: empty() }));
  const targets = new Map(result.map(row => [row.name, row]));
  const unattributed = { name: 'Unattributed +100 Trucks', impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
    prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
    qualified: empty(), prevQualified: empty(), qualifiedUnattributed: true };
  for (const [source, comparison] of [[cohort, false], [prevCohort, true]] as const) {
    const stages = { mqls: new Set(source.mqls), sqls: new Set(source.sqls), won: new Set(source.won) };
    for (const row of latestQualifiedSubmissions(source.submissions)) {
      const campaign = canonicalCampaignName(row.utm_campaign, null, campaignAliases);
      const names = identities.get(normalize(campaign));
      const name = names?.size === 1 ? Array.from(names)[0] : null;
      // A mapped campaign hidden by the channel filter stays hidden, not unattributed.
      const target = name ? targets.get(name) : !channel ? unattributed : undefined;
      if (!target) continue;
      const counts = comparison ? target.prevQualified : target.qualified;
      counts.leads++;
      for (const stage of ['mqls', 'sqls', 'won'] as const) if (stages[stage].has(row.id_marketo)) counts[stage]++;
    }
  }
  if (unattributed.qualified.leads || unattributed.prevQualified.leads) result.push(unattributed);
  return result;
}

/** Consume the same already focus/channel-filtered RPC rows as Product Performance.
 * Campaign names are the available MMP identity; no provider data or top-N cap.
 */
export function buildCampaignPerformance(
  current: CampaignSourceRow[], previous: CampaignSourceRow[], focus: string,
  campaignAliases: CampaignAliasMap = new Map(),
): ChannelRow[] {
  const rows = new Map<string, ChannelRow>();
  const fields = [
    ['impressions', 'impressions', 'prevImpressions'], ['clicks', 'clicks', 'prevClicks'],
    ['spend', 'spend', 'prevSpend'], ['platform_conversions', 'leads', 'prevLeads'],
    ['mqls', 'mqls', 'prevMqls'], ['sqls', 'sqls', 'prevSqls'], ['closed_won', 'won', 'prevWon'],
  ] as const;
  for (const [source, comparison] of [[current, false], [previous, true]] as const) {
    for (const row of source) {
      if (!isRealCampaignName(row.campaign_name)) continue;
      const platform = (['Google', 'Meta', 'StackAdapt'] as const)
        .find(channel => platformMatchesFocusChannel(row.platform, channel, focus)) ?? row.platform;
      const campaign = canonicalCampaignName(row.campaign_name, platform, campaignAliases);
      const key = JSON.stringify([campaign, platform]);
      const target = rows.get(key) ?? {
        name: `${campaign} · ${platform}`,
        impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
        prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
      };
      for (const [field, curr, prev] of fields) target[comparison ? prev : curr] += Number(row[field] ?? 0);
      rows.set(key, target);
    }
  }
  // Landing-page adjustments have no campaign identity and are intentionally
  // excluded from this campaign-grain table.
  return Array.from(rows.values()).sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
}
