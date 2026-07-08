import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchGoodGameAdAnalysis,
  goodgameAdAnalysisParamsFromSearch,
} from '@/services/goodgame-ad-analysis';
import GoodGameAdAnalysisClient from '@/components/GoodGameAdAnalysisClient';

export default async function GoodGameAdAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = goodgameAdAnalysisParamsFromSearch(await searchParams);
  const data = await fetchGoodGameAdAnalysis(params);
  return <GoodGameAdAnalysisClient data={data} />;
}
