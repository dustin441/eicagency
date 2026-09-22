import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchMedibraneDashboardData, medibraneParamsFromSearch } from '@/services/medibrane-analytics';
import MedibraneDashboardClient from '@/components/MedibraneDashboardClient';
import { createClient } from '@/utils/supabase/server';
import { updateMedibraneBudget } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MedibraneDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('medibrane');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'agency';

  const params = medibraneParamsFromSearch(await searchParams);
  const data = await fetchMedibraneDashboardData(params);

  return (
    <MedibraneDashboardClient
      data={data}
      isAdmin={isAdmin}
      updateBudget={updateMedibraneBudget}
    />
  );
}
