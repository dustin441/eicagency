import SpartacoBrandHealthClient from '@/components/SpartacoBrandHealthClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchCachedSpartacoBrandHealth } from '@/services/spartaco-brand-health';

export default async function SpartacoBrandHealthPage() {
  await requireClientAccess('spartaco');
  const data = await fetchCachedSpartacoBrandHealth();
  return <SpartacoBrandHealthClient data={data} selectedBrand={null} />;
}