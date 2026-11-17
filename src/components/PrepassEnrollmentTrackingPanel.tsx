'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, fmtNumber } from '@/lib/utils';
import type { EnrollmentTrackingData } from '@/services/prepass-sales-overview';

const OUTCOME_LABELS: Record<string, string> = {
  identity_only_no_captured_fields: 'Matched a person, but the capture held no click ID or UTMs',
  canonical_attribution_readback_verified: 'Attribution written to Marketo and verified',
  multiple_canonical_people: 'Blocked: several Marketo people share the email or phone',
  attribution_history_review_required: 'Blocked: Marketo already holds different attribution',
  marketo_not_ready: 'Expired: the person never appeared in Marketo in time',
};

const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(0)}%` : '—');
const weekLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function PrepassEnrollmentTrackingPanel({ tracking }: { tracking: EnrollmentTrackingData | null }) {
  if (!tracking || tracking.weekly.length === 0) return null;
  const t = tracking.weekly.reduce(
    (a, w) => ({
      enrollments: a.enrollments + w.enrollments,
      captured: a.captured + w.captured,
      capturedAttr: a.capturedAttr + w.captured_with_attribution,
      clickNow: a.clickNow + w.has_click_id_now,
      anyNow: a.anyNow + w.has_any_attribution_now,
    }),
    { enrollments: 0, captured: 0, capturedAttr: 0, clickNow: 0, anyNow: 0 },
  );
  const series = tracking.weekly.map((w) => ({
    label: weekLabel(w.week),
    enrollments: w.enrollments,
    captured: w.captured,
    withAttribution: w.captured_with_attribution,
  }));
  const outcomeTotal = tracking.outcomes.reduce((s, o) => s + o.n, 0);

  const tiles = [
    { label: 'Enrollments', value: fmtNumber(t.enrollments), note: 'People created as Online Enrollment' },
    { label: 'Reached by the capture', value: pct(t.captured, t.enrollments), note: `${fmtNumber(t.captured)} have a capture record` },
    { label: 'Captured with a click ID or UTMs', value: pct(t.capturedAttr, t.enrollments), note: `${fmtNumber(t.capturedAttr)} enrollments carry ad data` },
    { label: 'Hold a Google click ID in Marketo', value: pct(t.clickNow, t.enrollments), note: `${fmtNumber(t.clickNow)} records` },
  ];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">How much of enrollment can be tracked</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Enrollment people reach Marketo through the Microsoft Dynamics sync with no web source. A cookie captures the click ID and UTMs when someone starts enrolling, and a daily match writes them to the Marketo record. This shows how far that reaches. The capture went live {tracking.capture_start}, so this panel starts there. As tracking improves, these percentages are the ones that should rise.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{x.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{x.value}</p>
            <p className="mt-1 text-xs text-gray-500">{x.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-gray-700">
        Only {pct(t.capturedAttr, t.enrollments)} of enrollments carry any ad data. The rest cannot be tied to the campaign that sent the visitor, so they show up as untracked enrollment even when Google or Meta drove the visit.
      </p>

      <div className="mt-4 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={44} />
            <Tooltip formatter={(v) => fmtNumber(Number(v))} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="enrollments" name="Enrollments (week created)" fill="#cbd5e1" />
            <Line type="monotone" dataKey="captured" name="Reached by the capture" stroke="#0B4A31" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="withAttribution" name="Captured with click ID or UTMs" stroke="#EB541E" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-gray-950">What happened to each capture</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Outcome', 'Captures', 'Share', 'With click ID', 'With any ad data'].map((h, i) => (
                <th key={h} className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm tabular-nums text-gray-700">
            {tracking.outcomes.map((o) => (
              <tr key={`${o.status}-${o.code}`}>
                <td className="px-3 py-2 font-medium text-gray-950">{OUTCOME_LABELS[o.code] ?? `${o.status}${o.code ? `: ${o.code}` : ''}`}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(o.n)}</td>
                <td className="px-3 py-2 text-right">{pct(o.n, outcomeTotal)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(o.with_click_id)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(o.with_attribution)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        Captures come only from the new enrollment site. The Start now link on the main site also leads to an older enrollment page that the capture does not cover, so part of enrollment is never captured. Counts come from the capture queue and the Marketo mirror, and the Marketo side lags the live record by up to a day.
      </p>
    </section>
  );
}
