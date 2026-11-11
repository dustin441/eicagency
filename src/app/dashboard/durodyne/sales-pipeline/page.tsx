import Link from 'next/link';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchDurolinePipelineSnapshot } from '@/services/duroline-pipeline-analytics';
import DurolineSalesPipelineClient from '@/components/DurolineSalesPipelineClient';

export const dynamic = 'force-dynamic';

export default async function DurolineSalesPipelinePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireClientAccess('durodyne');
  const result = await fetchDurolinePipelineSnapshot();
  if (result.status !== 'ready') {
    return <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
      <Link href="/dashboard/durodyne" className="text-sm font-semibold text-brand-forest">← Duro Dyne performance</Link>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Duro Line sales pipeline</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Pipeline data is unavailable</h1>
        <p className="mt-3 max-w-xl text-slate-600">{result.status === 'missing'
          ? 'The first complete pipeline snapshot has not been published yet.'
          : 'The latest pipeline snapshot could not be loaded or validated. Please try again later.'} No lead counts or sales totals are shown until a valid snapshot is available.</p>
      </section>
    </main>;
  }
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
  return <DurolineSalesPipelineClient snapshot={result.snapshot} capturedAt={result.capturedAt}
    start={first(params.start)} end={first(params.end)} evaluatedAt={new Date().toISOString()} />;
}
