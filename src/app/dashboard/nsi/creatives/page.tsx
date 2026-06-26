import React from 'react';
import NsiCreativeAnalysisClient from '@/components/NsiCreativeAnalysisClient';
import { fetchNsiCreativeAnalysis } from '@/services/nsi-creative-analytics';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function NsiCreativesPage() {
  await requireClientAccess('nsi');
  const data = await fetchNsiCreativeAnalysis();
  return <NsiCreativeAnalysisClient data={data} />;
}
