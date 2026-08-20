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
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientHealthDashboardData, ClientHealthRow } from '@/services/client-health';
import type { MetricAssessment } from '@/lib/client-health-rating';

const STATUS_META = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  moderate: { label: 'Moderate', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  unhealthy: { label: 'Not Healthy', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
  unknown: { label: 'Missing', dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-500 border-gray-200', icon: CircleHelp },
} as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function StatusBadge({ status, score }: { status: ClientHealthRow['status']; score?: number }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap', meta.badge)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}{score !== undefined ? ` · ${score}` : ''}
    </span>
  );
}

function MetricCell({ assessment, primary, secondary }: { assessment: MetricAssessment; primary: string; secondary?: string }) {
  const meta = STATUS_META[assessment.status];
  return (
    <div className="min-w-[132px]" title={assessment.reason}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} />
        <span className="font-semibold text-slate-800 tabular-nums">{primary}</span>
      </div>
      {secondary && <p className="mt-1 pl-4 text-[11px] leading-4 text-slate-400">{secondary}</p>}
    </div>
  );
}

function ClientRow({ row }: { row: ClientHealthRow }) {
  const trend = row.values.currentCostPerResult !== null && row.values.previousCostPerResult
    ? ((row.values.currentCostPerResult - row.values.previousCostPerResult) / row.values.previousCostPerResult) * 100
    : null;
  return (
    <>
      <tr className="border-b border-slate-100 align-top hover:bg-slate-50/70 transition-colors">
        <td className="sticky left-0 z-10 bg-white px-5 py-5 group-hover:bg-slate-50">
          <Link href={row.href} className="group inline-flex items-center gap-2 font-bold text-slate-900 hover:text-brand-forest">
            {row.name}<ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-forest" />
          </Link>
          <p className="mt-1 text-xs text-slate-400">{row.reasons.length} item{row.reasons.length === 1 ? '' : 's'} need attention</p>
        </td>
        <td className="px-4 py-5"><StatusBadge status={row.status} score={row.score} /></td>
        <td className="px-4 py-5">
          <MetricCell
            assessment={row.metrics.budget}
            primary={row.values.spendPercent === null ? 'Not set' : `${row.values.spendPercent.toFixed(0)}% spent`}
            secondary={row.values.budget === null ? 'Budget missing' : `${money.format(row.values.monthSpend ?? 0)} / ${money.format(row.values.budget)} · ${row.values.expectedPacePercent.toFixed(0)}% pace`}
          />
        </td>
        <td className="px-4 py-5">
          <MetricCell
            assessment={row.metrics.northStar}
            primary={row.values.currentCostPerResult === null ? 'No result data' : moneyPrecise.format(row.values.currentCostPerResult)}
            secondary={`${row.values.northStarLabel}${trend === null ? '' : ` · ${trend >= 0 ? '+' : ''}${trend.toFixed(0)}% vs prior 14d`}`}
          />
        </td>
        <td className="px-4 py-5">
          <MetricCell
            assessment={row.metrics.hours}
            primary={row.values.hoursUsed === null ? 'No tracked time' : `${row.values.hoursUsed.toFixed(1)}h used`}
            secondary={row.values.hoursAllotted === null ? 'Allotment not set' : `${row.values.hoursAllotted.toFixed(1)}h monthly allotment`}
          />
        </td>
        <td className="px-4 py-5">
          <MetricCell
            assessment={row.metrics.overdue}
            primary={row.values.overdueCount === null ? 'No task data' : `${row.values.overdueCount} overdue`}
            secondary={row.overdueTasks.length ? `${row.overdueTasks.length} task links available` : 'ClickUp task sync'}
          />
        </td>
        <td className="px-4 py-5">
          <MetricCell
            assessment={row.metrics.margin}
            primary={row.values.marginPercent === null ? 'Not updated' : `${row.values.marginPercent.toFixed(1)}%`}
            secondary="Current-month margin sheet"
          />
        </td>
        <td className="px-5 py-5 text-right">
          <details className="group/details relative inline-block text-left">
            <summary className="list-none cursor-pointer inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-slate-900">
              Review <ChevronDown className="h-3.5 w-3.5 group-open/details:rotate-180 transition-transform" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-[360px] max-w-[80vw] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="font-bold text-slate-900">Why {row.name} is {STATUS_META[row.status].label.toLowerCase()}</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(row.metrics).filter(([, metric]) => metric.status !== 'healthy').map(([key, metric]) => (
                  <div key={key} className="flex gap-3 text-sm">
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', STATUS_META[metric.status].dot)} />
                    <div><p className="font-semibold text-slate-700">{metric.reason}</p>{metric.fix && <p className="mt-0.5 text-slate-500">{metric.fix}</p>}</div>
                  </div>
                ))}
                {row.reasons.length === 0 && <p className="text-sm text-slate-500">All five health checks are in range.</p>}
              </div>
              {row.overdueTasks.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Oldest overdue tasks</p>
                  <div className="mt-2 space-y-2">
                    {row.overdueTasks.map((task) => <a key={task.url} href={task.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-brand-forest hover:underline">{task.name}</a>)}
                  </div>
                </div>
              )}
            </div>
          </details>
        </td>
      </tr>
    </>
  );
}

export default function ClientHealthDashboardClient({ data }: { data: ClientHealthDashboardData }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ClientHealthRow['status']>('all');
  const rows = useMemo(() => data.rows.filter((row) => {
    const matchesQuery = row.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (status === 'all' || row.status === status);
  }), [data.rows, query, status]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-20">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-forest"><Clock3 className="h-4 w-4" /> {data.periodLabel}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-dark">Client Health</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A weighted view of delivery, performance, utilization, execution, and profitability. Missing inputs stay visible and can’t silently score green.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Updated {new Date(data.generatedAt).toLocaleString()}</span>
          {Object.entries(data.sourceStatus).map(([source, sourceStatus]) => <span key={source} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1"><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[sourceStatus].dot)} />{source === 'marginSheet' ? 'Margin sheet' : source[0].toUpperCase() + source.slice(1)}</span>)}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {(['healthy', 'moderate', 'unhealthy'] as const).map((item) => {
          const meta = STATUS_META[item];
          return <button key={item} onClick={() => setStatus(status === item ? 'all' : item)} className={cn('flex items-center justify-between rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md', status === item ? meta.badge : 'border-slate-200')}><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{meta.label}</p><p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.counts[item]}</p></div><span className={cn('h-3 w-3 rounded-full ring-4 ring-offset-4', meta.dot, item === 'healthy' ? 'ring-emerald-100' : item === 'moderate' ? 'ring-amber-100' : 'ring-red-100')} /></button>;
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-brand-forest focus:bg-white" /></div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><SlidersHorizontal className="h-4 w-4" /> Weighted: budget 25 · north star 25 · hours 20 · tasks 15 · margin 15</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{['Client', 'Overall', 'Budget pacing', 'North star trend', 'Hours pacing', 'Overdue tasks', 'Margin', ''].map((label) => <th key={label} className={cn('px-4 py-3', label === 'Client' && 'sticky left-0 z-20 bg-slate-50 px-5')}>{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <ClientRow key={row.id} row={row} />)}</tbody>
          </table>
          {rows.length === 0 && <div className="p-12 text-center text-sm text-slate-500">No clients match this filter.</div>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="flex items-center gap-2 font-bold text-slate-900"><SlidersHorizontal className="h-4 w-4 text-brand-forest" /> Rating rules</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600"><li><b>Green:</b> score 80–100, no red metric, no more than one missing input.</li><li><b>Yellow:</b> score 50–79, one red metric, or multiple missing inputs.</li><li><b>Red:</b> score below 50 or two or more red metrics.</li><li>Lower north-star cost is better. Missing data scores neutral but blocks false confidence.</li></ul></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="flex items-center gap-2 font-bold text-slate-900"><Wrench className="h-4 w-4 text-brand-orange" /> Inputs to complete</h2><p className="mt-4 text-sm leading-6 text-slate-600">Populate <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">client_health_settings.monthly_hours_allotment</code> in Supabase for contracted hours. The margin sheet must contain current-month tracked hours before its formula output is accepted. ClickUp uses live time entries when <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">CLICKUP_API</code> is configured and falls back to synchronized overdue tasks.</p></div>
      </section>
    </div>
  );
}
