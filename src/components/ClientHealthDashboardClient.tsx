'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ClientHealthDashboardData,
  ClientHealthDimension,
  ClientHealthDimensionStatus,
  ClientHealthRow,
} from '@/services/client-health';
import { clientHealthSourcePresentationStatus, formatClientHealthTimestamp } from '@/lib/client-health-presentation';

const STATUS_META = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  watch: { label: 'Watch', dot: 'bg-amber-400', badge: 'border-amber-200 bg-amber-50 text-amber-700', icon: AlertTriangle },
  at_risk: { label: 'At Risk', dot: 'bg-red-500', badge: 'border-red-200 bg-red-50 text-red-700', icon: AlertTriangle },
  incomplete: { label: 'Incomplete', dot: 'bg-sky-400', badge: 'border-sky-200 bg-sky-50 text-sky-700', icon: CircleHelp },
  configuration_required: { label: 'Configuration Required', dot: 'bg-violet-500', badge: 'border-violet-200 bg-violet-50 text-violet-700', icon: SlidersHorizontal },
  unavailable: { label: 'Unavailable (optional)', dot: 'bg-slate-300', badge: 'border-slate-200 bg-slate-50 text-slate-600', icon: CircleHelp },
} as const;

const OVERALL_FILTERS = [
  ['healthy', 'Healthy', 'healthy'],
  ['watch', 'Watch', 'watch'],
  ['at_risk', 'At Risk', 'atRisk'],
  ['incomplete', 'Incomplete', 'incomplete'],
  ['configuration_required', 'Configuration Required', 'configurationRequired'],
] as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function dateOnly(value: string | null): string {
  if (value === null) return 'Unavailable';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}


function statusAllowsScore(status: ClientHealthRow['status']): boolean {
  return status !== 'incomplete' && status !== 'configuration_required';
}

function StatusBadge({ status, score }: { status: ClientHealthRow['status']; score: number | null }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap', meta.badge)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}{statusAllowsScore(status) && score !== null ? ` · ${number.format(score)}` : ''}
    </span>
  );
}

function dimensionValue(key: keyof ClientHealthRow['dimensions'], dimension: ClientHealthDimension): string {
  if (dimension.value === null) return 'Unavailable';
  if (key === 'overdueTasks') return `${number.format(dimension.value)} overdue`;
  if (key === 'northStarCost') return money.format(dimension.value);
  return `${number.format(dimension.value)}%`;
}

function DimensionCell({ dimension, dimensionKey }: { dimension: ClientHealthDimension; dimensionKey: keyof ClientHealthRow['dimensions'] }) {
  const meta = STATUS_META[dimension.status];
  return (
    <div className="min-w-[150px]" title={dimension.reason}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
        <span className="font-semibold tabular-nums text-slate-800">{dimensionValue(dimensionKey, dimension)}</span>
      </div>
      <p className="mt-1 pl-4 text-[11px] leading-4 text-slate-500">{meta.label}</p>
    </div>
  );
}

function ClientName({ row }: { row: ClientHealthRow }) {
  if (row.dashboardHref === null) return <span className="font-bold text-slate-900">{row.name}</span>;
  return (
    <Link href={row.dashboardHref} className="group inline-flex items-center gap-2 font-bold text-slate-900 hover:text-brand-forest">
      {row.name}<ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-forest" />
    </Link>
  );
}

function Freshness({ row }: { row: ClientHealthRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.sourceFreshness.length === 0 ? (
        <span className="text-xs text-slate-500">No source freshness published</span>
      ) : row.sourceFreshness.map((source) => {
        const sourceStatus: ClientHealthDimensionStatus = clientHealthSourcePresentationStatus(source);
        return (
          <span key={source.key} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[sourceStatus].dot)} />
            {source.key}: {source.status}{source.stale ? ' · stale' : ''} · {dateOnly(source.dataThrough)}
          </span>
        );
      })}
    </div>
  );
}

function ReviewDetails({ row }: { row: ClientHealthRow }) {
  return (
    <details className="group/details rounded-xl border border-slate-200 bg-slate-50/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-bold text-slate-700">
        Snapshot review
        <ChevronDown className="h-4 w-4 transition-transform group-open/details:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4 text-sm">
        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p><b>Snapshot date:</b> {dateOnly(row.timestamps.snapshotDate)}</p>
          <p><b>Data through:</b> {dateOnly(row.timestamps.dataThrough)}</p>
          <p><b>Current window:</b> {dateOnly(row.timestamps.currentWindowStart)} – {dateOnly(row.timestamps.currentWindowEnd)}</p>
          <p><b>Prior window:</b> {dateOnly(row.timestamps.priorWindowStart)} – {dateOnly(row.timestamps.priorWindowEnd)}</p>
          <p className="sm:col-span-2"><b>Calculated:</b> {formatClientHealthTimestamp(row.timestamps.calculatedAt)}</p>
        </div>
        <Freshness row={row} />
        <div className="space-y-3">
          {Object.entries(row.dimensions).map(([key, dimension]) => (
            <div key={key} className="rounded-lg bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-800">{dimension.label}</p>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', STATUS_META[dimension.status].badge)}>{STATUS_META[dimension.status].label}</span>
              </div>
              <p className="mt-1 text-slate-600">{dimension.reason}</p>
              {dimension.config ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  Snapshot config: {dimension.config.required ? 'required' : 'optional'} · weight {number.format(dimension.config.weight)} · {dimension.config.direction.replaceAll('_', ' ')} · healthy {number.format(dimension.config.greenThreshold)} · watch {number.format(dimension.config.yellowThreshold)}
                </p>
              ) : <p className="mt-2 text-[11px] text-violet-600">Metric configuration has not been approved.</p>}
            </div>
          ))}
        </div>
        {row.reasons.length > 0 && (
          <div><p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Overall reasons</p><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
        )}
        {row.tasks.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Published overdue tasks</p>
            <ul className="mt-2 space-y-2">
              {row.tasks.map((task) => <li key={task.id}>{task.href ? <a href={task.href} target="_blank" rel="noreferrer" className="font-semibold text-brand-forest hover:underline">{task.name}</a> : <span className="font-semibold text-slate-700">{task.name}</span>}{task.dueAt ? <span className="text-slate-500"> · due {dateOnly(task.dueAt)}</span> : null}</li>)}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function MobileCard({ row }: { row: ClientHealthRow }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><ClientName row={row} /><p className="mt-1 text-xs text-slate-500">Snapshot date: {dateOnly(row.timestamps.snapshotDate)}</p></div>
        <StatusBadge status={row.status} score={row.score} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(row.dimensions).map(([key, dimension]) => (
          <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{dimension.label}</p>
            <DimensionCell dimension={dimension} dimensionKey={key as keyof ClientHealthRow['dimensions']} />
          </div>
        ))}
      </div>
      <div className="mt-4"><ReviewDetails row={row} /></div>
    </article>
  );
}

export default function ClientHealthDashboardClient({ data }: { data: ClientHealthDashboardData }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ClientHealthRow['status']>('all');
  const rows = useMemo(() => data.rows.filter((row) => (
    row.name.toLowerCase().includes(query.trim().toLowerCase())
    && (status === 'all' || row.status === status)
  )), [data.rows, query, status]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-20">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-forest"><Clock3 className="h-4 w-4" /> Published snapshots</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-dark">Client Health</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A read-only review of immutable, reconciled snapshots. Missing and unapproved inputs remain explicit and never silently score green.</p>
        </div>
        <Link href="/dashboard/eicagency/client-health/settings" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-forest hover:text-brand-forest">
          <SlidersHorizontal className="h-4 w-4" /> Economics settings
        </Link>
      </header>

      {data.state === 'no_published_snapshots' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <CircleHelp className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 font-bold text-slate-900">No published client-health snapshots</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">The review dashboard will remain empty until an approved configuration is collected, validated, and published. No live source reads are performed by this page.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {OVERALL_FILTERS.map(([value, label, countKey]) => {
              const meta = STATUS_META[value];
              return <button key={value} onClick={() => setStatus(status === value ? 'all' : value)} className={cn('flex items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', status === value ? meta.badge : 'border-slate-200')}><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.counts[countKey]}</p></div><span className={cn('h-3 w-3 rounded-full', meta.dot)} /></button>;
            })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-brand-forest focus:bg-white" /></div>
              <p className="text-xs text-slate-500">Thresholds and weights shown are preserved from each published snapshot.</p>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1250px] text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{['Client', 'Overall', 'Budget pacing', 'North-star cost', 'Hours pacing', 'Overdue tasks', 'Margin'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top last:border-0"><td className="px-4 py-5"><ClientName row={row} /><p className="mt-1 text-xs text-slate-400">Snapshot date: {dateOnly(row.timestamps.snapshotDate)}</p></td><td className="px-4 py-5"><StatusBadge status={row.status} score={row.score} /></td>{Object.entries(row.dimensions).map(([key, dimension]) => <td key={key} className="px-4 py-5"><DimensionCell dimension={dimension} dimensionKey={key as keyof ClientHealthRow['dimensions']} /></td>)}</tr>)}</tbody>
              </table>
              {rows.map((row) => <div key={`${row.id}-review`} className="border-t border-slate-100 p-4"><p className="mb-2 text-xs font-bold text-slate-500">{row.name}</p><ReviewDetails row={row} /></div>)}
            </div>
            <div className="space-y-4 p-4 lg:hidden">{rows.map((row) => <MobileCard key={row.id} row={row} />)}</div>
            {rows.length === 0 && <div className="p-12 text-center text-sm text-slate-500">No clients match the current search or status filter.</div>}
          </section>
        </>
      )}
    </div>
  );
}
