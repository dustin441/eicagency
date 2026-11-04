import NsiYtdClient from '@/components/NsiYtdClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchNsiYtdData } from '@/services/nsi-ytd';

export const dynamic = 'force-dynamic';

export default async function NsiYtdPage() {
  await requireClientAccess('nsi');
  const data = await fetchNsiYtdData();
  return <NsiYtdClient data={data} />;
}
