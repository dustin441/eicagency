import 'server-only';
import { fetchStackAdaptDelivery, type StackAdaptRequest } from './eic-stackadapt-core';
export type { StackAdaptMasterRow } from './eic-stackadapt-core';

/** Read-only, server-side EIC scope. No generic/PrePass token fallback. */
export async function fetchEicStackAdaptRows(start: string, end: string) {
  const token = process.env.STACKADAPT_EIC_API_TOKEN;
  if (!token) throw new Error('StackAdapt data is temporarily unavailable.');
  const request: StackAdaptRequest = async (query, variables) => {
    try {
      const response = await fetch('https://api.stackadapt.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25_000),
        // Cache only successful reads briefly; current credential participates in
        // Next's server fetch cache key. Never serialize the token to the client.
        next: { revalidate: 900 },
      });
      if (!response.ok) throw new Error('upstream unavailable');
      return await response.json();
    } catch {
      throw new Error('StackAdapt data is temporarily unavailable.');
    }
  };
  return fetchStackAdaptDelivery(start, end, request);
}
