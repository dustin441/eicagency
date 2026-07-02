import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import { fetchBloomCreativeAnalysis, bloomParamsFromSearch } from '@/services/bloom-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function BloomCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('bloom');
  const params = bloomParamsFromSearch(await searchParams);
  const data = await fetchBloomCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="Bloom Aesthetics"
      advertiserName="Bloom Aesthetics"
      data={data}
      metricMode="leads"
      conversionLabel={{ conversion: 'Chats', cpa: 'Cost/Chat' }}
    />
  );
}
