'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, fmtCurrency, fmtNumber } from '@/lib/utils';
import type { SalesYoYData } from '@/services/prepass-sales-overview';

/** Below this many traced paid wins in a month, the traced cost is too noisy (or Marketo is missing win dates) to chart. */
const MIN_TRACED_WINS = 60;

const shortMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const priorYear = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
const chg = (cur: number, prev: number) => (prev > 0 ? `${cur >= prev ? '+' : ''}${((100 * (cur - prev)) / prev).toFixed(0)}%` : '—');

type MonthRow = { month: string; spend: number; wins: number; paidWins: number };

function buildMonths(yoy: SalesYoYData): MonthRow[] {
  const matureEnd = Date.parse(`${yoy.mature_through}T00:00:00Z`);
  const spend = new Map(yoy.spend.map((s) => [s.month, s.meta + s.google]));
  const months = [...new Set(yoy.monthly.map((r) => r.month))].sort().filter((m) => {
    const d = new Date(`${m}T00:00:00Z`);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) <= matureEnd;
  });
  return months.map((m) => {
    const rows = yoy.monthly.filter((r) => r.month === m);
    return {
      month: m,
      spend: spend.get(m) ?? 0,
      wins: rows.reduce((t, r) => t + r.won60, 0),
      paidWins: rows.reduce((t, r) => t + (r.traced60 ?? 0), 0),
    };
  });
}

function sum(rows: MonthRow[]) {
  return rows.reduce((t, r) => ({ spend: t.spend + r.spend, wins: t.wins + r.wins, paidWins: t.paidWins + r.paidWins }), { spend: 0, wins: 0, paidWins: 0 });
}

export default function PrepassCostPerWinPanel({ yoy }: { yoy: SalesYoYData | null }) {
  if (!yoy) return null;
  const months = buildMonths(yoy);
  if (months.length === 0) return null;

  const byMonth = new Map(months.map((m) => [m.month, m]));
  // Same calendar months in both years, up to the latest three that exist in both.
  const pairs = months.filter((m) => byMonth.has(priorYear(m.month))).slice(-3);
  const cur = sum(pairs);
  const prev = sum(pairs.map((m) => byMonth.get(priorYear(m.month))!));
  const labelOf = (rows: { month: string }[]) => (rows.length ? `${shortMonth(rows[0].month)} to ${shortMonth(rows[rows.length - 1].month)}` : '');

  const series = months.map((m) => ({
    label: shortMonth(m.month),
    floor: m.wins > 0 ? Math.round(m.spend / m.wins) : null,
    traced: m.paidWins >= MIN_TRACED_WINS ? Math.round(m.spend / m.paidWins) : null,
  }));

  const floorCur = cur.wins > 0 ? cur.spend / cur.wins : null;
  const floorPrev = prev.wins > 0 ? prev.spend / prev.wins : null;
  const tracedCur = cur.paidWins > 0 ? cur.spend / cur.paidWins : null;
  const tracedPrev = prev.paidWins > 0 ? prev.spend / prev.paidWins : null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">Ad spend per closed-won, as a range</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Most closed-won comes from enrollment, and enrollment cannot be traced back to an ad. So there are two honest numbers. The low one counts every win as if ads drove it. The high one counts only wins we can trace to an ad: paid-channel people, Meta lead forms, Google calls and enrollment tracking. The true cost sits between them, and better tracking moves the high number down.
      </p>

      {pairs.length > 0 && floorCur != null && tracedCur != null && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Same months, two years', labelOf(pairs.map((m) => ({ month: priorYear(m.month) }))), labelOf(pairs), 'Change'].map((h, i) => (
                  <th key={h} className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm tabular-nums text-gray-700">
              {[
                ['Meta and Google spend', prev.spend, cur.spend, true],
                ['All closed-won, every source', prev.wins, cur.wins, false],
                ['Wins traced to an ad', prev.paidWins, cur.paidWins, false],
              ].map(([label, a, b, money]) => (
                <tr key={label as string}>
                  <td className="px-3 py-2 font-medium text-gray-950">{label as string}</td>
                  <td className="px-3 py-2 text-right">{money ? fmtCurrency(a as number) : fmtNumber(a as number)}</td>
                  <td className="px-3 py-2 text-right">{money ? fmtCurrency(b as number) : fmtNumber(b as number)}</td>
                  <td className="px-3 py-2 text-right">{chg(b as number, a as number)}</td>
                </tr>
              ))}
              <tr className="bg-emerald-50/60">
                <td className="px-3 py-2 font-semibold text-emerald-900">Spend per win, every win counted (low end)</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-900">{floorPrev != null ? fmtCurrency(floorPrev) : '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-900">{fmtCurrency(floorCur)}</td>
                <td className="px-3 py-2 text-right text-emerald-900">{floorPrev != null ? chg(floorCur, floorPrev) : '—'}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-3 py-2 font-semibold text-gray-950">Spend per win, only traced wins (high end)</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-950">{tracedPrev != null ? fmtCurrency(tracedPrev) : '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-950">{fmtCurrency(tracedCur)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{tracedPrev != null ? chg(tracedCur, tracedPrev) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm leading-6 text-gray-700">
        {pairs.length > 0 && floorPrev != null && floorCur != null
          ? `Spend moved ${chg(cur.spend, prev.spend)} while all closed-won moved ${chg(cur.wins, prev.wins)}, so on this measure the cost per win is ${floorCur > floorPrev ? 'up' : 'down'} ${Math.abs(Math.round((100 * (floorCur - floorPrev)) / floorPrev))}% year over year. `
          : ''}
        The business is winning more customers. Whether ads deserve the credit cannot be proven until more of enrollment is tracked.
      </p>

      <div className="mt-4 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `$${v}`} />
            <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="floor" name="Every win counted (low end)" stroke="#0B4A31" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="traced" name="Only traced wins (high end)" stroke="#EB541E" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Each month is people created that month, with wins counted within 60 days, against Meta plus Google spend that month. The high-end line has gaps in months where Marketo holds too few closed-won dates for paid leads to be reliable.
      </p>
    </section>
  );
}
