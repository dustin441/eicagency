import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchDurodyneDashboardData, durodyneParamsFromSearch } from '@/services/durodyne-analytics';
import DurodyneDashboardClient from '@/components/DurodyneDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateDurodyneBudget } from './actions';

export default async function DurodyneDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('durodyne');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = durodyneParamsFromSearch(await searchParams);
  const data = await fetchDurodyneDashboardData(params);

  return (
    <DurodyneDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateDurodyneBudget}
    />
  );
}
