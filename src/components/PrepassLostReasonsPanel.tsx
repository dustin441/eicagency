'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { OppPipelineData } from '@/services/prepass-sales-overview';

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—');

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700')}>{children}</td>;
}

export default function PrepassLostReasonsPanel({ data }: { data: OppPipelineData | null }) {
  if (!data || data.lost_reasons.length === 0) return null;
  const lost = data.paths.reduce((a, p) => a + p.lost, 0);
  const won = data.paths.reduce((a, p) => a + p.won, 0);
  const total = data.people_with_opportunity;
  const types = data.types.filter((t) => t.people >= 20);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">Why opportunities are lost</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Of {fmtNumber(total)} people with an opportunity (people created {data.window.start} to {data.window.end}), {fmtNumber(won)} were won ({pct(won, total)}) and {fmtNumber(lost)} were lost ({pct(lost, total)}).
        This is where speed and follow-up can still change the result.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50"><tr><Th left>Reason recorded when lost</Th><Th>People</Th><Th>Share of lost</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.lost_reasons.map((r) => (
              <tr key={r.reason}><Td left strong>{r.reason}</Td><Td>{fmtNumber(r.people)}</Td><Td>{pct(r.people, lost)}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {types.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-950">Opportunity type</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">Net New Business is the real acquisition work. Upgrades and reactivations are existing customers. About half of opportunities have no type set.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Type</Th><Th>People</Th><Th>Won</Th><Th>Lost</Th><Th>Still open</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {types.map((t) => (
                  <tr key={t.type}><Td left strong>{t.type}</Td><Td>{fmtNumber(t.people)}</Td><Td>{fmtNumber(t.won)}</Td><Td>{fmtNumber(t.lost)}</Td><Td>{fmtNumber(t.open)}</Td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs leading-5 text-gray-500">
        What this cannot show: how long deals sit in each stage. Marketo records the stages (Discovery, Forecasted Sale, Close) almost all at once when the deal is created, with a median of {data.stage_days.discovery_to_forecast ?? 0} days between them, so stage timing reflects the system, not sales effort.
        Opportunity data starts {data.window.start}.
      </p>
    </section>
  );
}
