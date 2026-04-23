import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchNsiRevenueData } from '@/services/nsi-revenue-analytics';
import NsiRevenueClient from '@/components/NsiRevenueClient';

export default async function NsiRevenuePage() {
  await requireClientAccess('nsi');
  const data = await fetchNsiRevenueData();
  return <NsiRevenueClient data={data} />;
}
