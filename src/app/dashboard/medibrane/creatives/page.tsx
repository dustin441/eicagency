import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import MedibraneCreativeAnalysisClient from '@/components/MedibraneCreativeAnalysisClient';
import { fetchMedibraneCreativeAnalysis } from '@/services/medibrane-creative-analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MedibraneCreativesPage() {
  await requireClientAccess('medibrane');
  const data = await fetchMedibraneCreativeAnalysis();
  return <MedibraneCreativeAnalysisClient data={data} />;
}
