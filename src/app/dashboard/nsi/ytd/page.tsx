import NsiYtdClient from '@/components/NsiYtdClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchNsiYtdData } from '@/services/nsi-ytd';
import { getNsiYtdEmailSnapshot } from '@/services/nsi-ytd-email';

export const dynamic = 'force-dynamic';

export default async function NsiYtdPage() {
  await requireClientAccess('nsi');
  const [data, emailData] = await Promise.all([
    fetchNsiYtdData(),
    getNsiYtdEmailSnapshot(),
  ]);
  return <NsiYtdClient data={data} emailData={emailData} />;
}
