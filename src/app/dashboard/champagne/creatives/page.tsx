import React from 'react';
import ChampagneCreativeAnalysisClient from '@/components/ChampagneCreativeAnalysisClient';
import { fetchChampagneCreativeAnalysis } from '@/services/champagne-creative-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function ChampagneCreativesPage() {
  await requireClientAccess('champagne');
  const data = await fetchChampagneCreativeAnalysis();
  return <ChampagneCreativeAnalysisClient data={data} />;
}
