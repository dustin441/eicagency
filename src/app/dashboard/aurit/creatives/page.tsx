import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import AuritCreativeAnalysisClient from '@/components/AuritCreativeAnalysisClient';
import { fetchAuritCreativeAnalysis } from '@/services/aurit-creative-analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuritCreativesPage() {
  await requireClientAccess('aurit');
  const data = await fetchAuritCreativeAnalysis();
  return <AuritCreativeAnalysisClient data={data} />;
}
