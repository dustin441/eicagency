import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchKinseyDashboardData, kinseyParamsFromSearch } from '@/services/kinsey-analytics';
import KinseyDesignDashboardClient from '@/components/KinseyDesignDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateKinseyBudget } from './actions';
import { redirect } from 'next/navigation';

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

  const query = await searchParams;
  const params = kinseyParamsFromSearch(query);
  if (!query.start || !query.end) {
    const normalized = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) normalized.set(key, value);
    }
    normalized.set('start', params.start);
    normalized.set('end', params.end);
    normalized.set('comp_start', params.compStart);
    normalized.set('comp_end', params.compEnd);
    normalized.set('compare', 'prev_period');
    redirect(`/dashboard/kinsey?${normalized.toString()}`);
  }
  const data = await fetchKinseyDashboardData(params);

  return (
    <KinseyDesignDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateKinseyBudget}
    />
  );
}
