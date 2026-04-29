import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchBridgewayDashboardData, bridgewayParamsFromSearch } from '@/services/bridgeway-analytics';
import BridgewayDashboardClient from '@/components/BridgewayDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateBridgewayBudget } from './actions';

export default async function BridgewayDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('bridgeway');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = bridgewayParamsFromSearch(await searchParams);
  const data = await fetchBridgewayDashboardData(params);

  return (
    <BridgewayDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateBridgewayBudget}
    />
  );
}
