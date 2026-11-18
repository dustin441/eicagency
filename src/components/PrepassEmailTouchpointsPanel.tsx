'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { EmailTouchData } from '@/services/prepass-sales-overview';

const pct = (n: number, d: number, digits = 1) => (d > 0 ? `${((100 * n) / d).toFixed(digits)}%` : '—');

const FAMILY_LABEL: Record<string, string> = {
  blast: 'One-off blasts (newsletters, announcements)',
  nurture: 'Nurture and engagement programs',
  other: 'Other',
};

const CHANNEL_LABEL: Record<string, string> = {
  online_enrollment: 'Online enrollment',
  organic_inbound: 'Organic / inbound',
  event: 'Events',
  sales_outbound: 'Sales outbound',
  referral_partner: 'Referral / partner',
  paid_social: 'Paid social',
  paid_search: 'Paid search',
  paid_other: 'Other paid',
  unattributed: 'Unattributed (mostly existing customers)',
  other: 'Other',
};

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700')}>{children}</td>;
}

export default function PrepassEmailTouchpointsPanel({ data }: { data: EmailTouchData | null }) {
  if (!data || !data.available || !data.window || !data.families || !data.first_touch) return null;
  const gaps = (data.gaps_by_channel ?? []).filter((g) => g.channel !== 'unattributed' && g.mqls_no_nurture > 0);
  const mqlsNoNurture = gaps.reduce((a, g) => a + g.mqls_no_nurture, 0);
  const ft = data.first_touch;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">Email and nurture: what people actually receive</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Every email Marketo sent to people who signed up {data.window.start} to {data.window.end}, grouped by the program it came from. Email history is still loading, so this window starts {data.window.history_from} and will grow back over the coming days.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{pct(ft.people_with_nurture, ft.people, 0)}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">of {fmtNumber(ft.people)} new people received any nurture or engagement email</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{fmtNumber(mqlsNoNurture)}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">MQLs (sales-ready leads) not yet customers who received no nurture email, excluding existing customers</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{ft.median_hours_to_first_nurture == null ? '—' : `${ft.median_hours_to_first_nurture}h`}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">typical time from sign-up to the first nurture email, for the people who got one</div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50"><tr><Th left>Type of email</Th><Th>Sent</Th><Th>People</Th><Th>Click rate</Th><Th>Unsubscribe rate</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.families.map((f) => (
              <tr key={f.fam}>
                <Td left strong>{FAMILY_LABEL[f.fam] ?? f.fam}</Td><Td>{fmtNumber(f.sends)}</Td><Td>{fmtNumber(f.people)}</Td>
                <Td>{pct(f.clicks, f.sends)}</Td><Td>{pct(f.unsubs, f.sends, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">Clicks are shown instead of opens because mail privacy features inflate opens. Blasts go to the whole customer base; nurture programs are the only emails aimed at moving a specific person forward.</p>

      {data.programs && data.programs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-950">The nurture programs that exist today</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Program</Th><Th>Sent</Th><Th>People reached</Th><Th>Click rate</Th><Th>Unsubscribes</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.programs.map((p) => (
                  <tr key={p.program}>
                    <Td left strong>{p.program}</Td><Td>{fmtNumber(p.sends)}</Td><Td>{fmtNumber(p.people)}</Td>
                    <Td>{pct(p.clicks, p.sends)}</Td><Td>{fmtNumber(p.unsubs)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-950">Where the follow-up gap is</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">
            People who became MQLs, are not customers yet, and received no nurture email. Sales may be working some of them by phone; this shows who has no email follow-up at all.
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Where they came from</Th><Th>New people</Th><Th>MQLs with no nurture email</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {gaps.map((g) => (
                  <tr key={g.channel}><Td left strong>{CHANNEL_LABEL[g.channel] ?? g.channel}</Td><Td>{fmtNumber(g.people)}</Td><Td>{fmtNumber(g.mqls_no_nurture)}</Td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs leading-5 text-gray-500">
        What this cannot show yet: whether nurture makes people convert faster. People who get nurture emails are the ones who did not convert right away, so comparing them to everyone else looks backwards. The clean way to find out is a test: hold back a small random group from a new nurture sequence and compare.
      </p>
    </section>
  );
}
