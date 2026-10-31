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
type DeliveryResponse = {
  errors?: unknown[];
  data?: {
    advertisers?: { nodes: { id: string; name: string }[] };
    campaignDelivery?: {
      __typename: string;
      records?: { nodes: DeliveryRecord[]; totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    };
  };
};
export type StackAdaptRequest = (query: string, variables: { date: { from: string; to: string }; after: string | null }) => Promise<DeliveryResponse>;

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

export async function fetchStackAdaptDelivery(start: string, end: string, request: StackAdaptRequest): Promise<StackAdaptMasterRow[]> {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
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
