import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchState48DashboardData, state48ParamsFromSearch } from '@/services/state48-analytics';
import State48DashboardClient from '@/components/State48DashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateState48Budget } from './actions';

export default async function State48DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('state48');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = state48ParamsFromSearch(await searchParams);
  const data = await fetchState48DashboardData(params);

  return (
    <State48DashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateState48Budget}
    />
  );
}
