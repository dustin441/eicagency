'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { CallCampaignsData } from '@/services/prepass-sales-overview';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—');

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700')}>{children}</td>;
}

export default function PrepassCallCampaignsPanel({ data }: { data: CallCampaignsData | null }) {
  if (!data || data.campaigns.length === 0) return null;
  const totalCalls = data.campaigns.reduce((a, c) => a + c.calls, 0);
  const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
  const maxCalls = Math.max(...data.monthly.map((m) => m.calls), 1);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">Phone calls from Google ads, by campaign</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Calls are one way Google ads drive sales that click-based reports miss. We match each caller to a person in Marketo by phone number, then count the people who became customers after their first call.
        Caller numbers are only recorded from {data.window.start}, so this view starts there. {fmtNumber(totalCalls)} calls in {data.window.start} to {data.window.end}.
      </p>

      <div className="mt-4 flex items-end gap-3" aria-label="Calls per month">
        {data.monthly.map((m) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums text-gray-700">{fmtNumber(m.calls)}</span>
            <div className="w-full max-w-16 rounded-t bg-brand-forest/80" style={{ height: `${Math.max(4, Math.round((m.calls / maxCalls) * 72))}px` }} />
            <span className="text-xs text-gray-500">{monthName(m.month)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <Th left>Campaign</Th><Th>Calls</Th><Th>Callers</Th><Th>Matched to a person</Th><Th>Customers after call</Th><Th>Google spend</Th><Th>Spend per call</Th><Th>Spend per matched customer</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.campaigns.map((c) => (
              <tr key={c.campaign}>
                <Td left strong>{c.campaign}</Td>
                <Td>{fmtNumber(c.calls)}</Td>
                <Td>{fmtNumber(c.callers)}</Td>
                <Td>{fmtNumber(c.matched_callers)} ({pct(c.matched_callers, c.callers)})</Td>
                <Td>{fmtNumber(c.wins_after)}</Td>
                <Td>{c.spend > 0 ? money(c.spend) : '—'}</Td>
                <Td>{c.spend > 0 && c.calls > 0 ? money(c.spend / c.calls) : '—'}</Td>
                <Td>{c.spend > 0 && c.wins_after > 0 ? money(c.spend / c.wins_after) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-xs leading-5 text-gray-500">
        <li>Customers after call is a floor. Only the callers we can match to a Marketo person can be counted, and that is a minority for the biggest campaigns. Raising the match rate is what would show the real cost.</li>
        <li>Brand search callers are often people who already know PrePass, and some are existing customers. Do not read their numbers as new demand.</li>
        <li>A call does not prove the ad caused the sale, only that the person called from the ad and later became a customer.</li>
      </ul>
    </section>
  );
}
