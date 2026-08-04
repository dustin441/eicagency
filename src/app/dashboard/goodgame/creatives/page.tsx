import React from 'react';
import CreativeAnalysisClient from '@/components/CreativeAnalysisClient';
import {
  fetchGoodGameCreativeAnalysis,
  goodgameParamsFromSearch,
} from '@/services/goodgame-analytics';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchGoodGameCreativeTests } from '@/services/goodgame-creative-learning';
import { canEditGoodGameCreativeTests } from './actions';

export default async function GoodGameCreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = goodgameParamsFromSearch(await searchParams);
  const [data, canEdit] = await Promise.all([
    fetchGoodGameCreativeAnalysis(params),
    canEditGoodGameCreativeTests(),
  ]);
  const accountCostPerPurchase = data.summary.sales > 0
    ? data.summary.spend / data.summary.sales
    : null;
  const tests = await fetchGoodGameCreativeTests(accountCostPerPurchase);
  return (
    <CreativeAnalysisClient
      clientName="Good Game eCommerce"
      advertiserName="Good Game"
      data={data}
      metricMode="sales"
      insightVariant="creative-director"
      learningLoop={{ tests, canEdit }}
    />
  );
}
