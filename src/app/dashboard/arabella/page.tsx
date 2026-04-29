import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchArabellasDashboardData, arabellaParamsFromSearch } from '@/services/arabella-analytics';
import ArabellaHotelsDashboardClient from '@/components/ArabellaHotelsDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateArabellasBudget } from './actions';

export default async function ArabellasDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('arabella');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = arabellaParamsFromSearch(await searchParams);
  const data = await fetchArabellasDashboardData(params);

  return (
    <ArabellaHotelsDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateArabellasBudget}
    />
  );
}
