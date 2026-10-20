export type NullableMetricAccumulator = {
  total: number;
  complete: boolean;
};

type AdIdentityRow = {
  ad_id?: string | null;
  ad_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  campaign_name?: string | null;
};

export type AdDisplayMetadata = {
  adName: string;
  adsetName: string;
  campaignName: string;
};

type AdsetIdentityRow = {
  adset_id?: string | null;
  adset_name?: string | null;
  campaign_name?: string | null;
};

export function accumulateNullableMetric(
  accumulator: NullableMetricAccumulator,
  rawValue: number | null | undefined,
): NullableMetricAccumulator {
  if (rawValue === null || rawValue === undefined) {
    return { ...accumulator, complete: false };
  }
  return {
    total: accumulator.total + Number(rawValue),
    complete: accumulator.complete,
  };
}

export function ihhAdIdentityKey(row: AdIdentityRow): string {
  if (row.ad_id) return `id:${row.ad_id}`;
  return `fallback:${row.campaign_name ?? ''}\u001f${row.adset_id || row.adset_name || ''}\u001f${row.ad_name ?? ''}`;
}

export function latestIhhAdDisplayMetadata(
  current: AdDisplayMetadata,
  row: AdIdentityRow,
): AdDisplayMetadata {
  return {
    adName: row.ad_name || current.adName,
    adsetName: row.adset_name || current.adsetName,
    campaignName: row.campaign_name || current.campaignName,
  };
}

export function ihhAdsetIdentityKey(row: AdsetIdentityRow): string {
  if (row.adset_id) return `id:${row.adset_id}`;
  return `fallback:${row.campaign_name ?? ''}\u001f${row.adset_name ?? ''}`;
}
