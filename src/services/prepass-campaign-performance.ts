import type { ChannelRow } from './analytics';
import { platformMatchesFocusChannel } from './prepass-platform-normalization';
import { isAtaEventCampaignName } from '@/lib/prepass-ata-scope';

export type CampaignSourceRow = {
  campaign_id?: string | null;
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

export type CampaignAliasIdentity = Readonly<{ campaignId: string; canonicalName: string }>;
export type CampaignAliasMap = ReadonlyMap<string, CampaignAliasIdentity>;

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

function campaignIdKey(platform: string, campaignId: string): string {
  return `id\u0000${platform}\u0000${campaignId}`;
}

/** Build a fail-closed lookup from stable campaign IDs collected by Meta/Google.
 * A legacy label is mapped only when every observed row agrees on one current name. */
export function buildCampaignAliasMap(rows: CampaignAliasSourceRow[]): Map<string, CampaignAliasIdentity> {
  const candidates = new Map<string, Map<string, CampaignAliasIdentity>>();
  for (const row of rows) {
    const platform = normalizeAliasPlatform(row.platform);
    const alias = normalizeCampaignName(row.alias_name);
    const canonical = String(row.canonical_name ?? '').trim();
    if (!platform || !row.campaign_id || !alias || !canonical) continue;
    const identity = `${platform}\u0000${row.campaign_id}\u0000${canonical}`;
    const value = { campaignId: row.campaign_id, canonicalName: canonical };
    for (const key of [
      campaignIdKey(platform, row.campaign_id),
      campaignAliasKey(platform, row.alias_name),
      campaignAliasKey('*', row.alias_name),
    ]) {
      const identities = candidates.get(key) ?? new Map<string, CampaignAliasIdentity>();
      identities.set(identity, value);
      candidates.set(key, identities);
    }
  }
  const aliases = new Map<string, CampaignAliasIdentity>();
  candidates.forEach((identities, key) => {
    const identity = identities.values().next().value;
    if (identities.size === 1 && identity) aliases.set(key, identity);
  });
  return aliases;
}

function canonicalCampaignIdentity(
  name: string | null, platform: string | null, aliases: CampaignAliasMap, campaignId?: string | null,
): { name: string | null; campaignId: string | null } {
  if (!name) return { name, campaignId: campaignId || null };
  if (platform) {
    const scopedPlatform = normalizeAliasPlatform(platform);
    const providerPlatform = scopedPlatform === 'Meta' || scopedPlatform === 'Google' ? scopedPlatform : null;
    const resolved = providerPlatform && campaignId
      ? aliases.get(campaignIdKey(providerPlatform, campaignId))
      : providerPlatform
        ? aliases.get(campaignAliasKey(providerPlatform, name))
        : platform.trim().toLowerCase() === 'unattributed'
          ? aliases.get(campaignAliasKey('*', name))
          : undefined;
    return { name: resolved?.canonicalName ?? name, campaignId: resolved?.campaignId ?? campaignId ?? null };
  }
  const resolved = aliases.get(campaignAliasKey('*', name));
  return { name: resolved?.canonicalName ?? name, campaignId: resolved?.campaignId ?? campaignId ?? null };
}

function stableCampaignKey(platform: string, campaign: { name: string | null; campaignId: string | null }): string {
  return campaign.campaignId
    ? JSON.stringify(['id', platform, campaign.campaignId])
    : JSON.stringify(['name', platform, campaign.name]);
}

function isRealCampaignName(name: string | null): boolean {
  const normalized = normalizeCampaignName(name);
  return normalized !== '' && normalized !== 'tempregistrationcode' && !normalized.includes('landingpageadjustments');
}

export type QualifiedCounts = { leads: number; mqls: number; sqls: number; won: number };
export type AbmSubmission = {
  id_marketo: string; marketo_guid: string; activity_date: string;
  fleet_size: string | null; utm_campaign: string | null;
  utm_source?: string | null; utm_campaign_id?: string | null;
};
export type QualifiedCohort = { submissions: AbmSubmission[]; mqls: string[]; sqls: string[]; won: string[] };

export type SmbProviderRow = {
  platform: 'Meta' | 'Google' | 'StackAdapt';
  campaign_id: string;
  campaign_name: string | null;
  focus?: string | null;
  spend?: number | string | null;
  cost?: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  leads?: number | string | null;
};

export type SmbLead = {
  id_marketo: string;
  marketo_created_at: string;
  utm_campaign: string | null;
  utm_campaign_id: string | null;
};

export type SmbStageEvent = {
  id_marketo: string;
  event_date: string;
  utm_campaign: string | null;
  utm_campaign_id?: string | null;
};

export type SmbCohort = {
  periodStart: string;
  periodEndExclusive: string;
  submissions: SmbLead[];
  mqls: SmbStageEvent[];
  sqls: SmbStageEvent[];
  won: SmbStageEvent[];
};

function isSmbProviderCampaign(row: SmbProviderRow): boolean {
  if (!row.campaign_id || !isRealCampaignName(row.campaign_name) || isAtaEventCampaignName(row.campaign_name)) return false;
  if (row.platform === 'StackAdapt') return String(row.focus ?? '').trim().toUpperCase() === 'SMB';
  const name = String(row.campaign_name ?? '').toUpperCase();
  return !name.includes('ABM') && !name.replace(/[^A-Z0-9]/g, '').includes('FD360');
}

function latestSmbLeads(rows: SmbLead[]): SmbLead[] {
  const selected = new Map<string, SmbLead>();
  const completeness = (row: SmbLead) => Number(Boolean(row.utm_campaign_id)) + Number(Boolean(row.utm_campaign));
  const tieKey = (row: SmbLead) => JSON.stringify([row.utm_campaign_id ?? '', row.utm_campaign ?? '']);
  for (const row of rows) {
    if (!row.id_marketo) continue;
    const old = selected.get(row.id_marketo);
    if (!old
      || row.marketo_created_at > old.marketo_created_at
      || (row.marketo_created_at === old.marketo_created_at && completeness(row) > completeness(old))
      || (row.marketo_created_at === old.marketo_created_at && completeness(row) === completeness(old) && tieKey(row) > tieKey(old))) {
      selected.set(row.id_marketo, row);
    }
  }
  return Array.from(selected.values());
}

/** Build only SMB Campaign Performance from provider-grain media and one
 * selected-period Marketo contact cohort. Provider conversions are deliberately
 * absent: Leads/MQL/SQL/Won all describe the same unique people. */
export function buildSmbCampaignPerformance(
  current: SmbProviderRow[], previous: SmbProviderRow[], cohort: SmbCohort,
  prevCohort: SmbCohort, channel: string | null,
  campaignAliases: CampaignAliasMap = new Map(),
): ChannelRow[] {
  const rows = new Map<string, ChannelRow>();
  const providerIdTargets = new Map<string, Set<string>>();
  const nameTargets = new Map<string, Set<string>>();
  for (const [source, comparison] of [[current, false], [previous, true]] as const) {
    for (const sourceRow of source) {
      if (!isSmbProviderCampaign(sourceRow)) continue;
      const campaign = canonicalCampaignIdentity(sourceRow.campaign_name, sourceRow.platform, campaignAliases, sourceRow.campaign_id);
      const key = stableCampaignKey(sourceRow.platform, campaign);
      const target = rows.get(key) ?? {
        name: `${campaign.name} · ${sourceRow.platform}`,
        campaignId: campaign.campaignId ?? sourceRow.campaign_id,
        campaignIdentity: key,
        ...(sourceRow.platform === 'Meta' ? { metaLeads: 0, prevMetaLeads: 0 } : {}),
        impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
        prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
      };
      target[comparison ? 'prevImpressions' : 'impressions'] += Number(sourceRow.impressions ?? 0);
      target[comparison ? 'prevClicks' : 'clicks'] += Number(sourceRow.clicks ?? 0);
      target[comparison ? 'prevSpend' : 'spend'] += Number(sourceRow.platform === 'Google' ? sourceRow.cost : sourceRow.spend ?? 0);
      if (sourceRow.platform === 'Meta') {
        target[comparison ? 'prevMetaLeads' : 'metaLeads']! += Number(sourceRow.leads ?? 0);
      }
      rows.set(key, target);

      for (const id of [sourceRow.campaign_id, campaign.campaignId].filter(Boolean) as string[]) {
        const targets = providerIdTargets.get(id) ?? new Set<string>();
        targets.add(key);
        providerIdTargets.set(id, targets);
      }
      const normalized = normalizeCampaignName(campaign.name);
      if (normalized) {
        const targets = nameTargets.get(normalized) ?? new Set<string>();
        targets.add(key);
        nameTargets.set(normalized, targets);
      }
    }
  }

  const unattributed: ChannelRow = {
    name: 'Unattributed SMB contacts', smbUnattributed: true,
    impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
    prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
  };
  for (const [source, comparison] of [[cohort, false], [prevCohort, true]] as const) {
    type Evidence = { utm_campaign: string | null; utm_campaign_id?: string | null };
    type Contact = { lead: boolean; stages: Set<'mqls' | 'sqls' | 'won'>; evidence: Evidence[] };
    const contacts = new Map<string, Contact>();
    const inPeriod = (date: string) => date >= source.periodStart && date < source.periodEndExclusive;
    const contact = (id: string) => {
      const value = contacts.get(id) ?? { lead: false, stages: new Set<'mqls' | 'sqls' | 'won'>(), evidence: [] };
      contacts.set(id, value);
      return value;
    };
    for (const lead of latestSmbLeads(source.submissions)) {
      if (!inPeriod(lead.marketo_created_at)) continue;
      const value = contact(lead.id_marketo);
      value.lead = true;
      value.evidence.push(lead);
    }
    for (const stage of ['mqls', 'sqls', 'won'] as const) {
      for (const event of source[stage]) {
        if (!event.id_marketo || !inPeriod(event.event_date)) continue;
        const value = contact(event.id_marketo);
        value.stages.add(stage);
        value.evidence.push(event);
      }
    }
    contacts.forEach(value => {
      const evidenceIds = new Set<string>(value.evidence.map(item => String(item.utm_campaign_id ?? '').trim()).filter(Boolean));
      const deterministicTargets = new Set<string>();
      let conflicting = false;
      if (evidenceIds.size) {
        evidenceIds.forEach(campaignId => {
          const candidates = providerIdTargets.get(campaignId);
          if (candidates?.size !== 1) conflicting = true;
          else deterministicTargets.add(candidates.values().next().value as string);
        });
      } else {
        for (const item of value.evidence) {
          const decodedName = decodeUtmCampaign(item.utm_campaign);
          const canonical = canonicalCampaignIdentity(decodedName, null, campaignAliases);
          const candidates = nameTargets.get(normalizeCampaignName(canonical.name));
          if (candidates && candidates.size > 1) conflicting = true;
          else if (candidates?.size === 1) deterministicTargets.add(candidates.values().next().value as string);
        }
      }
      if (deterministicTargets.size > 1) conflicting = true;
      const key = !conflicting && deterministicTargets.size === 1
        ? deterministicTargets.values().next().value
        : undefined;
      const explicitlySmb = value.evidence.some(item =>
        normalizeCampaignName(decodeUtmCampaign(item.utm_campaign)).includes('smb'));
      const target = key ? rows.get(key) : (!channel && explicitlySmb ? unattributed : undefined);
      if (!target) return;
      const prefix = comparison ? 'prev' : '';
      const leadField = comparison ? 'prevLeads' : 'leads';
      if (value.lead) target[leadField] += 1;
      for (const stage of ['mqls', 'sqls', 'won'] as const) {
        if (!value.stages.has(stage)) continue;
        const field = `${prefix}${comparison ? stage[0].toUpperCase() + stage.slice(1) : stage}` as keyof ChannelRow;
        (target[field] as number) += 1;
      }
    });
  }
  if (!channel && [unattributed.leads, unattributed.mqls, unattributed.sqls, unattributed.won,
    unattributed.prevLeads, unattributed.prevMqls, unattributed.prevSqls, unattributed.prevWon].some(Boolean)) {
    rows.set('smb-unattributed', unattributed);
  }
  return Array.from(rows.values())
    .filter(row => row.smbUnattributed || !channel || row.name.endsWith(`· ${channel}`))
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
}

/** Replace the incomplete contact-only SMB lifecycle stages with the canonical
 * corrected MMP publication. This is replacement, not addition: calls,
 * enrollments and certified overlays may already overlap campaign_leads, so
 * summing both sources would double count. Leads remain unique Marketo contacts. */
export function applySmbCertifiedLifecycle(
  rows: ChannelRow[], current: CampaignSourceRow[], previous: CampaignSourceRow[],
  channel: string | null, campaignAliases: CampaignAliasMap = new Map(),
): ChannelRow[] {
  const result = rows.map(row => ({
    ...row,
    mqls: 0, sqls: 0, won: 0,
    prevMqls: 0, prevSqls: 0, prevWon: 0,
  }));
  const byCampaignId = new Map<string, Set<ChannelRow>>();
  const byScopedName = new Map<string, Set<ChannelRow>>();
  const rowPlatform = (row: ChannelRow) =>
    (['Meta', 'Google', 'StackAdapt'] as const).find(platform => row.name.endsWith(` · ${platform}`));
  const rowCampaignName = (row: ChannelRow, platform: string) => row.name.slice(0, -(` · ${platform}`).length);
  const addTarget = (map: Map<string, Set<ChannelRow>>, key: string, row: ChannelRow) => {
    const targets = map.get(key) ?? new Set<ChannelRow>();
    targets.add(row);
    map.set(key, targets);
  };
  for (const row of result) {
    const platform = rowPlatform(row);
    if (!platform || row.smbUnattributed) continue;
    if (row.campaignId) addTarget(byCampaignId, row.campaignId, row);
    addTarget(byScopedName, campaignAliasKey(platform, rowCampaignName(row, platform)), row);
  }

  const selectTarget = (source: CampaignSourceRow): ChannelRow | undefined => {
    const sourcePlatform = normalizeAliasPlatform(source.platform);
    const suppliedCampaignId = String(source.campaign_id ?? '').trim();
    const providerPlatform = ['Meta', 'Google', 'StackAdapt'].includes(sourcePlatform)
      ? sourcePlatform
      : null;

    // An explicit provider ID is authoritative. Resolve it before looking at
    // names so an Unattributed row cannot exchange an unknown ID for the ID of
    // a coincidentally matching alias.
    let authoritativePlatform: string | null = null;
    if (suppliedCampaignId) {
      const targets = byCampaignId.get(suppliedCampaignId);
      if (targets?.size === 1) {
        const target = targets.values().next().value as ChannelRow;
        const targetPlatform = rowPlatform(target) ?? null;
        if (!targetPlatform || (providerPlatform && providerPlatform !== targetPlatform)
          || (channel && channel !== targetPlatform)) return undefined;
        return target;
      }
      if (targets?.size) return undefined;
      const idPlatforms = ['Meta', 'Google', 'StackAdapt'].filter(platform =>
        campaignAliases.get(campaignIdKey(platform, suppliedCampaignId))?.campaignId === suppliedCampaignId);
      if (idPlatforms.length !== 1) return undefined;
      authoritativePlatform = idPlatforms[0];
      if ((providerPlatform && providerPlatform !== authoritativePlatform)
        || (channel && channel !== authoritativePlatform)) return undefined;
    }

    const campaign = canonicalCampaignIdentity(
      source.campaign_name, authoritativePlatform ?? providerPlatform, campaignAliases, source.campaign_id,
    );
    const inferredPlatforms = campaign.campaignId
      ? ['Meta', 'Google', 'StackAdapt'].filter(platform =>
          campaignAliases.get(campaignIdKey(platform, campaign.campaignId!))?.campaignId === campaign.campaignId)
      : [];
    const effectivePlatform = authoritativePlatform ?? providerPlatform
      ?? (inferredPlatforms.length === 1 ? inferredPlatforms[0] : null);
    if (channel && effectivePlatform && effectivePlatform !== channel) return undefined;
    if (campaign.campaignId) {
      const targets = byCampaignId.get(campaign.campaignId);
      if (targets?.size === 1) return targets.values().next().value;
      if (targets?.size) return undefined;
    }
    if (!effectivePlatform || !campaign.name) return undefined;
    const scopedKey = campaignAliasKey(effectivePlatform, campaign.name);
    const targets = byScopedName.get(scopedKey);
    if (targets?.size === 1) return targets.values().next().value;
    if (targets?.size || !isRealCampaignName(campaign.name) || isAtaEventCampaignName(campaign.name)) return undefined;
    const created: ChannelRow = {
      name: `${campaign.name} · ${effectivePlatform}`,
      campaignId: campaign.campaignId ?? undefined,
      campaignIdentity: stableCampaignKey(effectivePlatform, campaign),
      impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
      prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
      ...(effectivePlatform === 'Meta' ? { metaLeads: 0, prevMetaLeads: 0 } : {}),
    };
    result.push(created);
    if (created.campaignId) addTarget(byCampaignId, created.campaignId, created);
    addTarget(byScopedName, scopedKey, created);
    return created;
  };

  for (const [source, comparison] of [[current, false], [previous, true]] as const) {
    for (const lifecycle of source) {
      const target = selectTarget(lifecycle);
      if (!target) continue;
      if (comparison) {
        target.prevMqls += Number(lifecycle.mqls ?? 0);
        target.prevSqls += Number(lifecycle.sqls ?? 0);
        target.prevWon += Number(lifecycle.closed_won ?? 0);
      } else {
        target.mqls += Number(lifecycle.mqls ?? 0);
        target.sqls += Number(lifecycle.sqls ?? 0);
        target.won += Number(lifecycle.closed_won ?? 0);
      }
    }
  }
  return result;
}

/** Attribute one selected-period lead to one campaign, using the latest form
 * activity for each Marketo contact. */
export function latestSubmissions(submissions: AbmSubmission[]): AbmSubmission[] {
  const latest = new Map<string, AbmSubmission>();
  for (const row of submissions) {
    const old = latest.get(row.id_marketo);
    const date = new Date(row.activity_date).getTime();
    const oldDate = old ? new Date(old.activity_date).getTime() : -Infinity;
    if (!old || date > oldDate || (date === oldDate && row.marketo_guid > old.marketo_guid)) latest.set(row.id_marketo, row);
  }
  return Array.from(latest.values());
}

/** Mirrors DISTINCT ON id_marketo, latest activity then GUID; qualify AFTER dedup. */
export function latestQualifiedSubmissions(submissions: AbmSubmission[]): AbmSubmission[] {
  return latestSubmissions(submissions).filter(row => row.fleet_size === '101-500' || row.fleet_size === '500+');
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
    const campaign = canonicalCampaignIdentity(row.campaign_name, platform, campaignAliases, row.campaign_id);
    const key = normalize(campaign.name);
    if (!key) continue;
    const names = identities.get(key) ?? new Set<string>();
    names.add(stableCampaignKey(platform, campaign));
    identities.set(key, names);
  }
  const empty = (): QualifiedCounts => ({ leads: 0, mqls: 0, sqls: 0, won: 0 });
  const result = rows.map(row => ({ ...row, qualified: empty(), prevQualified: empty() }));
  const targets = new Map(result.map(row => [row.campaignIdentity ?? row.name, row]));
  const unattributed = { name: 'Unattributed +100 Trucks', impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0,
    prevImpressions: 0, prevClicks: 0, prevSpend: 0, prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
    qualified: empty(), prevQualified: empty(), qualifiedUnattributed: true };
  for (const [source, comparison] of [[cohort, false], [prevCohort, true]] as const) {
    const stages = { mqls: new Set(source.mqls), sqls: new Set(source.sqls), won: new Set(source.won) };
    for (const row of latestQualifiedSubmissions(source.submissions)) {
      const campaign = canonicalCampaignIdentity(row.utm_campaign, null, campaignAliases);
      const names = identities.get(normalize(campaign.name));
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

function decodeUtmCampaign(value: string | null): string | null {
  if (!value) return value;
  const prepared = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(prepared);
  } catch {
    return prepared;
  }
}

function submissionPlatform(source: string | null | undefined): string | null {
  const value = String(source ?? '').trim().toLowerCase();
  if (['meta', 'facebook', 'fb', 'instagram', 'ig'].includes(value)) return 'Meta';
  if (value === 'google') return 'Google';
  if (value.replace(/[\s_-]/g, '') === 'stackadapt') return 'StackAdapt';
  return null;
}

/** Replace ABM provider conversion/stage events with one coherent CRM funnel:
 * unique selected-period Marketo contacts attributed by UTM, with MQL/SQL/Won
 * membership calculated only inside that same contact population. */
export function replaceAbmCampaignFunnelMetrics(
  rows: ChannelRow[], current: CampaignSourceRow[], previous: CampaignSourceRow[],
  cohort: QualifiedCohort, prevCohort: QualifiedCohort, _channel: string | null,
  campaignAliases: CampaignAliasMap = new Map(),
): ChannelRow[] {
  const result = rows.map(row => ({
    ...row,
    leads: 0, mqls: 0, sqls: 0, won: 0,
    prevLeads: 0, prevMqls: 0, prevSqls: 0, prevWon: 0,
  }));
  const targets = new Map(result.map(row => [row.campaignIdentity ?? row.name, row]));
  const identities = new Map<string, Set<string>>();
  for (const row of [...current, ...previous]) {
    const platform = (['Google', 'Meta', 'StackAdapt'] as const)
      .find(channel => platformMatchesFocusChannel(row.platform, channel, 'ABM')) ?? row.platform;
    const campaign = canonicalCampaignIdentity(row.campaign_name, platform, campaignAliases, row.campaign_id);
    const normalized = normalizeCampaignName(campaign.name);
    if (!normalized) continue;
    const keys = identities.get(normalized) ?? new Set<string>();
    keys.add(stableCampaignKey(platform, campaign));
    identities.set(normalized, keys);
  }

  for (const [source, comparison] of [[cohort, false], [prevCohort, true]] as const) {
    const stages = { mqls: new Set(source.mqls), sqls: new Set(source.sqls), won: new Set(source.won) };
    for (const submission of latestSubmissions(source.submissions)) {
      const campaignName = decodeUtmCampaign(submission.utm_campaign);
      const platform = submissionPlatform(submission.utm_source);
      const campaign = canonicalCampaignIdentity(campaignName, platform, campaignAliases, submission.utm_campaign_id);
      let target = platform ? targets.get(stableCampaignKey(platform, campaign)) : undefined;
      if (!target) {
        const candidates = identities.get(normalizeCampaignName(campaign.name));
        if (candidates?.size === 1) target = targets.get(Array.from(candidates)[0]);
      }
      if (!target) continue;
      if (comparison) {
        target.prevLeads += 1;
        if (stages.mqls.has(submission.id_marketo)) target.prevMqls += 1;
        if (stages.sqls.has(submission.id_marketo)) target.prevSqls += 1;
        if (stages.won.has(submission.id_marketo)) target.prevWon += 1;
      } else {
        target.leads += 1;
        if (stages.mqls.has(submission.id_marketo)) target.mqls += 1;
        if (stages.sqls.has(submission.id_marketo)) target.sqls += 1;
        if (stages.won.has(submission.id_marketo)) target.won += 1;
      }
    }
  }
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
      const campaign = canonicalCampaignIdentity(row.campaign_name, platform, campaignAliases, row.campaign_id);
      const key = stableCampaignKey(platform, campaign);
      const target = rows.get(key) ?? {
        name: `${campaign.name} · ${platform}`,
        campaignId: campaign.campaignId ?? undefined,
        campaignIdentity: key,
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
