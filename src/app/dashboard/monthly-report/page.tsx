import React from 'react';
import MonthlyReportClient from '@/components/MonthlyReportClient';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchActivePrepassMonthlyPublication,
  PREPASS_MONTHLY_FOCUSES,
  type PrepassMonthlyFocus,
} from '@/services/prepass-monthly-publication';

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = await searchParams;
  const requestedFocus = params.focus ?? 'all';
  const focus: PrepassMonthlyFocus = PREPASS_MONTHLY_FOCUSES.includes(requestedFocus as PrepassMonthlyFocus)
    ? requestedFocus as PrepassMonthlyFocus
    : 'all';
  const publication = await fetchActivePrepassMonthlyPublication();
  return (
    <MonthlyReportClient
      data={publication.payload.variants[focus]}
      readout={publication.payload.readout}
      publication={{
        revision: publication.revision,
        publishedAt: publication.publishedAt,
        sourceCutoff: publication.sourceCutoff,
      }}
    />
  );
}
