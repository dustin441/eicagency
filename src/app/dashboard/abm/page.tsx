import React from 'react';
import { fetchFocusData, paramsFromSearch } from '@/services/analytics';
import FocusDashboardClient from '@/components/FocusDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { updatePrepassBudget } from '../actions';

export default async function AbmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = paramsFromSearch(await searchParams);
  const data = await fetchFocusData('ABM', params);
  return <FocusDashboardClient data={data} isAdmin={isAdmin} updateBudget={updatePrepassBudget} />;
}
