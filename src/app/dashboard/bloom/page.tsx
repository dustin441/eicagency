import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { bloomParamsFromSearch, fetchBloomDashboardData } from '@/services/bloom-analytics';
import BloomDashboardClient from '@/components/BloomDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateBloomBudget } from './actions';

export default async function BloomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('bloom');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = bloomParamsFromSearch(await searchParams);
  const data = await fetchBloomDashboardData(params);

  return (
    <BloomDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateBloomBudget}
    />
  );
}
