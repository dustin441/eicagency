// Official GraphQL delivery contract; intentionally independent of Next.js for testing.
export type StackAdaptMasterRow = {
  date: string;
  campaign_name: string;
  source: 'StackAdapt';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: null;
  purchases: null;
};

type DeliveryRecord = {
  campaign: { id: string; name: string; advertiser: { id: string; name: string } };
  granularity: { time: string };
  metrics: { cost: string | number; impressionsBigint: string | number; clicksBigint: string | number };
};
type DeliveryResponse<Record = DeliveryRecord> = {
  errors?: unknown[];
  data?: {
    advertisers?: { nodes: { id: string; name: string }[] };
    campaignDelivery?: {
      __typename: string;
      records?: { nodes: Record[]; totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    };
  };
};
export type StackAdaptRequest<Record = DeliveryRecord> = (query: string, variables: { date: { from: string; to: string }; after: string | null }) => Promise<DeliveryResponse<Record>>;

export type StackAdaptCampaignMetricsRow = {
  campaign_name: string;
  pageStarts: number | null;
  engagements: number | null;
  /** Native percentage, not a fraction or a daily average. */
  engagementRate: number | null;
  costPerEngagement: number | null;
  /** Native total landing-page time in seconds. */
  totalTime: number | null;
};
type CampaignMetricsRecord = {
  campaign: { id: string; name: string; advertiser: { id: string } };
  metrics: {
    pageStartsBigint: string | number | null;
    engagementsBigint: string | number | null;
    engagementRate: string | number | null;
    ecpe: string | number | null;
    totalTime: string | number | null;
  };
};
export type StackAdaptCampaignMetricsRequest = StackAdaptRequest<CampaignMetricsRecord>;

const CAMPAIGN_METRICS_QUERY = `query EicCampaignMetrics($date: DateRangeInput!, $after: String) {
  advertisers(first: 2, filterBy: {ids: ["150300"]}) { nodes { id name } }
  campaignDelivery(dataType: TABLE, granularity: TOTAL, date: $date, filterBy: {advertiserIds: ["150300"]}) {
    __typename
    ... on CampaignDeliveryOutcome {
      records(first: 100, after: $after) {
        totalCount pageInfo { hasNextPage endCursor }
        nodes { campaign { id name advertiser { id } } metrics { pageStartsBigint engagementsBigint engagementRate ecpe totalTime } }
      }
    }
  }
}`;

export async function fetchStackAdaptCampaignMetrics(start: string, end: string, request: StackAdaptCampaignMetricsRequest): Promise<StackAdaptCampaignMetricsRow[]> {
  if (!validDate(start) || !validDate(end) || start > end) throw unavailable();
  const exclusiveEnd = new Date(`${end}T00:00:00Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  const apiEnd = exclusiveEnd.toISOString().slice(0, 10);
  const metric = (value: unknown, integer = false): number | null => {
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && (!integer || Number.isSafeInteger(number)) ? number : null;
  };
  let after: string | null = null;
  let totalCount: number | undefined;
  const seenCursors = new Set<string>();
  const seenCampaigns = new Set<string>();
  const rows: StackAdaptCampaignMetricsRow[] = [];
  do {
    const result = await request(CAMPAIGN_METRICS_QUERY, { date: { from: start, to: apiEnd }, after });
    const advertisers = result?.data?.advertisers?.nodes;
    const delivery = result?.data?.campaignDelivery;
    const records = delivery?.records;
    if (result?.errors?.length || advertisers?.length !== 1 || advertisers[0].id !== '150300' || advertisers[0].name !== 'EIC Agency' || delivery?.__typename !== 'CampaignDeliveryOutcome' || !records || !Array.isArray(records.nodes) || !Number.isSafeInteger(records.totalCount) || records.totalCount < 0 || typeof records.pageInfo?.hasNextPage !== 'boolean') throw unavailable();
    if (totalCount !== undefined && totalCount !== records.totalCount) throw unavailable();
    totalCount = records.totalCount;
    for (const record of records.nodes) {
      const campaign = record?.campaign;
      if (campaign?.advertiser?.id !== '150300' || typeof campaign.id !== 'string' || !campaign.id.trim() || typeof campaign.name !== 'string' || !campaign.name.trim() || seenCampaigns.has(campaign.id) || !record.metrics) throw unavailable();
      seenCampaigns.add(campaign.id);
      rows.push({
        campaign_name: campaign.name,
        pageStarts: metric(record.metrics.pageStartsBigint, true),
        engagements: metric(record.metrics.engagementsBigint, true),
        engagementRate: metric(record.metrics.engagementRate),
        costPerEngagement: metric(record.metrics.ecpe),
        totalTime: metric(record.metrics.totalTime),
      });
    }
    if (rows.length > totalCount) throw unavailable();
    if (!records.pageInfo.hasNextPage) {
      if (rows.length !== totalCount) throw unavailable();
      return rows;
    }
    after = records.pageInfo.endCursor;
    if (typeof after !== 'string' || !after || seenCursors.has(after) || records.nodes.length === 0 || seenCursors.size >= 1000) throw unavailable();
    seenCursors.add(after);
  } while (true);
}

const QUERY = `query EicDelivery($date: DateRangeInput!, $after: String) {
  advertisers(first: 2, filterBy: {ids: ["150300"]}) { nodes { id name } }
  campaignDelivery(dataType: TABLE, granularity: DAILY, date: $date, filterBy: {advertiserIds: ["150300"]}) {
    __typename
    ... on CampaignDeliveryOutcome {
      records(first: 100, after: $after) {
        totalCount pageInfo { hasNextPage endCursor }
        nodes { campaign { id name advertiser { id name } } granularity { time } metrics { cost impressionsBigint clicksBigint } }
      }
    }
  }
}`;
const unavailable = () => new Error('StackAdapt data is temporarily unavailable.');

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export async function fetchStackAdaptDelivery(start: string, end: string, request: StackAdaptRequest): Promise<StackAdaptMasterRow[]> {
  if (!validDate(start) || !validDate(end) || start > end) throw unavailable();
  // StackAdapt DateRangeInput.to is exclusive (verified against adjacent
  // live daily windows); dashboard end dates are inclusive.
  const exclusiveEnd = new Date(`${end}T00:00:00Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  const apiEnd = exclusiveEnd.toISOString().slice(0, 10);
  let after: string | null = null;
  const seenCursors = new Set<string>();
  const seenRecords = new Set<string>();
  const rows: StackAdaptMasterRow[] = [];
  do {
    const result = await request(QUERY, { date: { from: start, to: apiEnd }, after });
    const advertisers = result.data?.advertisers?.nodes;
    const delivery = result.data?.campaignDelivery;
    const records = delivery?.records;
    if (result.errors?.length || advertisers?.length !== 1 || advertisers[0].id !== '150300' || advertisers[0].name !== 'EIC Agency' || delivery?.__typename !== 'CampaignDeliveryOutcome' || !records) throw unavailable();
    for (const record of records.nodes) {
      const date = record.granularity?.time;
      const values = [record.metrics?.cost, record.metrics?.impressionsBigint, record.metrics?.clicksBigint];
      const key = `${date}:${record.campaign?.id}`;
      if (record.campaign?.advertiser?.id !== '150300' || !record.campaign?.id || !record.campaign?.name || !date || !validDate(date) || date < start || date > end || seenRecords.has(key) || values.some(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) throw unavailable();
      if (!Number.isSafeInteger(Number(record.metrics.impressionsBigint)) || !Number.isSafeInteger(Number(record.metrics.clicksBigint))) throw unavailable();
      seenRecords.add(key);
      rows.push({
        date: record.granularity.time, campaign_name: record.campaign.name, source: 'StackAdapt',
        cost: Number(record.metrics.cost), impressions: Number(record.metrics.impressionsBigint), clicks: Number(record.metrics.clicksBigint),
        // Never turn generic DSP conversions into appointments/leads.
        conversions: null, purchases: null,
      });
    }
    if (!records.pageInfo.hasNextPage) {
      if (rows.length !== records.totalCount) throw unavailable();
      return rows;
    }
    after = records.pageInfo.endCursor;
    if (!after || seenCursors.has(after) || records.nodes.length === 0 || seenCursors.size >= 1000) throw unavailable();
    seenCursors.add(after);
  } while (true);
}
