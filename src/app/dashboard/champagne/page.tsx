import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchChampagneDashboardData, champagneParamsFromSearch } from '@/services/champagne-analytics';
import ChampagneDashboardClient from '@/components/ChampagneDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateChampagneBudget } from './actions';

export default async function ChampagneDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('champagne');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = champagneParamsFromSearch(await searchParams);
  const data = await fetchChampagneDashboardData(params);

  return (
    <ChampagneDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateChampagneBudget}
    />
  );
}
