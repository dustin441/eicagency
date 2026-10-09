import React from 'react';
import { AlertTriangle, CheckCircle2, Database, GitCompareArrows } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import type { MarketoMirrorComparisonData } from '@/services/analytics';

const STAGE_LABELS = { MQL: 'MQL', SQL: 'SQL', WON: 'Closed Won' } as const;
const FOCUS_LABELS = { SMB: 'SMB', ABM: 'ABM', FD360: 'FD360', PAID_UNMAPPED: 'Paid, focus unmapped' } as const;

function count(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function delta(value: number) {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${count(value)}`;
}

export default function MarketoMirrorComparison({ data }: { data: MarketoMirrorComparisonData }) {
  if (!data.available) {
    return (
      <div className="space-y-6">
        <Header />
        <FilterBar showChannel={false} />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-semibold text-amber-950">Mirror comparison is not initialized</h2>
              <p className="mt-1 text-sm text-amber-900">{data.unavailableReason}</p>
              <p className="mt-2 text-sm text-amber-800">The existing PrePass reports remain unchanged and available.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />
      <FilterBar showChannel={false} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Mirrored Marketo people" value={count(data.mirrorContacts)} detail="Current full-population mirror" />
        <StatusCard label="Latest mirror run" value={data.latestRun?.status === 'completed' ? 'Reconciled' : 'No completed run'} detail={data.latestRun?.completedAt ? new Date(data.latestRun.completedAt).toLocaleString('en-US') : 'Waiting for initial backfill'} />
        <StatusCard label="Provider rows" value={count(data.latestRun?.providerCount ?? 0)} detail={`Staged ${count(data.latestRun?.stagedCount ?? 0)}`} />
        <StatusCard label="Changed people" value={count(data.latestRun?.changedCount ?? 0)} detail={data.latestRun?.kind === 'full_snapshot' ? 'Full snapshot' : 'Incremental sync'} />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Lifecycle outcome comparison</h2>
            <p className="mt-1 text-sm text-gray-500">{data.start} through {data.end}, each Marketo person counted once per stage using the stage&apos;s own date.</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Marketo is the lifecycle source of truth</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.stageRows.map((row) => (
            <article key={row.stage} className="rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-950">{STAGE_LABELS[row.stage]}</h3>
                {row.variance === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Metric label="Marketo CRM total" value={row.marketoCrm} emphasis />
                <Metric label="New paid attribution" value={row.mirrorPaid} />
                <Metric label="Paid, focus unmapped" value={row.mirrorPaidUnmapped} />
                <Metric label="Existing dashboard" value={row.legacyMmp} />
                <div className="border-t border-gray-100 pt-3"><Metric label="Legacy minus new paid" value={row.variance} signed /></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-950">Focus allocation comparison</h2>
          <p className="mt-1 text-sm text-gray-500">Unmapped paid evidence stays visible instead of being forced into ABM, SMB, or FD360.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-6 py-3">Focus</th><th className="px-6 py-3">Stage</th><th className="px-6 py-3 text-right">New paid</th><th className="px-6 py-3 text-right">Existing</th><th className="px-6 py-3 text-right">Variance</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.focusRows.map((row) => (
                <tr key={`${row.focus}-${row.stage}`} className="text-gray-700">
                  <td className="px-6 py-3 font-medium text-gray-950">{FOCUS_LABELS[row.focus]}</td>
                  <td className="px-6 py-3">{STAGE_LABELS[row.stage]}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{count(row.mirrorPaid)}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{count(row.legacyMmp)}</td>
                  <td className={`px-6 py-3 text-right font-medium tabular-nums ${row.variance === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{delta(row.variance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Rule title="Lifecycle truth" text="Marketo dateMQL, dateSQL, and dateClosedWon create exactly one person-stage event." />
        <Rule title="Attribution truth" text="Paid UTM or click evidence and validated originating calls assign credit. Unknown remains unmapped." />
        <Rule title="Legacy preserved" text="Existing tables, pages, and MMP calculations remain unchanged while both paths reconcile side by side." />
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-brand-forest"><Database className="h-4 w-4" /> PrePass data quality</div>
        <h1 className="mt-1 text-2xl font-bold text-gray-950">Marketo Mirror Comparison</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">A side-by-side audit of raw CRM lifecycle reality, canonical paid attribution, and the existing reporting model.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600"><GitCompareArrows className="h-4 w-4" /> Comparison only, no cutover</div>
    </header>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-gray-950">{value}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></article>;
}

function Metric({ label, value, signed = false, emphasis = false }: { label: string; value: number; signed?: boolean; emphasis?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><dt className={emphasis ? 'font-medium text-gray-950' : 'text-gray-500'}>{label}</dt><dd className={`tabular-nums ${emphasis ? 'text-lg font-bold text-brand-forest' : 'font-semibold text-gray-950'}`}>{signed ? delta(value) : count(value)}</dd></div>;
}

function Rule({ title, text }: { title: string; text: string }) {
  return <article className="rounded-xl border border-gray-200 bg-white p-5"><h3 className="font-semibold text-gray-950">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{text}</p></article>;
}
