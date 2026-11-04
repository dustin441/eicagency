import 'server-only';
import { parseEmailSnapshot, type EmailSnapshot } from '@/lib/nsi-ytd-email';

/** Protected snapshot configuration is read only after the YTD route authorizes NSI access. */
export function getNsiYtdEmailSnapshot(): EmailSnapshot {
  const raw = process.env.NSI_YTD_EMAIL_SNAPSHOT_JSON;
  if (!raw) throw new Error('NSI YTD email snapshot is not configured');
  return parseEmailSnapshot(raw);
}
