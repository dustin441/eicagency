const SUPPORTED_PREPASS_FOCUSES = new Set(['SMB', 'ABM', 'FD360']);

export function assertSupportedPrepassFocus(focus: string): void {
  if (!SUPPORTED_PREPASS_FOCUSES.has(focus)) {
    throw new Error(`Unsupported PrePass focus: ${focus}`);
  }
}

export function platformMatchesFocusChannel(
  rowPlatform: string | null | undefined,
  channel: 'Google' | 'Meta' | 'StackAdapt',
  focus: string,
): boolean {
  assertSupportedPrepassFocus(focus);
  const platform = String(rowPlatform ?? '').trim().toLowerCase();
  if (channel === 'Google') return platform === 'google';
  if (channel === 'StackAdapt') return platform.replace(/[\s_-]/g, '') === 'stackadapt';
  if (focus === 'ABM' || focus === 'FD360') {
    return ['meta', 'fb', 'facebook', 'ig', 'instagram'].includes(platform);
  }
  return platform === 'meta';
}

export function filterRowsForFocusChannel<T extends { platform: string }>(
  rows: T[],
  channel: string | null,
  focus: string,
): T[] {
  assertSupportedPrepassFocus(focus);
  if (!channel && (focus === 'ABM' || focus === 'SMB')) {
    return rows.filter((row) => String(row.platform ?? '').trim().toLowerCase() !== 'unattributed');
  }
  if (!channel) return rows;
  if (channel !== 'Google' && channel !== 'Meta' && channel !== 'StackAdapt') return [];
  return rows.filter((row) => platformMatchesFocusChannel(row.platform, channel, focus));
}

export function channelsForFocusQuery(channel: string | null, focus: string): Array<string | null> {
  assertSupportedPrepassFocus(focus);
  const metaAliases = ['Meta', 'fb', 'facebook', 'ig', 'instagram'];
  if (channel === null && focus === 'ABM') return ['Google', ...metaAliases, 'StackAdapt'];
  if (channel === null && focus === 'SMB') return ['Google', 'Meta', 'StackAdapt'];
  if ((focus === 'FD360' || focus === 'ABM') && channel === 'Meta') return metaAliases;
  return [channel];
}

export type AbmCampaignType = 'PMax' | 'Say Primer' | 'StackAdapt Retargeting' | 'Traditional Targeting';

export function classifyAbmCampaignType(campaignName: string | null | undefined): AbmCampaignType {
  const compactName = String(campaignName ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // PMax uses audience signals rather than exclusive audience targeting, so it
  // must remain separate even when the campaign name also contains Say Primer.
  if (compactName.includes('PMAX') || compactName.includes('PERFORMANCEMAX')) return 'PMax';
  if (compactName.includes('SAYPRIMER')) return 'Say Primer';
  if (compactName.includes('STACKADAPT')) return 'StackAdapt Retargeting';
  return 'Traditional Targeting';
}

export function combineRpcResponsesFailClosed<T>(
  responses: Array<{ data: T[] | null; error: unknown }>,
): { data: T[] | null; error: unknown } {
  const failed = responses.find((response) => response.error);
  if (failed) return { data: null, error: failed.error };
  return {
    data: responses.flatMap((response) => response.data ?? []),
    error: null,
  };
}
