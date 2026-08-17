export function platformMatchesFocusChannel(
  rowPlatform: string | null | undefined,
  channel: 'Google' | 'Meta',
  focus: string,
): boolean {
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
  if (!channel && (focus === 'ABM' || focus === 'SMB')) {
    return rows.filter((row) => String(row.platform ?? '').trim().toLowerCase() !== 'unattributed');
  }
  if (!channel) return rows;
  if (channel !== 'Google' && channel !== 'Meta') return [];
  return rows.filter((row) => platformMatchesFocusChannel(row.platform, channel, focus));
}

export function channelsForFocusQuery(channel: string | null, focus: string): Array<string | null> {
  const metaAliases = ['Meta', 'fb', 'facebook', 'ig', 'instagram'];
  if (channel === null && focus === 'ABM') return ['Google', ...metaAliases];
  if (channel === null && focus === 'SMB') return ['Google', 'Meta'];
  if ((focus === 'FD360' || focus === 'ABM') && channel === 'Meta') return metaAliases;
  return [channel];
}
