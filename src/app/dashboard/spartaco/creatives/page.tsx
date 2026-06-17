import React from 'react';
import SpartacoCreativeAnalysisClient from '@/components/SpartacoCreativeAnalysisClient';
import {
  fetchSpartacoCreativeAnalysis,
  spartacoParamsFromSearch,
  type SpartacoCreativeMode,
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
  const mode: SpartacoCreativeMode = sp.mode === 'SALES' ? 'SALES' : 'LEAD';
  const data = await fetchSpartacoCreativeAnalysis(mode, params);
  return <SpartacoCreativeAnalysisClient data={data} />;
}
