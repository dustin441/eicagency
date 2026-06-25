import React from 'react';
import PrepassCreativeAnalysisClient from '@/components/PrepassCreativeAnalysisClient';
import { fetchPrepassCreativeAiInsights } from '@/services/analytics';
import { requireClientAccess } from '@/lib/auth-guard';

// PrePass "Ad Analysis" tab — daily AI creative insights per focus (SMB / ABM /
// FD360) from the vision workflow, written to `prepass_creative_ai_insights`.
export default async function PrepassCreativesPage() {
  await requireClientAccess('prepass');
  const insights = await fetchPrepassCreativeAiInsights();
  return <PrepassCreativeAnalysisClient insights={insights} />;
}
