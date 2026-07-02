import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchKinseyCreativeAnalysis, kinseyParamsFromSearch } from '@/services/kinsey-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function KinseyCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('kinsey');
  const params = kinseyParamsFromSearch(await searchParams);
  const data = await fetchKinseyCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="Kinsey Design"
      advertiserName="Kinsey Design"
      logoUrl="/kinsey-design-social-logo.jpg"
      data={data}
      metricMode="sales"
    />
  );
}
