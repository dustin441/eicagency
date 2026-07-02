import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchCBACreativeAnalysis, cbaParamsFromSearch } from '@/services/cba-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function CBACreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('cba');
  const params = cbaParamsFromSearch(await searchParams);
  const data = await fetchCBACreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="CBA Glass"
      advertiserName="CBA Glass"
      data={data}
      metricMode="leads"
    />
  );
}
