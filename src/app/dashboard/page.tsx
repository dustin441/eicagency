import React from 'react';
import { fetchDashboardData, fetchPrepassWeeklyExecutiveReadout, paramsFromSearch } from '@/services/analytics';
import type { WeeklyExecutiveReadout } from '@/services/analytics';
import DashboardClient from '@/components/DashboardClient';
import { requireClientAccess } from '@/lib/auth-guard';

const EMPTY_SEGMENT = { smb: [], abm: [], fd360: [] };
const READOUT_FALLBACK: WeeklyExecutiveReadout = {
  currentStart: '', currentEnd: '',
  overallStory: [],
  wins: EMPTY_SEGMENT, opportunities: EMPTY_SEGMENT,
  executionContext: [], accomplishments: [], focusNextWeek: [],
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = paramsFromSearch(await searchParams);
  const [data, weeklyReadout] = await Promise.all([
    fetchDashboardData(params),
    fetchPrepassWeeklyExecutiveReadout().catch(() => READOUT_FALLBACK),
  ]);

  return <DashboardClient initialData={data} weeklyReadout={weeklyReadout} />;
}
