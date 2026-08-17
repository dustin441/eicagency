const SUPPORTED_PREPASS_FOCUSES = new Set(['SMB', 'ABM', 'FD360']);

export function assertSupportedPrepassFocus(focus: string): void {
  if (!SUPPORTED_PREPASS_FOCUSES.has(focus)) {
    throw new Error(`Unsupported PrePass focus: ${focus}`);
  }
}

export function platformMatchesFocusChannel(
  rowPlatform: string | null | undefined,
  channel: 'Google' | 'Meta',
  focus: string,
): boolean {
  assertSupportedPrepassFocus(focus);
  const platform = String(rowPlatform ?? '').trim().toLowerCase();
  if (channel === 'Google') return platform === 'google';
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
  if (channel !== 'Google' && channel !== 'Meta') return [];
  return rows.filter((row) => platformMatchesFocusChannel(row.platform, channel, focus));
}

export function channelsForFocusQuery(channel: string | null, focus: string): Array<string | null> {
  assertSupportedPrepassFocus(focus);
  const metaAliases = ['Meta', 'fb', 'facebook', 'ig', 'instagram'];
  if (channel === null && focus === 'ABM') return ['Google', ...metaAliases];
  if (channel === null && focus === 'SMB') return ['Google', 'Meta'];
  if ((focus === 'FD360' || focus === 'ABM') && channel === 'Meta') return metaAliases;
  return [channel];
}

export function shouldUseUnfilteredAbmFleetTotals(focus: string, channel: string | null): boolean {
  assertSupportedPrepassFocus(focus);
  return focus === 'ABM' && channel === null;
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
