import React from 'react';
import { fetchPrepassCreativeAnalysis, paramsFromSearch } from '@/services/analytics';
import PrepassCreativeAnalysisClient from '@/components/PrepassCreativeAnalysisClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function PrepassCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const sp = await searchParams;
  const params = paramsFromSearch(sp);
  const data = await fetchPrepassCreativeAnalysis(params);
  return <PrepassCreativeAnalysisClient data={data} />;
}
