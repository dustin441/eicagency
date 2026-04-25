import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchGoodGameDashboardData, goodgameParamsFromSearch } from '@/services/goodgame-analytics';
import GoodGameDashboardClient from '@/components/GoodGameDashboardClient';

export default async function GoodGameDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');

  const params = goodgameParamsFromSearch(await searchParams);
  const data = await fetchGoodGameDashboardData(params);

  return <GoodGameDashboardClient data={data} />;
}
