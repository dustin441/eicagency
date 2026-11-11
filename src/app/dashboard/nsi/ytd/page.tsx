import NsiYtdClient from '@/components/NsiYtdClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchNsiYtdData } from '@/services/nsi-ytd';
import { getNsiYtdEmailSnapshot } from '@/services/nsi-ytd-email';
import { getNsiYtdMediaSnapshot } from '@/services/nsi-ytd-media';

export const dynamic = 'force-dynamic';

export default async function NsiYtdPage() {
  await requireClientAccess('nsi');
  const [data, emailData] = await Promise.all([
    fetchNsiYtdData(),
    getNsiYtdEmailSnapshot(),
  ]);
  const mediaData = getNsiYtdMediaSnapshot();
  return <NsiYtdClient data={data} emailData={emailData} mediaData={mediaData} />;
}
