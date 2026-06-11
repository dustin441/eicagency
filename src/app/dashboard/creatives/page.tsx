import React from 'react';
import { fetchPrepassCreativeAnalysis, paramsFromSearch } from '@/services/analytics';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const sp = await searchParams;
  const params = paramsFromSearch(sp);
  const focus = sp.focus ?? 'all';
  const data = await fetchPrepassCreativeAnalysis(focus, params);
  return <CreativeAnalysisClient data={data} />;
}
