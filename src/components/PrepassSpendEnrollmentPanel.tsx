'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, fmtCurrency, fmtNumber } from '@/lib/utils';
import type { EnrollmentTrackingData, SpendEnrollmentData } from '@/services/prepass-sales-overview';

const weekLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const r2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2));
const strength = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return '';
  const a = Math.abs(v);
  const word = a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'none';
  return word === 'none' ? 'no link' : `${v < 0 ? 'inverse, ' : ''}${word}`;
};

type Pair = { google: number | null; meta: number | null };

export default function PrepassSpendEnrollmentPanel({
  data,
  tracking,
}: {
  data: SpendEnrollmentData | null;
  tracking: EnrollmentTrackingData | null;
}) {
  if (!data || data.weeks < 20) return null;

  const bestOf = (key: 'google_enrollments' | 'meta_enrollments') =>
    data.lags.reduce<{ lag: number; v: number } | null>((best, l) => {
      const v = l[key];
      if (v == null) return best;
      return !best || v > best.v ? { lag: l.lag, v } : best;
    }, null);
  const lag0 = data.lags.find((l) => l.lag === 0);
  const bestG = bestOf('google_enrollments');
  const bestM = bestOf('meta_enrollments');

  const rows: { label: string; note: string; pair: Pair; extraG?: string; extraM?: string }[] = [
    { label: 'New enrollments, same week', note: 'Weekly spend against people created as Online Enrollment', pair: { google: lag0?.google_enrollments ?? null, meta: lag0?.meta_enrollments ?? null } },
    {
      label: 'New enrollments, best delay',
      note: 'Spend against enrollments 0 to 6 weeks later; the strongest delay is shown',
      pair: { google: bestG?.v ?? null, meta: bestM?.v ?? null },
      extraG: bestG ? ` (${bestG.lag} wk later)` : '',
      extraM: bestM ? ` (${bestM.lag} wk later)` : '',
    },
    { label: 'Enrollment and organic wins, same week', note: 'Weekly spend against closed-won from those sources', pair: { google: lag0?.google_wins ?? null, meta: lag0?.meta_wins ?? null } },
    { label: 'Week-to-week changes in wins', note: 'A tougher test: does a week with more spend than the week before also have more wins?', pair: { google: data.week_over_week.google_wins, meta: data.week_over_week.meta_wins } },
    { label: `Website visits from the platform against wins (${data.ga4.months} months)`, note: 'Google Paid Search plus Cross-network visits, and Meta Paid Social visits, in GA4', pair: { google: data.ga4.google_sessions_vs_wins, meta: data.ga4.meta_sessions_vs_wins } },
    { label: `Spend against the platform's own website visits (${data.ga4.months} months)`, note: 'Does more spend actually bring more visits to the website?', pair: { google: data.ga4.google_spend_vs_google_sessions, meta: data.ga4.meta_spend_vs_meta_sessions } },
  ];

  const series = data.weekly.map((w) => ({
    label: weekLabel(w.week),
    enrollments: w.enrollments,
    wins: w.selfserve_wins,
    google: w.google,
    meta: w.meta,
  }));

  const t = tracking?.weekly.reduce(
    (a, w) => ({ enrollments: a.enrollments + w.enrollments, capturedAttr: a.capturedAttr + w.captured_with_attribution, anyNow: a.anyNow + w.has_any_attribution_now, clickNow: a.clickNow + w.has_click_id_now }),
    { enrollments: 0, capturedAttr: 0, anyNow: 0, clickNow: 0 },
  );
  const traceable = t && t.enrollments > 0 ? (100 * Math.max(t.capturedAttr, t.anyNow)) / t.enrollments : null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">Does ad spend move with enrollment?</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Enrollment cannot be traced to an ad, so this looks at timing instead: when spend went up, did enrollment and wins go up too? {data.weeks} weeks from {data.window.start} to {data.window.end}. A correlation runs from 0 (no link) to 1 (move in lockstep). It shows a pattern. It does not prove cause.
      </p>

      <div className="mt-4 h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={44} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v, name) => (name === 'Google spend' || name === 'Meta spend' ? fmtCurrency(Number(v)) : fmtNumber(Number(v)))} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="enrollments" name="New enrollments" fill="#cbd5e1" />
            <Line yAxisId="left" type="monotone" dataKey="wins" name="Enrollment and organic wins" stroke="#0B4A31" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="google" name="Google spend" stroke="#EB541E" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="meta" name="Meta spend" stroke="#0f172a" strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['What is compared', 'Google', 'Meta'].map((h, i) => (
                <th key={h} className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm tabular-nums text-gray-700">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-3 py-2"><span className="font-medium text-gray-950">{r.label}</span><span className="block text-xs text-gray-500">{r.note}</span></td>
                <td className={cn('whitespace-nowrap px-3 py-2 text-right', (r.pair.google ?? 0) >= 0.4 && 'font-semibold text-emerald-800')}>{r2(r.pair.google)}{r.extraG}<span className="block text-xs font-normal text-gray-500">{strength(r.pair.google)}</span></td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{r2(r.pair.meta)}{r.extraM}<span className="block text-xs text-gray-500">{strength(r.pair.meta)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {traceable != null && t && (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-800">
          Only about <strong>{traceable.toFixed(0)}%</strong> of enrollments since the capture started carry a click ID or UTMs ({fmtNumber(t.clickNow)} hold a Google click ID in Marketo). The other {(100 - traceable).toFixed(0)}% have no ad data at all. So the lack of traced enrollments is a gap in tracking and says nothing about whether ads helped. The timing patterns above are the evidence we have.
        </p>
      )}

      <div className="mt-4 space-y-2 text-sm leading-6 text-gray-600">
        <p>
          <strong className="text-gray-950">What this supports:</strong> Google spend rises and falls with enrollments and wins far more than Meta does, and Google paid website visits track wins closely. Meta spend shows little or no link, which fits Meta running lead ads that do not send visitors to the enrollment site.
        </p>
        <p>
          <strong className="text-gray-950">What it does not show:</strong> that Google caused the increase, or by how much. Spend and enrollments both trended up, there is only one year of history to separate seasonality, and in March 2026 enrollment records about doubled for reasons not yet explained. Week-to-week swings link only weakly, which is why the steadier test is shown.
        </p>
        <p>
          <strong className="text-gray-950">What would settle it:</strong> pausing or cutting Google in a few regions and watching enrollments there, or tracing more of enrollment back to its ad.
        </p>
      </div>
    </section>
  );
}
