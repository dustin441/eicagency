import React from 'react';
import {
  fetchDashboardData,
  fetchPrepassQualifiedFleetOriginFunnel,
  fetchPrepassWeeklyExecutiveReadout,
  paramsFromSearch,
} from '@/services/analytics';
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
  const [data, weeklyReadout, qualifiedFleetOrigins] = await Promise.all([
    fetchDashboardData(params),
    fetchPrepassWeeklyExecutiveReadout().catch(() => READOUT_FALLBACK),
    fetchPrepassQualifiedFleetOriginFunnel(params),
  ]);

  return (
    <DashboardClient
      initialData={data}
      weeklyReadout={weeklyReadout}
      qualifiedFleetOrigins={qualifiedFleetOrigins}
    />
  );
}
