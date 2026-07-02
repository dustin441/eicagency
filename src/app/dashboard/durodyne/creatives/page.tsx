import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchDurodyneCreativeAnalysis, durodyneParamsFromSearch } from '@/services/durodyne-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function DurodyneCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('durodyne');
  const params = durodyneParamsFromSearch(await searchParams);
  const data = await fetchDurodyneCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="Duro Dyne"
      advertiserName="Duro Dyne"
      data={data}
      metricMode="leads"
    />
  );
}
