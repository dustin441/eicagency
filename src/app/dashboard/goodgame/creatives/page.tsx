import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import {
  fetchGoodGameCreativeAnalysis,
  goodgameParamsFromSearch,
} from '@/services/goodgame-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function GoodGameCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = goodgameParamsFromSearch(await searchParams);
  const data = await fetchGoodGameCreativeAnalysis(params);
  return (
    <CreativeAnalysisClient
      clientName="Good Game eCommerce"
      advertiserName="Good Game"
      data={data}
      metricMode="sales"
      insightVariant="creative-director"
    />
  );
}
