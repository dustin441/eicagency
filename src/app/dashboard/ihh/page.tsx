import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchIhhsDashboardData, ihhParamsFromSearch } from '@/services/ihh-analytics';
import { fetchIhhMetaPaidCohort } from '@/services/ihh-contact-cohort-source';
import IhhDashboardClient from '@/components/IhhDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateIhhsBudget } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IhhsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('ihh');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const search = await searchParams;
  // Preserve existing media defaults; the new funnel defaults to its verified collection window.
  const params = ihhParamsFromSearch(search);
  const [data, cohort] = await Promise.all([
    fetchIhhsDashboardData(params),
    fetchIhhMetaPaidCohort({ ...params, sinceCollectionStart: !search.start && !search.end }),
  ]);

  return (
    <IhhDashboardClient
      data={data}
      cohort={cohort}
      isAdmin={isAdmin}
      updateBudget={updateIhhsBudget}
    />
  );
}
