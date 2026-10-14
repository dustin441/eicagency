import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import type { MarketoMirrorComparisonData, MarketoMirrorFocusComparison } from '@/services/analytics';
import type { ReportingV2CampaignMappings } from '@/services/prepass-reporting-v2';

const STAGE_LABELS = { MQL: 'MQL', SQL: 'SQL', WON: 'Closed Won' } as const;
const FOCUS_LABELS = { SMB: 'SMB', ABM: 'ABM', FD360: 'FD360', PAID_UNMAPPED: 'Paid, focus unmapped' } as const;

function count(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function delta(value: number) {
  return value === 0 ? '0' : `${value > 0 ? '+' : ''}${count(value)}`;
}

export function ReportingV2Unavailable({ reason }: { reason?: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-semibold text-amber-950">Reporting v2 schema is not initialized</h2>
          <p className="mt-1 text-sm text-amber-900">{reason ?? 'The comparison source is currently unavailable.'}</p>
          <p className="mt-2 text-sm text-amber-800">This comparison-only workspace does not affect any existing PrePass report.</p>
        </div>
      </div>
    </section>
  );
}

export function ReportingV2Overview({ data }: { data: MarketoMirrorComparisonData }) {
  if (!data.available) return <><FilterBar showChannel={false} /><ReportingV2Unavailable reason={data.unavailableReason} /></>;

  return (
    <>
      <FilterBar showChannel={false} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stageRows.map((row) => (
          <article key={row.stage} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{STAGE_LABELS[row.stage]} lifecycle total</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">{count(row.marketoCrm)}</p>
            <p className="mt-1 text-xs text-gray-500">Marketo CRM source of truth</p>
          </article>
        ))}
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source status</p>
          <div className="mt-2 flex items-center gap-2 text-lg font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Reconciled</div>
          <p className="mt-1 text-xs text-gray-500">{count(data.mirrorContacts)} mirrored people</p>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Comparison source status</h2>
            <p className="mt-1 text-sm text-gray-500">Lifecycle totals use Marketo stage dates from {data.start} through {data.end}.</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Legacy reporting remains active</div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Status label="Latest run" value={data.latestRun?.status ?? 'Unavailable'} />
          <Status label="Completed" value={data.latestRun?.completedAt ? new Date(data.latestRun.completedAt).toLocaleString('en-US') : 'Not recorded'} />
          <Status label="Provider / staged" value={`${count(data.latestRun?.providerCount ?? 0)} / ${count(data.latestRun?.stagedCount ?? 0)}`} />
          <Status label="Changed people" value={count(data.latestRun?.changedCount ?? 0)} />
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-950">Explore Reporting v2</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['SMB', '/dashboard/reporting-v2/smb', 'Compare SMB lifecycle stages.'],
            ['ABM', '/dashboard/reporting-v2/abm', 'Compare ABM lifecycle stages.'],
            ['FD360', '/dashboard/reporting-v2/fd360', 'Compare FD360 lifecycle stages.'],
            ['Campaign Performance', '/dashboard/reporting-v2/campaign-performance', 'Review focus allocation and active campaign mappings.'],
            ['Reconciliation', '/dashboard/reporting-v2/reconciliation', 'Open the detailed legacy-to-v2 audit.'],
          ].map(([label, href, text]) => (
            <Link key={href} href={href} className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-brand-forest/30">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-950">{label}</h3><ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-brand-forest" /></div>
              <p className="mt-2 text-sm text-gray-500">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function ReportingV2Focus({
  data,
  focus,
}: {
  data: MarketoMirrorComparisonData;
  focus: 'SMB' | 'ABM' | 'FD360';
}) {
  if (!data.available) return <><FilterBar showChannel={false} /><ReportingV2Unavailable reason={data.unavailableReason} /></>;
  const rows = data.focusRows.filter((row) => row.focus === focus);

  return (
    <>
      <FilterBar showChannel={false} />
      <section className="grid gap-4 lg:grid-cols-3">
        {rows.map((row) => <StageComparisonCard key={row.stage} row={row} />)}
      </section>
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">How to read this comparison</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">New paid attribution counts distinct mirrored Marketo people assigned to {focus} by approved paid evidence. Existing dashboard values are shown unchanged. Variance is existing minus v2 and is diagnostic, not a replacement metric.</p>
      </section>
    </>
  );
}

export function ReportingV2CampaignPerformance({
  data,
  mappings,
}: {
  data: MarketoMirrorComparisonData;
  mappings: ReportingV2CampaignMappings;
}) {
  return (
    <>
      <FilterBar showChannel={false} />
      {!data.available ? <ReportingV2Unavailable reason={data.unavailableReason} /> : (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-950">Available focus allocation comparison</h2>
            <p className="mt-1 text-sm text-gray-500">The current v2 RPC exposes lifecycle allocation by focus and stage. Unmapped paid evidence remains visible.</p>
          </div>
          <FocusTable rows={data.focusRows} />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-start gap-3"><Database className="mt-0.5 h-5 w-5 text-brand-forest" /><div>
            <h2 className="text-lg font-semibold text-gray-950">Active snapshot campaign mapping</h2>
            <p className="mt-1 text-sm text-gray-500">Campaign-level outcome detail is not yet exposed by the comparison RPC. It will populate from this active snapshot mapping; no campaign totals are inferred or invented here.</p>
          </div></div>
        </div>
        {!mappings.available ? <div className="p-6"><ReportingV2Unavailable reason={mappings.unavailableReason} /></div> : mappings.rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No approved campaign mappings overlap the selected date range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3">Focus</th><th className="px-6 py-3">Platform</th><th className="px-6 py-3">Canonical campaign</th><th className="px-6 py-3">Mapped alias</th><th className="px-6 py-3">Campaign ID</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{mappings.rows.map((row, index) => (
                <tr key={`${row.platform}-${row.campaignId ?? row.campaignAlias}-${index}`} className="text-gray-700"><td className="px-6 py-3 font-medium text-gray-950">{row.focus ?? 'Unassigned'}</td><td className="px-6 py-3">{row.platform}</td><td className="px-6 py-3">{row.canonicalCampaign}</td><td className="px-6 py-3">{row.campaignAlias}</td><td className="px-6 py-3 font-mono text-xs">{row.campaignId ?? '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function StageComparisonCard({ row }: { row: MarketoMirrorFocusComparison }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-950">{STAGE_LABELS[row.stage]}</h2>{row.variance === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <RefreshCw className="h-5 w-5 text-amber-600" />}</div>
      <dl className="mt-5 space-y-4 text-sm"><Metric label="New paid attribution" value={row.mirrorPaid} /><Metric label="Existing dashboard" value={row.legacyMmp} /><div className="border-t border-gray-100 pt-4"><Metric label="Existing minus v2" value={row.variance} signed /></div></dl>
    </article>
  );
}

function FocusTable({ rows }: { rows: MarketoMirrorFocusComparison[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3">Focus</th><th className="px-6 py-3">Stage</th><th className="px-6 py-3 text-right">New paid</th><th className="px-6 py-3 text-right">Existing</th><th className="px-6 py-3 text-right">Variance</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={`${row.focus}-${row.stage}`} className="text-gray-700"><td className="px-6 py-3 font-medium text-gray-950">{FOCUS_LABELS[row.focus]}</td><td className="px-6 py-3">{STAGE_LABELS[row.stage]}</td><td className="px-6 py-3 text-right tabular-nums">{count(row.mirrorPaid)}</td><td className="px-6 py-3 text-right tabular-nums">{count(row.legacyMmp)}</td><td className={`px-6 py-3 text-right font-medium tabular-nums ${row.variance === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{delta(row.variance)}</td></tr>)}</tbody></table></div>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-2 text-sm font-semibold text-gray-950">{value}</dd></div>;
}

function Metric({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="font-semibold tabular-nums text-gray-950">{signed ? delta(value) : count(value)}</dd></div>;
}
