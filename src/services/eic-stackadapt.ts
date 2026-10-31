import 'server-only';
import { fetchStackAdaptDelivery, fetchStackAdaptCampaignMetrics, type StackAdaptRequest } from './eic-stackadapt-core';
export type { StackAdaptMasterRow, StackAdaptCampaignMetricsRow } from './eic-stackadapt-core';

/** Read-only, server-side EIC scope. No generic/PrePass token fallback. */
function createStackAdaptRequest<Record>(): StackAdaptRequest<Record> {
  const token = process.env.STACKADAPT_EIC_API_TOKEN;
  if (!token) {
    console.error('[EIC StackAdapt] missing server configuration');
    throw new Error('StackAdapt data is temporarily unavailable.');
  }
  const request: StackAdaptRequest<Record> = async (query, variables) => {
    try {
      const response = await fetch('https://api.stackadapt.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25_000),
        // Never retain a transient provider error in Next's fetch cache.
        cache: 'no-store',
      });
      if (!response.ok) {
        console.error('[EIC StackAdapt] provider HTTP status', response.status);
        throw new Error('upstream unavailable');
      }
      return await response.json();
    } catch {
      throw new Error('StackAdapt data is temporarily unavailable.');
    }
  };
  return request;
}

export async function fetchEicStackAdaptRows(start: string, end: string) {
  return fetchStackAdaptDelivery(start, end, createStackAdaptRequest());
}

/** Native onsite totals for this exact window; no GA4 dependency or daily averaging. */
export async function fetchEicStackAdaptCampaignMetrics(start: string, end: string) {
  return fetchStackAdaptCampaignMetrics(start, end, createStackAdaptRequest());
}
