import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchEicContentDashboardData } from '@/services/eic-content';
import EicContentSocialClient from '@/components/EicContentSocialClient';
import { approveEicContentPost, rejectEicContentPost, updateEicContentPost } from './actions';
import { createEicContentUploadBatch } from './drop/actions';

export default async function EicAgencySocialPage() {
  await requireClientAccess('eicagency');
  const data = await fetchEicContentDashboardData();
  return <EicContentSocialClient data={data} approvePost={approveEicContentPost} rejectPost={rejectEicContentPost} updatePost={updateEicContentPost} createUploadBatch={createEicContentUploadBatch} />;
}
