import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchLifeRepDashboardData, liferepParamsFromSearch } from '@/services/liferep-analytics';
import LifeRepDashboardClient from '@/components/LifeRepDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateLifeRepBudget } from './actions';

export default async function LifeRepDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('liferep');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = liferepParamsFromSearch(await searchParams);
  const data = await fetchLifeRepDashboardData(params);

  return (
    <LifeRepDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateLifeRepBudget}
    />
  );
}
