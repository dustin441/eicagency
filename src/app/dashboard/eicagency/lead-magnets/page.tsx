import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import { EIC_LEAD_MAGNETS } from '@/lib/eicagency-lead-magnets';
import {
  eicAgencyParamsFromSearch,
  fetchEicAgencyDashboardData,
} from '@/services/eicagency-analytics';
import EicLeadMagnetsDashboardClient from '@/components/EicLeadMagnetsDashboardClient';

export default async function EicAgencyLeadMagnetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('eicagency');

  const baseParams = eicAgencyParamsFromSearch(await searchParams);
  const leadMagnets = await Promise.all(
    EIC_LEAD_MAGNETS.map(async (leadMagnet) => ({
      ...leadMagnet,
      data: await fetchEicAgencyDashboardData({
        ...baseParams,
        campaignNames: leadMagnet.campaignNames,
      }),
    })),
  );

  return <EicLeadMagnetsDashboardClient leadMagnets={leadMagnets} />;
}
