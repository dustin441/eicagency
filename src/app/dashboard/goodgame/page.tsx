import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchGoodGameDashboardData, goodgameParamsFromSearch } from '@/services/goodgame-analytics';
import GoodGameDashboardClient from '@/components/GoodGameDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateGoodGameBudget } from './actions';

export default async function GoodGameDashboardPage({
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

  const params = goodgameParamsFromSearch(await searchParams);
  const data = await fetchGoodGameDashboardData(params);

  return (
    <GoodGameDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateGoodGameBudget}
    />
  );
}
