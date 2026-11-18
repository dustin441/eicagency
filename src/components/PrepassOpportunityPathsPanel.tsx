'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { OpportunityPathsData } from '@/services/prepass-sales-overview';

const CHANNELS: Record<string, string> = {
  paid_social: 'Paid social', paid_search: 'Paid search', paid_other: 'Paid, other', event: 'Events', referral_partner: 'Referral and partner',
  sales_outbound: 'Sales outbound', online_enrollment: 'Online enrollment', organic_inbound: 'Organic and inbound', unattributed: 'Unattributed', other: 'Other',
};
const TIMING: Record<string, string> = {
  '0 none': 'No opportunity',
  '1 within a day': 'Opportunity within a day of sign-up',
  '2 one to 14 days': 'Opportunity 1 to 14 days after sign-up',
  '3 over 14 days': 'Opportunity more than 14 days after sign-up',
};
const GROUPS: Record<string, string> = {
  meeting: 'A rep booked or set a meeting',
  proposal: 'LTA or proposal',
  expansion: 'Upgrade, reactivation or adoption (already a customer)',
  product: 'Product deal record (Tolls Only, PrePass Plus)',
  enroll: 'Enrollment record',
  other: 'Other names (mostly company names)',
  none: 'No opportunity',
};
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—');
const days = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(1));

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700')}>{children}</td>;
}
function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      {note && <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{note}</p>}
      <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full divide-y divide-gray-100">{children}</table></div>
    </div>
  );
}

export default function PrepassOpportunityPathsPanel({ data }: { data: OpportunityPathsData | null }) {
  if (!data || data.timing.length === 0) return null;
  const totalWins = data.timing.reduce((a, t) => a + t.wins60, 0);
  const groups = [...data.groups].filter((g) => g.wins60 > 0 || g.people >= 100).sort((a, b) => b.wins60 - a.wins60);
  const speed = data.speed_by_channel.filter((r) => r.wins60 >= 20);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">How wins happen: fast sign-ups or a longer sales cycle</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Marketo does not record which person worked a lead, so this uses what it does record: when an opportunity appeared and how long the win took. People created {data.window.start} to {data.window.end}, wins counted within 60 days.
        An opportunity record partly exists because a sale is happening, so read the share of wins in each row, not the win rate.
      </p>

      <Block title="When the opportunity appeared" note="Opportunities that appear within days of sign-up look like online enrollment. The ones that appear weeks later, followed by a slow win, look like a sales cycle.">
        <thead className="bg-gray-50"><tr><Th left>When</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Share of wins</Th><Th>Median days to win</Th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.timing.map((t) => (
            <tr key={t.grp}>
              <Td left strong>{TIMING[t.grp] ?? t.grp}</Td><Td>{fmtNumber(t.people)}</Td><Td>{fmtNumber(t.mqls)}</Td><Td>{fmtNumber(t.wins60)}</Td>
              <Td>{pct(t.wins60, totalWins)}</Td><Td>{days(t.median_days_to_win)}</Td>
            </tr>
          ))}
        </tbody>
      </Block>

      <Block title="How fast each source's wins closed" note="Share of each source's wins that closed within 7 days, 8 to 30 days, or 31 to 60 days of the person being created. Fast closes are mostly self-service. Slow closes are where a rep is usually involved.">
        <thead className="bg-gray-50"><tr><Th left>Source</Th><Th>Wins (60 days)</Th><Th>Within 7 days</Th><Th>8 to 30 days</Th><Th>31 to 60 days</Th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {speed.map((r) => (
            <tr key={r.channel}>
              <Td left strong>{CHANNELS[r.channel] ?? r.channel}</Td><Td>{fmtNumber(r.wins60)}</Td>
              <Td>{pct(r.d7, r.wins60)}</Td><Td>{pct(r.d30, r.wins60)}</Td><Td>{pct(r.d60, r.wins60)}</Td>
            </tr>
          ))}
        </tbody>
      </Block>

      <Block title="What the opportunity was named" note="The name is the only hint about who made the record. A rep booking a meeting is the clearest sales footprint, and it is rare. Most wins sit under company names or enrollment records that are created automatically.">
        <thead className="bg-gray-50"><tr><Th left>Opportunity name type</Th><Th>People</Th><Th>Wins (60 days)</Th><Th>Share of wins</Th><Th>Median days to win</Th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {groups.map((g) => (
            <tr key={g.grp}>
              <Td left strong>{GROUPS[g.grp] ?? g.grp}</Td><Td>{fmtNumber(g.people)}</Td><Td>{fmtNumber(g.wins60)}</Td>
              <Td>{pct(g.wins60, totalWins)}</Td><Td>{days(g.median_days_to_win)}</Td>
            </tr>
          ))}
        </tbody>
      </Block>
    </section>
  );
}
