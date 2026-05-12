import React from 'react';
import NsiDashboardClient from '@/components/NsiDashboardClient';
import { fetchNsiDashboardData, nsiParamsFromSearch } from '@/services/nsi-analytics';
import { requireClientAccess } from '@/lib/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { saveNsiPerformanceNote } from '../actions';

export default async function NsiMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('nsi');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = nsiParamsFromSearch(await searchParams, 'trailing12');
  const data = await fetchNsiDashboardData(params);

  return (
    <NsiDashboardClient
      data={data}
      isAdmin={isAdmin}
      saveNote={saveNsiPerformanceNote}
      pageTitle="NSI Monthly Performance"
      pageSubtitle="Trailing 12-month view — campaign analytics by month"
    />
  );
}
