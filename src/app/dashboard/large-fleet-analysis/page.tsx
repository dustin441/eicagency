import { redirect } from 'next/navigation';
import LargeFleetSourceAnalysisClient from '@/components/LargeFleetSourceAnalysisClient';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchPrepassLargeFleetAnalysis } from '@/services/prepass-large-fleet';

export const dynamic = 'force-dynamic';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function LargeFleetSourceAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const raw = await searchParams;
  const now = new Date();
  const defaultEnd = isoDate(now);
  const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (!validDate(raw.start) || !validDate(raw.end) || raw.start! > raw.end!) {
    redirect(`/dashboard/large-fleet-analysis?start=2010-01-01&end=${defaultEnd}`);
  }
  const start = raw.start!;
  const end = raw.end!;
  const data = await fetchPrepassLargeFleetAnalysis(start, end);

  return <LargeFleetSourceAnalysisClient data={data} />;
}
