import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchDurodyneDashboardData, durodyneParamsFromSearch } from '@/services/durodyne-analytics';
import DurodyneDashboardClient from '@/components/DurodyneDashboardClient';
import { updateDurodyneBudget } from './actions';

export default async function DurodyneDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('durodyne');

  const params = durodyneParamsFromSearch(await searchParams);
  const data = await fetchDurodyneDashboardData(params);

  return (
    <DurodyneDashboardClient
      data={data}
      isAdmin={false}
      updateBudget={updateDurodyneBudget}
    />
  );
}
