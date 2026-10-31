import 'server-only';
import { fetchStackAdaptDelivery, type StackAdaptRequest } from './eic-stackadapt-core';
export type { StackAdaptMasterRow } from './eic-stackadapt-core';

/** Read-only, server-side EIC scope. No generic/PrePass token fallback. */
export async function fetchEicStackAdaptRows(start: string, end: string) {
  const token = process.env.STACKADAPT_EIC_API_TOKEN;
  if (!token) {
    console.error('[EIC StackAdapt] missing server configuration');
    throw new Error('StackAdapt data is temporarily unavailable.');
  }
  const request: StackAdaptRequest = async (query, variables) => {
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
  return fetchStackAdaptDelivery(start, end, request);
}
