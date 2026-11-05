'use client';

import type { AuritPacing, AuritPacingCard } from '@/lib/aurit-pacing';

const usd = (n: number | null) => n === null ? 'Unavailable' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const exactUsd = (n: number | null) => n === null ? 'Unavailable' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const percent = (n: number | null) => n === null ? 'Unavailable' : `${n.toFixed(1)}%`;
const barWidth = (n: number | null) => n === null ? 0 : Math.max(0, Math.min(n, 100));

function ChannelSpend({ label, card, blue }: { label: string; card: AuritPacingCard; blue: boolean }) {
  return (
    <div className={`${blue ? 'bg-blue-50/60' : 'bg-orange-50/60'} rounded-lg p-3`}>
      <p className={`text-xs font-semibold ${blue ? 'text-blue-700' : 'text-brand-orange'} mb-1`}>{label}</p>
      <p className="text-lg font-bold text-gray-900" title={exactUsd(card.spend)}>{usd(card.spend)}</p>
      <div className={`mt-1.5 h-1.5 ${blue ? 'bg-blue-100' : 'bg-orange-100'} rounded-full overflow-hidden`} aria-hidden="true">
        <div className={`h-full ${blue ? 'bg-blue-500' : 'bg-brand-orange'} rounded-full`} style={{ width: `${barWidth(card.spentPercent)}%` }} />
      </div>
    </div>
  );
}

function PacingCard({ title, card, pacing, id, children }: { title: string; card: AuritPacingCard; pacing: AuritPacing; id: string; children?: React.ReactNode }) {
  const status = card.status === 'On pace' ? 'On Track' : card.status === 'Behind pace' ? 'Behind Pace' : card.status;
  const tone = card.status === 'On pace' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  return (
    <section aria-label={`${title} monthly budget pacing`} data-pacing={id} className="min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title} Budget Pacing</h3>
          <p className="text-xs text-gray-400 mt-0.5">{pacing.cutoff ? `${pacing.monthStart} – ${pacing.cutoff}` : `${pacing.monthStart} · Awaiting completed-day data`}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${tone}`} title="On Track means within 10% of planned spend through the reporting cutoff.">{status}</span>
      </div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <span className="text-2xl font-bold text-gray-900" title={exactUsd(card.spend)}>{usd(card.spend)}</span>
          {card.spend !== null && <span className="text-sm text-gray-400 ml-1">spent</span>}
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">of </span>
          <span className="text-sm font-semibold text-gray-700" title={exactUsd(card.budget)}>{usd(card.budget)}</span>
        </div>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1" role="progressbar" aria-label={`${title} budget spent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={card.spentPercent === null ? undefined : barWidth(card.spentPercent)} aria-valuetext={card.spentPercent === null ? 'Unavailable' : `${percent(card.spentPercent)} of monthly budget spent`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth(card.spentPercent)}%`, background: 'linear-gradient(90deg, #0B4A31, #1a7a52)' }} />
        {card.expectedPercent !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60" title={`${percent(card.expectedPercent)} ideal pace`} style={{ left: `${Math.min(barWidth(card.expectedPercent), 99)}%` }} />}
      </div>
      <div className={`flex justify-between gap-2 text-xs text-gray-400 ${children ? 'mb-4' : ''}`}>
        <span>{percent(card.spentPercent)} spent</span>
        <span>{percent(card.expectedPercent)} ideal pace</span>
      </div>
      {children}
    </section>
  );
}

export function AuritBudgetPacing({ pacing }: { pacing: AuritPacing }) {
  return (
    <section aria-label="Monthly budget pacing" className="space-y-4">
      <PacingCard id="overall" title="Overall" card={pacing.overall} pacing={pacing}>
        <div className="grid grid-cols-2 gap-3">
          <ChannelSpend label="Meta" card={pacing.meta} blue />
          <ChannelSpend label="YouTube" card={pacing.youtube} blue={false} />
        </div>
      </PacingCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <PacingCard id="meta" title="Meta" card={pacing.meta} pacing={pacing} />
        <PacingCard id="youtube" title="YouTube" card={pacing.youtube} pacing={pacing} />
      </div>
      <p className="text-xs text-gray-400">Current-month pacing{pacing.cutoff ? ` through ${pacing.cutoff}` : ', awaiting completed-day data'}, independent of performance filters. YouTube includes Google Video only.</p>
      {(pacing.metaLatest !== pacing.yesterday || pacing.youtubeLatest !== pacing.yesterday) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Source coverage: Meta through {pacing.metaLatest ?? 'unavailable'}, YouTube through {pacing.youtubeLatest ?? 'unavailable'}. Missing source data is not treated as zero spend.</p>}
    </section>
  );
}
