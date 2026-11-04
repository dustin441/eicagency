'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { AuritPacing, AuritPacingCard } from '@/lib/aurit-pacing';

const usd = (n: number | null) => n === null ? 'Unavailable' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (n: number | null) => n === null ? 'Unavailable' : `${n.toFixed(1)}%`;

function PacingCard({ title, card, cutoff, id }: { title: string; card: AuritPacingCard; cutoff: string | null; id: string }) {
  const tone = card.status === 'On pace' ? 'bg-emerald-50 text-emerald-700' : card.status === 'Ahead of pace' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-800';
  return (
    <section aria-label={`${title} monthly budget pacing`} data-pacing={id} className="min-w-0 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{card.status}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {[
          ['Monthly budget', usd(card.budget)], ['Spent through cutoff', usd(card.spend)],
          ['Planned through cutoff', usd(card.expected)], ['Budget remaining', usd(card.remaining)],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-base font-semibold text-gray-900">{value}</dd></div>)}
      </dl>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
        <p>{percent(card.spentPercent)} of budget spent, {percent(card.expectedPercent)} of month elapsed</p>
        <p>Actual minus planned: <span className="font-semibold">{usd(card.variance)}</span></p>
      </div>
      <div className="mt-4 h-56 w-full" role="img" aria-label={`${title} cumulative actual spend versus planned monthly spend${cutoff ? ` through ${cutoff}` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.points} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tickFormatter={date => String(date).slice(5)} minTickGap={28} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={n => `$${Number(n).toLocaleString('en-US')}`} tick={{ fontSize: 11 }} width={65} />
            <Tooltip formatter={value => usd(value == null ? null : Number(value))} labelFormatter={label => String(label)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="linear" dataKey="planned" name="Planned spend" stroke="#EB541E" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="actual" name="Actual spend" stroke="#0B4A31" strokeWidth={3} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            {cutoff && <ReferenceLine x={cutoff} stroke="#94a3b8" strokeDasharray="3 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-gray-400">Solid green: cumulative actual. Dashed orange: even daily budget plan. Future actual spend is not filled in.</p>
    </section>
  );
}

export function AuritBudgetPacing({ pacing }: { pacing: AuritPacing }) {
  const month = new Date(`${pacing.monthStart}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section aria-label="Monthly budget pacing" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Monthly Budget Pacing: {month}</h2>
        <p className="mt-1 text-sm text-gray-500">{pacing.monthStart} to {pacing.monthEnd}. {pacing.cutoff ? `Actual spend through ${pacing.cutoff}.` : 'Awaiting reported completed-day spend.'} UTC reporting dates, excluding today. Independent of the performance date and channel filters.</p>
        <p className="mt-1 text-xs text-gray-500">Overall = Meta + YouTube (Google Video only). All charts use the same available cutoff. On pace means within 10% of the planned spend through that day.</p>
        {(pacing.metaLatest !== pacing.yesterday || pacing.youtubeLatest !== pacing.yesterday) && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Source coverage: Meta through {pacing.metaLatest ?? 'unavailable'}, YouTube through {pacing.youtubeLatest ?? 'unavailable'}. Missing source data is not treated as zero spend.</p>}
      </div>
      <PacingCard id="overall" title="Overall" card={pacing.overall} cutoff={pacing.cutoff} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PacingCard id="meta" title="Meta" card={pacing.meta} cutoff={pacing.cutoff} />
        <PacingCard id="youtube" title="YouTube" card={pacing.youtube} cutoff={pacing.cutoff} />
      </div>
    </section>
  );
}
