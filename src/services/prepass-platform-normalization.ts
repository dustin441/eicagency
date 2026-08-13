export function platformMatchesFocusChannel(
  rowPlatform: string | null | undefined,
  channel: 'Google' | 'Meta',
  focus: string,
): boolean {
  const platform = String(rowPlatform ?? '').trim().toLowerCase();
  if (channel === 'Google') return platform === 'google';
  if (focus !== 'FD360') return platform === 'meta';
  return ['meta', 'fb', 'facebook', 'ig', 'instagram'].includes(platform);
}

export function filterRowsForFocusChannel<T extends { platform: string }>(
  rows: T[],
  channel: string | null,
  focus: string,
): T[] {
  if (!channel) return rows;
  if (channel !== 'Google' && channel !== 'Meta') return [];
  return rows.filter((row) => platformMatchesFocusChannel(row.platform, channel, focus));
}

export function channelsForFocusQuery(channel: string | null, focus: string): Array<string | null> {
  if (focus === 'FD360' && channel === 'Meta') return ['Meta', 'fb', 'ig'];
  return [channel];
}
