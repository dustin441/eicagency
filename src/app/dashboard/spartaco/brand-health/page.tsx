import SpartacoPdfReport from '@/components/SpartacoPdfReport';
import SpartacoBrandHealthClient from '@/components/SpartacoBrandHealthClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchCachedSpartacoBrandHealth } from '@/services/spartaco-brand-health';

export default async function SpartacoBrandHealthPage() {
  await requireClientAccess('spartaco');
  const data = await fetchCachedSpartacoBrandHealth();
  return <SpartacoPdfReport><SpartacoBrandHealthClient data={data} selectedBrand={null} /></SpartacoPdfReport>;
}