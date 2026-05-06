import React from 'react';
import { fetchMonthlyReportData, fetchMonthlyReadout } from '@/services/analytics';
import MonthlyReportClient from '@/components/MonthlyReportClient';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = await searchParams;
  const focus  = params.focus ?? 'all';
  const [data, readout] = await Promise.all([fetchMonthlyReportData(focus), fetchMonthlyReadout()]);
  return <MonthlyReportClient data={data} readout={readout} />;
}
