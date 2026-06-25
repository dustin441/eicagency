import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchGoodGameSalesData,
  goodgameSalesParamsFromSearch,
} from '@/services/goodgame-sales-analytics';
import GoodGameSalesDashboardClient from '@/components/GoodGameSalesDashboardClient';

export default async function GoodGameSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = goodgameSalesParamsFromSearch(await searchParams);
  const data = await fetchGoodGameSalesData(params);
  return <GoodGameSalesDashboardClient data={data} />;
}
