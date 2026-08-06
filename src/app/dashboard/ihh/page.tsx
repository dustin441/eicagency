import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchIhhsDashboardData, ihhParamsFromSearch } from '@/services/ihh-analytics';
import IhhDashboardClient from '@/components/IhhDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateIhhsBudget } from './actions';

export default async function IhhsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('ihh');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = ihhParamsFromSearch(await searchParams);
  const data = await fetchIhhsDashboardData(params);

  return (
    <IhhDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateIhhsBudget}
    />
  );
}
