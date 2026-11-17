'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { ConversionPathsData } from '@/services/prepass-sales-overview';

const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—');
const days = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(0));
const pretty = (s: string) => (s === 'unknown' ? 'Not reported' : s === '1-5' ? '1 to 5 vehicles' : s === '6-50' ? '6 to 50' : s === '51-100' ? '51 to 100' : s === '101-500' ? '101 to 500' : s === '500+' ? 'Over 500' : s);

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false, className }: { children: React.ReactNode; left?: boolean; strong?: boolean; className?: string }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700', className)}>{children}</td>;
}
function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full divide-y divide-gray-100">{children}</table></div>;
}
function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      {note && <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{note}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function PrepassConversionPathsPanel({ data }: { data: ConversionPathsData | null }) {
  if (!data || data.paths.length === 0) return null;

  const abmBands = ['101-500', '500+'];
  const abm = data.fleet.filter((f) => abmBands.includes(f.band)).reduce(
    (a, f) => ({ leads: a.leads + f.leads, mqls: a.mqls + f.mqls, sqls: a.sqls + f.sqls, wins60: a.wins60 + f.wins60, wins: a.wins + f.wins }),
    { leads: 0, mqls: 0, sqls: 0, wins60: 0, wins: 0 },
  );
  const order = ['Phone call', 'Self-enrollment', 'Everything else'];
  const paths = [...data.paths].sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">How people actually convert</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        Not by ad channel, but by what the person did: how they came in, how big their fleet is, and which pages and lists they came through. People created {data.window.start} to {data.window.end}. A win counts within 60 days of creation, except where noted.
      </p>

      <Block
        title="Phone call, self-enrollment, or everything else"
        note={`Phone means the person's number matches a caller on a tracked Google call, with the first call near or after they were created and before they became a customer. Phone tracking only exists from ${data.path_window_start}, so this view starts there, and only about 1 in 5 callers can be matched to a person. The sales team's own work cannot be split out here, because Marketo does not record who handled each person. It sits inside "Everything else".`}
      >
        <Wrap>
          <thead className="bg-gray-50"><tr><Th left>How they came in</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Win rate</Th><Th>Median days to win</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {paths.map((p) => (
              <tr key={p.path}>
                <Td left strong>{p.path}</Td><Td>{fmtNumber(p.leads)}</Td><Td>{fmtNumber(p.mqls)}</Td><Td>{fmtNumber(p.wins60)}</Td>
                <Td className={p.leads > 0 && p.wins60 / p.leads >= 0.15 ? 'font-semibold text-emerald-800' : undefined}>{pct(p.wins60, p.leads)}</Td><Td>{days(p.median_days)}</Td>
              </tr>
            ))}
          </tbody>
        </Wrap>
      </Block>

      <Block title="How people entered Marketo" note="The entry note Marketo keeps on each person. Imported lists bring most of the volume and the fewest customers. People created in the CRM without a web entry include online enrollment and anything entered by hand.">
        <Wrap>
          <thead className="bg-gray-50"><tr><Th left>Entry</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Win rate</Th><Th>Median days to win</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.entry.map((e) => (
              <tr key={e.entry}><Td left strong>{e.entry}</Td><Td>{fmtNumber(e.leads)}</Td><Td>{fmtNumber(e.mqls)}</Td><Td>{fmtNumber(e.wins60)}</Td><Td>{pct(e.wins60, e.leads)}</Td><Td>{days(e.median_days)}</Td></tr>
            ))}
          </tbody>
        </Wrap>
      </Block>

      <Block
        title="Fleet size"
        note="Fleet size comes from the band Marketo records, or the vehicle count when no band is given. ABM focuses on fleets over 100 vehicles. Large fleets take much longer to close, so 'wins so far' (every win to date, not just the first 60 days) is shown beside the 60-day figure."
      >
        <Wrap>
          <thead className="bg-gray-50">
            <tr><Th left>Fleet size</Th><Th>People</Th><Th>MQL</Th><Th>SQL</Th><Th>Wins (60 days)</Th><Th>Wins so far</Th><Th>Win rate so far</Th><Th>Median days to win</Th><Th>From paid ads</Th><Th>From enrollment and organic</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.fleet.map((f) => {
              const isAbm = abmBands.includes(f.band);
              return (
                <tr key={f.band} className={isAbm ? 'bg-amber-50/50' : undefined}>
                  <Td left strong>{pretty(f.band)}{isAbm && <span className="ml-2 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">ABM</span>}</Td>
                  <Td>{fmtNumber(f.leads)}</Td><Td>{fmtNumber(f.mqls)}</Td><Td>{fmtNumber(f.sqls)}</Td><Td>{fmtNumber(f.wins60)}</Td><Td>{fmtNumber(f.wins)}</Td>
                  <Td>{pct(f.wins, f.leads)}</Td><Td>{days(f.median_days)}</Td><Td>{f.pct_paid}%</Td><Td>{f.pct_selfserve}%</Td>
                </tr>
              );
            })}
            <tr className="bg-gray-50">
              <Td left strong>ABM total, over 100 vehicles</Td><Td strong>{fmtNumber(abm.leads)}</Td><Td strong>{fmtNumber(abm.mqls)}</Td><Td strong>{fmtNumber(abm.sqls)}</Td>
              <Td strong>{fmtNumber(abm.wins60)}</Td><Td strong>{fmtNumber(abm.wins)}</Td><Td strong>{pct(abm.wins, abm.leads)}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td>
            </tr>
          </tbody>
        </Wrap>
      </Block>

      {data.pages.length > 0 && (
        <Block title="Landing pages that bring people in" note="Pages people first visited before they became a lead. The top pages by volume, with how many became customers.">
          <Wrap>
            <thead className="bg-gray-50"><tr><Th left>Page</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Win rate</Th><Th>Median days to win</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.pages.map((p) => (
                <tr key={p.page}><Td left strong className="max-w-[26rem] truncate">{p.page.trim() || '/'}</Td><Td>{fmtNumber(p.leads)}</Td><Td>{fmtNumber(p.mqls)}</Td><Td>{fmtNumber(p.wins60)}</Td><Td>{pct(p.wins60, p.leads)}</Td><Td>{days(p.median_days)}</Td></tr>
              ))}
            </tbody>
          </Wrap>
        </Block>
      )}

      {data.forms.length > 0 && (
        <Block title="Forms people completed" note="The last form each person filled out. Only a minority of people have one.">
          <Wrap>
            <thead className="bg-gray-50"><tr><Th left>Form</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Win rate</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.forms.map((f) => (
                <tr key={f.form}><Td left strong className="max-w-[26rem] truncate">{f.form}</Td><Td>{fmtNumber(f.leads)}</Td><Td>{fmtNumber(f.mqls)}</Td><Td>{fmtNumber(f.wins60)}</Td><Td>{pct(f.wins60, f.leads)}</Td></tr>
              ))}
            </tbody>
          </Wrap>
        </Block>
      )}

      {data.lists.length > 0 && (
        <Block title="Imported and targeted lists" note="The biggest lists loaded into Marketo, and how many of their people became customers. A list with very high volume and almost no wins is a lot of reach for little result.">
          <Wrap>
            <thead className="bg-gray-50"><tr><Th left>List</Th><Th>People</Th><Th>MQL</Th><Th>Wins (60 days)</Th><Th>Win rate</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.lists.map((l) => (
                <tr key={l.list}><Td left strong className="max-w-[26rem] truncate">{l.list}</Td><Td>{fmtNumber(l.leads)}</Td><Td>{fmtNumber(l.mqls)}</Td><Td>{fmtNumber(l.wins60)}</Td><Td>{pct(l.wins60, l.leads)}</Td></tr>
              ))}
            </tbody>
          </Wrap>
        </Block>
      )}
    </section>
  );
}
