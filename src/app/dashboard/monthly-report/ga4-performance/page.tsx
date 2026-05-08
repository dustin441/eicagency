import React from 'react';
import { fetchPrepassGa4PerformanceData } from '@/services/analytics';
import Ga4PerformanceClient from '@/components/Ga4PerformanceClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function Ga4PerformancePage() {
  await requireClientAccess('prepass');
  const data = await fetchPrepassGa4PerformanceData();
  return <Ga4PerformanceClient data={data} />;
}
