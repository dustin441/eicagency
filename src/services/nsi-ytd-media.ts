import 'server-only';
import { parseMediaSnapshot, type MediaSnapshot } from '@/lib/nsi-ytd-media';
/** Called only after the NSI route authorizes the reporting user. Never bundled as public source data. */
export function getNsiYtdMediaSnapshot(): MediaSnapshot | null {
  const value = process.env.NSI_YTD_MEDIA_SNAPSHOT_JSON_V2 ?? process.env.NSI_YTD_MEDIA_SNAPSHOT_JSON;
  if (!value) return null;
  return parseMediaSnapshot(value);
}
