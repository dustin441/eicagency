import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchEicAgencyDashboardData, eicAgencyParamsFromSearch } from '@/services/eicagency-analytics';
import EicAgencyDashboardClient from '@/components/EicAgencyDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateEicAgencyBudget } from './actions';

export default async function EicAgencyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('eicagency');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = eicAgencyParamsFromSearch(await searchParams);
  const data = await fetchEicAgencyDashboardData(params);

  return (
    <EicAgencyDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateEicAgencyBudget}
    />
  );
}
