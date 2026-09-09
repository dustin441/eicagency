import React from 'react';
import NsiCreativeAnalysisClient from '@/components/NsiCreativeAnalysisClient';
import { fetchNsiCreativeAnalysis } from '@/services/nsi-creative-analytics';
import { fetchNsiMetaCreativeAnalysis } from '@/services/nsi-meta-creative-analytics';
import { fetchNsiMetaCreativeTests } from '@/services/nsi-meta-creative-learning';
import { requireClientAccess } from '@/lib/auth-guard';
import { canEditNsiMetaCreativeTests } from './meta-actions';

export default async function NsiCreativesPage() {
  await requireClientAccess('nsi');
  const [data, metaData, canEdit] = await Promise.all([
    fetchNsiCreativeAnalysis(),
    fetchNsiMetaCreativeAnalysis(),
    canEditNsiMetaCreativeTests(),
  ]);
  const accountCostPerLead = metaData.summary.leads > 0 ? metaData.summary.spend / metaData.summary.leads : null;
  const metaTests = await fetchNsiMetaCreativeTests(accountCostPerLead);
  return <NsiCreativeAnalysisClient data={data} metaData={metaData} metaTests={metaTests} canEditMetaTests={canEdit} />;
}
