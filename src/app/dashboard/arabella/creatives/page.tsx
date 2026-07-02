import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchArabellaCreativeAnalysis, arabellaParamsFromSearch } from '@/services/arabella-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function ArabellaCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('arabella');
  const params = arabellaParamsFromSearch(await searchParams);
  const data = await fetchArabellaCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="Arabella Hotels"
      advertiserName="The Arabella Sedona"
      logoUrl="/arabella-social-logo.jpg"
      data={data}
      metricMode="sales"
    />
  );
}
