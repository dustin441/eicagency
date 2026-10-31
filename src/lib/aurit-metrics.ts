// Pure aggregation for the Aurit Mediation dashboard. No I/O, so it can be unit tested.
// Conversions are kept per type (platform + conversion action) so the UI can show
// every type on its own or any combination of them aggregated.

export type AuritChannel = 'Meta' | 'Google';

export type AuritCampaignDay = {
  date: string;
  channel: AuritChannel;
  campaignId: string;
  campaignName: string;
  campaignType: string | null;
  impressions: number;
  clicks: number;
  cost: number;
};

export type AuritConversionDay = {
  date: string;
  channel: AuritChannel;
  campaignId: string;
  conversionType: string;
  conversionLabel: string;
  conversions: number;
};

/** Stable key for one conversion type: `${channel}|${conversionType}`. */
export type AuritConversionKey = string;

export type AuritConversionType = {
  key: AuritConversionKey;
  channel: AuritChannel;
  label: string;
  conversions: number;
  prevConversions: number;
};

export type AuritCampaignRow = {
  key: string;
  campaignId: string;
  campaign: string;
  channel: AuritChannel;
  campaignType: string | null;
  spend: number;
  prevSpend: number;
  impressions: number;
  clicks: number;
  conversionsByType: Record<AuritConversionKey, number>;
  prevConversionsByType: Record<AuritConversionKey, number>;
};

export type AuritChannelRow = {
  channel: AuritChannel;
  spend: number;
  prevSpend: number;
  impressions: number;
  prevImpressions: number;
  clicks: number;
  prevClicks: number;
};

export type AuritTimePoint = {
  label: string;
  spend: number;
  conversionsByType: Record<AuritConversionKey, number>;
};

export type AuritAggregates = {
  channelRows: AuritChannelRow[];
  conversionTypes: AuritConversionType[];
  campaignRows: AuritCampaignRow[];
  timeSeries: AuritTimePoint[];
};

export const AURIT_CHANNELS: readonly AuritChannel[] = ['Meta', 'Google'];

export function conversionKey(channel: AuritChannel, conversionType: string): AuritConversionKey {
  return `${channel}|${conversionType}`;
}

/** Sum of the selected conversion types in a per-type map. */
export function sumSelected(byType: Record<AuritConversionKey, number>, selected: ReadonlySet<AuritConversionKey>): number {
  let total = 0;
  for (const [key, value] of Object.entries(byType)) {
    if (selected.has(key)) total += value;
  }
  return total;
}

function campaignKey(channel: AuritChannel, campaignId: string) {
  return `${channel}__${campaignId}`;
}

function add(map: Record<string, number>, key: string, value: number) {
  map[key] = (map[key] ?? 0) + value;
}

export function buildAuritAggregates(input: {
  current: AuritCampaignDay[];
  previous: AuritCampaignDay[];
  currentConversions: AuritConversionDay[];
  previousConversions: AuritConversionDay[];
}): AuritAggregates {
  const { current, previous, currentConversions, previousConversions } = input;

  const channelRows: AuritChannelRow[] = AURIT_CHANNELS.map(channel => {
    const curr = current.filter(row => row.channel === channel);
    const prev = previous.filter(row => row.channel === channel);
    const sum = (rows: AuritCampaignDay[], field: 'cost' | 'impressions' | 'clicks') =>
      rows.reduce((total, row) => total + row[field], 0);
    return {
      channel,
      spend: sum(curr, 'cost'),
      prevSpend: sum(prev, 'cost'),
      impressions: sum(curr, 'impressions'),
      prevImpressions: sum(prev, 'impressions'),
      clicks: sum(curr, 'clicks'),
      prevClicks: sum(prev, 'clicks'),
    };
  });

  // Conversion types: labels come from the most recent row so renamed actions show their current name.
  const types = new Map<AuritConversionKey, AuritConversionType & { labelDate: string }>();
  const registerType = (row: AuritConversionDay, isCurrent: boolean) => {
    const key = conversionKey(row.channel, row.conversionType);
    const existing = types.get(key) ?? { key, channel: row.channel, label: row.conversionLabel, labelDate: '', conversions: 0, prevConversions: 0 };
    if (row.date >= existing.labelDate) {
      existing.label = row.conversionLabel;
      existing.labelDate = row.date;
    }
    if (isCurrent) existing.conversions += row.conversions;
    else existing.prevConversions += row.conversions;
    types.set(key, existing);
  };
  currentConversions.forEach(row => registerType(row, true));
  previousConversions.forEach(row => registerType(row, false));
  const conversionTypes: AuritConversionType[] = Array.from(types.values())
    .map(({ key, channel, label, conversions, prevConversions }) => ({ key, channel, label, conversions, prevConversions }))
    .sort((a, b) => a.channel.localeCompare(b.channel) || b.conversions - a.conversions || a.label.localeCompare(b.label));

  // Campaigns: any campaign with spend/delivery or conversions in the current period.
  const campaigns = new Map<string, AuritCampaignRow>();
  const ensureCampaign = (channel: AuritChannel, campaignId: string, name: string, type: string | null) => {
    const key = campaignKey(channel, campaignId);
    const existing = campaigns.get(key);
    if (existing) return existing;
    const row: AuritCampaignRow = {
      key, campaignId, campaign: name, channel, campaignType: type,
      spend: 0, prevSpend: 0, impressions: 0, clicks: 0,
      conversionsByType: {}, prevConversionsByType: {},
    };
    campaigns.set(key, row);
    return row;
  };
  const names = new Map<string, { name: string; type: string | null }>();
  for (const row of [...previous, ...current]) names.set(campaignKey(row.channel, row.campaignId), { name: row.campaignName, type: row.campaignType });

  for (const row of current) {
    const campaign = ensureCampaign(row.channel, row.campaignId, row.campaignName, row.campaignType);
    campaign.campaign = row.campaignName;
    campaign.campaignType = row.campaignType;
    campaign.spend += row.cost;
    campaign.impressions += row.impressions;
    campaign.clicks += row.clicks;
  }
  for (const row of currentConversions) {
    const known = names.get(campaignKey(row.channel, row.campaignId));
    const campaign = ensureCampaign(row.channel, row.campaignId, known?.name ?? row.campaignId, known?.type ?? null);
    add(campaign.conversionsByType, conversionKey(row.channel, row.conversionType), row.conversions);
  }
  for (const row of previous) {
    const campaign = campaigns.get(campaignKey(row.channel, row.campaignId));
    if (campaign) campaign.prevSpend += row.cost;
  }
  for (const row of previousConversions) {
    const campaign = campaigns.get(campaignKey(row.channel, row.campaignId));
    if (campaign) add(campaign.prevConversionsByType, conversionKey(row.channel, row.conversionType), row.conversions);
  }
  const campaignRows = Array.from(campaigns.values())
    .filter(row => row.spend > 0 || row.impressions > 0 || Object.values(row.conversionsByType).some(value => value > 0))
    .sort((a, b) => b.spend - a.spend);

  const days = new Map<string, AuritTimePoint>();
  const ensureDay = (date: string) => {
    const existing = days.get(date);
    if (existing) return existing;
    const point: AuritTimePoint = { label: date, spend: 0, conversionsByType: {} };
    days.set(date, point);
    return point;
  };
  for (const row of current) ensureDay(row.date).spend += row.cost;
  for (const row of currentConversions) add(ensureDay(row.date).conversionsByType, conversionKey(row.channel, row.conversionType), row.conversions);
  const timeSeries = Array.from(days.values()).sort((a, b) => a.label.localeCompare(b.label));

  return { channelRows, conversionTypes, campaignRows, timeSeries };
}
