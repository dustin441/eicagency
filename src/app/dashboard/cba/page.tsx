import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchCBADashboardData, cbaParamsFromSearch } from '@/services/cba-analytics';
import CBAGlassDashboardClient from '@/components/CBAGlassDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateCBABudget } from './actions';

export default async function CBADashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('cba');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = cbaParamsFromSearch(await searchParams);
  const data = await fetchCBADashboardData(params);

  return (
    <CBAGlassDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateCBABudget}
    />
  );
}
