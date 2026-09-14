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

const normalizeCampaignName = (name: string | null) => (name ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

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
): ChannelRow[] {
  const normalize = (name: string | null) => (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const identities = new Map<string, Set<string>>();
  for (const row of [...current, ...previous]) {
    const key = normalize(row.campaign_name);
    if (!key) continue;
    const platform = (['Google', 'Meta', 'StackAdapt'] as const)
      .find(c => platformMatchesFocusChannel(row.platform, c, 'ABM')) ?? row.platform;
    const names = identities.get(key) ?? new Set<string>();
    names.add(`${row.campaign_name} · ${platform}`);
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
      const names = identities.get(normalize(row.utm_campaign));
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
      const campaign = row.campaign_name;
      const key = JSON.stringify([row.campaign_name, platform]);
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
