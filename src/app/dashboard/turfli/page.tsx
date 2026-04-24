import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchTurfliDashboardData, turfliParamsFromSearch } from '@/services/turfli-analytics';
import TurfliDashboardClient from '@/components/TurfliDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateTurliBudget } from './actions';

export default async function TurfliDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('turfli');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = turfliParamsFromSearch(await searchParams);
  const data = await fetchTurfliDashboardData(params);

  return (
    <TurfliDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateTurliBudget}
    />
  );
}
