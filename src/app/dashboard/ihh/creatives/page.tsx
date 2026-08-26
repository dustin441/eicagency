import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchIhhCreativeAnalysis, ihhParamsFromSearch } from '@/services/ihh-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function IhhCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('ihh');
  const params = ihhParamsFromSearch(await searchParams);
  const data = await fetchIhhCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="InfiniteHeart Health"
      advertiserName="InfiniteHeart Health"
      data={data}
      metricMode="leads"
      conversionLabel={{ conversion: 'Pixel Scheduled', cpa: 'Cost / Pixel Schedule' }}
    />
  );
}
