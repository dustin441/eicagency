import React from 'react';
import PrepassAppPerformanceClient from '@/components/PrepassAppPerformanceClient';
import { requireClientAccess } from '@/lib/auth-guard';
import {
  fetchPrepassAppPerformance,
  normalizePrepassAppRange,
} from '@/services/prepass-app-performance';

export const dynamic = 'force-dynamic';

export default async function PrepassAppPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = await searchParams;
  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = normalizePrepassAppRange(rawRange);
  const data = await fetchPrepassAppPerformance(range);

  return <PrepassAppPerformanceClient data={data} />;
}
