import React from 'react';
import SpartacoCreativeAnalysisClient from '@/components/SpartacoCreativeAnalysisClient';
import {
  fetchSpartacoCreativeAnalysis,
  spartacoParamsFromSearch,
} from '@/services/spartaco-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function SpartacoCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('spartaco');
  const sp = await searchParams;
  const params = spartacoParamsFromSearch(sp);
  // Leads only — Spartaco Ad Analysis is lead-gen focused.
  const data = await fetchSpartacoCreativeAnalysis('LEAD', params);
  return <SpartacoCreativeAnalysisClient data={data} />;
}
