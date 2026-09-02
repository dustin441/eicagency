export type ClientHealthPresentationStatus =
  | 'healthy'
  | 'watch'
  | 'at_risk'
  | 'incomplete'
  | 'configuration_required'
  | 'unavailable';

export interface ClientHealthPresentationSource {
  status: 'running' | 'succeeded' | 'partial' | 'failed' | 'unavailable' | 'unknown';
  stale: boolean | null;
}

export function clientHealthSourcePresentationStatus(
  source: ClientHealthPresentationSource,
): ClientHealthPresentationStatus {
  if (source.status === 'unavailable') return 'unavailable';
  if (source.status === 'succeeded') return source.stale === true ? 'watch' : 'healthy';
  if (source.status === 'partial') return 'watch';
  return 'incomplete';
}

export function formatClientHealthTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value));
}
