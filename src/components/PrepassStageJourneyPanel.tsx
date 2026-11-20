import { cn, fmtNumber } from '@/lib/utils';
import type { StageJourneyData, StageJourneyRow } from '@/services/prepass-sales-overview';

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—');

const SOURCE_ORDER = ['Paid ads', 'Online enrollment', 'Organic and inbound', 'Referral and partner', 'Events and sales outbound', 'Other'];

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700')}>{children}</td>;
}

function TouchBar({ row }: { row: StageJourneyRow }) {
  const total = row.zero + row.one_two + row.three_plus;
  if (total === 0) return null;
  const seg = (n: number, cls: string, label: string) => (
    <div className={cn('flex h-9 items-center justify-center text-xs font-semibold text-white', cls)} style={{ width: `${(100 * n) / total}%` }} title={`${label}: ${fmtNumber(n)}`}>
      {n / total >= 0.08 ? `${Math.round((100 * n) / total)}%` : ''}
    </div>
  );
  return (
    <div>
      <div className="flex overflow-hidden rounded-lg">
        {seg(row.zero, 'bg-rose-600', 'No nurture email')}
        {seg(row.one_two, 'bg-amber-500', '1 to 2 emails')}
        {seg(row.three_plus, 'bg-emerald-700', '3 or more emails')}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-600 align-middle" />None: {fmtNumber(row.zero)}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500 align-middle" />1 to 2 emails: {fmtNumber(row.one_two)}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-700 align-middle" />3 or more: {fmtNumber(row.three_plus)}</span>
      </div>
    </div>
  );
}

function StepCard({ title, subtitle, row, next }: { title: string; subtitle: string; row: StageJourneyRow; next: string }) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{subtitle}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-[11px] text-gray-500">Entered</dt><dd className="text-lg font-semibold text-gray-950">{fmtNumber(row.people)}</dd></div>
        <div><dt className="text-[11px] text-gray-500">Reached {next}</dt><dd className="text-lg font-semibold text-gray-950">{pct(row.advanced, row.people)}</dd></div>
        <div><dt className="text-[11px] text-gray-500">Needed follow-up</dt><dd className="text-lg font-semibold text-rose-700">{pct(row.needs, row.people)}</dd></div>
      </dl>
    </article>
  );
}

export default function PrepassStageJourneyPanel({ data }: { data: StageJourneyData | null }) {
  if (!data || !data.available || !data.rows || !data.window) return null;
  const all = (stage: string) => data.rows!.find((r) => r.stage === stage && r.grp === 'All');
  const lead = all('lead');
  const mql = all('mql');
  const sql = all('sql');
  if (!lead || !mql || !sql) return null;

  const mqlBySource = SOURCE_ORDER.map((g) => data.rows!.find((r) => r.stage === 'mql' && r.grp === g)).filter((r): r is StageJourneyRow => !!r && r.needs >= 20);

  const lowN = mql.zero + mql.one_two;
  const lowAdv = mql.advanced_low;
  const hiAdv = mql.advanced_three_plus;
  const sqlLowN = sql.zero + sql.one_two;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">The journey: what happens between stages</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        However someone comes in, the same thing should happen at each stage. This shows what does happen, for people who entered each stage {data.window.start} to {data.window.end}.
        People who moved on by themselves within a day (mostly online sign-ups) are set aside, so the picture below is about the people who needed follow-up.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <StepCard title="Lead to MQL" subtitle="Everyone who signed up in the period" row={lead} next="MQL" />
        <StepCard title="MQL to SQL" subtitle="People who became MQL (at least 7 days ago)" row={mql} next="SQL" />
        <StepCard title="SQL to closed-won" subtitle="People who became SQL (at least 7 days ago)" row={sql} next="won" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">MQLs who needed follow-up: nurture emails in their first week</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{fmtNumber(mql.needs)} people. Different nurture emails received in the 7 days after becoming MQL. The target is a six-email sequence.</p>
          <div className="mt-3"><TouchBar row={mql} /></div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-950">SQLs who needed follow-up: nurture emails in their first week</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{fmtNumber(sql.needs)} people. Different nurture emails in the 7 days after becoming SQL.</p>
          <div className="mt-3"><TouchBar row={sql} /></div>
        </div>
      </div>

      {mqlBySource.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-950">MQL to SQL by source, for people who needed follow-up</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Source</Th><Th>Needed follow-up</Th><Th>No nurture email</Th><Th>3 or more emails</Th><Th>Reached SQL later</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {mqlBySource.map((r) => (
                  <tr key={r.grp}>
                    <Td left strong>{r.grp}</Td><Td>{fmtNumber(r.needs)}</Td><Td>{pct(r.zero, r.needs)}</Td><Td>{pct(r.three_plus, r.needs)}</Td><Td>{pct(r.needs_advanced, r.needs)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-950">Playbook against reality</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr><Th left>Touch</Th><Th left>Target for MQL to SQL</Th><Th left>What the data shows</Th></tr></thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              <tr><Td left strong>Automated email sequence</Td><Td left>6 emails over the first 2 weeks</Td><Td left>{pct(mql.three_plus, mql.needs)} got 3 or more different nurture emails in week one; {pct(mql.zero, mql.needs)} got none.</Td></tr>
              <tr><Td left strong>Rep emails</Td><Td left>3 to 4</Td><Td left><span className="font-semibold text-rose-700">Not tracked.</span> Marketo holds no rep email records.</Td></tr>
              <tr><Td left strong>Rep calls</Td><Td left>4 to 5 attempts</Td><Td left><span className="font-semibold text-rose-700">Not tracked.</span> Marketo holds no call records.</Td></tr>
              <tr><Td left strong>Ads</Td><Td left>Retargeting while in stage</Td><Td left>Cannot be counted per person. Track as a retargeting audience instead.</Td></tr>
              <tr><Td left strong>Channels per person</Td><Td left>2 to 4</Td><Td left>1 measurable (automated email). The other channels are invisible.</Td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">
          The target for SQL to closed-won is still to be defined with PrePass. A draft: same-day rep call and recap email, a pricing and proof email in days 1 to 7, a short getting-started sequence through day 30, and a recorded reason if no decision by then.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">The biggest gap may be the one we cannot see.</p>
        <p className="mt-1">
          Reps call and email from their own phones and inboxes, and none of it reaches Marketo, so the number of times a lead is contacted cannot be measured today.
          Marketo does sync with Microsoft Dynamics, so if reps log calls and emails there, that is where the rest of the journey lives.
          Connecting rep activity is what would let this page prove or disprove the 10 to 15 touches idea.
        </p>
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-5 text-gray-500">
        Does more email help? Mixed so far, and the groups are small. Among MQLs who needed follow-up, {pct(hiAdv, mql.three_plus)} of those with 3 or more emails reached SQL later, against {pct(lowAdv, lowN)} of those with fewer.
        Among SQLs it points the other way ({pct(sql.advanced_three_plus, sql.three_plus)} against {pct(sql.advanced_low, sqlLowN)}), likely because emails go to stalled deals. Only a deliberate test, with a held-back group, can settle it.
        Email history starts {data.window.history_from}.
      </p>
    </section>
  );
}
