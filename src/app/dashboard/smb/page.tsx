import React from 'react';
import { fetchFocusData, paramsFromSearch } from '@/services/analytics';
import FocusDashboardClient from '@/components/FocusDashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function SmbPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const data = await fetchFocusData('SMB', params);
  return <FocusDashboardClient data={data} />;
}
