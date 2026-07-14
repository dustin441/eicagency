import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchGoodGameSalesData,
  goodgameSalesParamsFromSearch,
} from '@/services/goodgame-sales-analytics';
import GoodGameSalesDashboardClient from '@/components/GoodGameSalesDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateGoodGameSalesBudget } from '../actions';

export default async function GoodGameSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = goodgameSalesParamsFromSearch(await searchParams);
  const data = await fetchGoodGameSalesData(params);
  return <GoodGameSalesDashboardClient data={data} isAdmin={isAdmin} updateBudget={updateGoodGameSalesBudget} />;
}
