import { requireClientAccess as assertClientAccess } from '@/lib/auth-guard';
import MarketoDatabaseDashboard from '@/components/MarketoDatabaseDashboard';
import { fetchMarketoDatabase } from '@/services/prepass-marketo-database';
export const dynamic = 'force-dynamic';
export default async function MarketoDatabasePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await assertClientAccess('prepass');
  const { report, filters } = await fetchMarketoDatabase(await searchParams);
  return <MarketoDatabaseDashboard report={report} filters={filters} />;
}
