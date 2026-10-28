import React from 'react';
import { requireAgencyAccess } from '@/lib/auth-guard';
import { fetchBarbriPlanningDashboard } from '@/services/barbri-planning';
import BarbriPlanningDashboardClient from '@/components/BarbriPlanningDashboardClient';

export const dynamic = 'force-dynamic';

export default async function BarbriPlanningDashboardPage() {
  await requireAgencyAccess();
  const data = await fetchBarbriPlanningDashboard();
  return <BarbriPlanningDashboardClient data={data} />;
}
