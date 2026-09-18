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
  const rawStart = Array.isArray(params.start) ? params.start[0] : params.start;
  const rawEnd = Array.isArray(params.end) ? params.end[0] : params.end;
  const range = normalizePrepassAppRange(rawRange);
  const data = await fetchPrepassAppPerformance(range, rawStart, rawEnd);

  return <PrepassAppPerformanceClient key={`${data.start}:${data.end}`} data={data} />;
}
