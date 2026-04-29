import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchKinseyDashboardData, kinseyParamsFromSearch } from '@/services/kinsey-analytics';
import KinseyDesignDashboardClient from '@/components/KinseyDesignDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateKinseyBudget } from './actions';

export default async function KinseyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('kinsey');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = kinseyParamsFromSearch(await searchParams);
  const data = await fetchKinseyDashboardData(params);

  return (
    <KinseyDesignDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateKinseyBudget}
    />
  );
}
