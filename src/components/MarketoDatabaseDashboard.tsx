import Link from 'next/link';
import type { MarketoDatabaseReport } from '@/services/prepass-marketo-database';
import { percentage, recommendations, SOURCE_FIELDS, type DatabaseFilters } from '@/services/prepass-marketo-database-math';

const count = (n: number | undefined) => n === undefined ? 'Unavailable' : n.toLocaleString('en-US');
const pct = (n: number, d: number) => {
  const p = percentage(n, d);
  return p === null ? 'Unavailable' : `${p.toFixed(1)}%`;
};
const days = (n: number | null | undefined) => n == null ? 'Unavailable' : `${n.toFixed(1)} days`;
const panel = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

function SourceBars({ title, note, rows, total }: {
  title: string; note: string; rows?: { label: string; people: number }[]; total: number;
}) {
  return <section className={panel}>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mb-4 mt-1 text-sm text-gray-500">{note} Denominator: all {count(total)} filtered cohort people, including Unknown.</p>
    <div className="max-h-96 space-y-3 overflow-y-auto">
      {rows?.map(s => <div key={s.label}>
        <div className="mb-1 flex justify-between gap-3 text-sm">
          <span className="break-all">{s.label}</span><span className="shrink-0">{count(s.people)} · {pct(s.people,total)}</span>
        </div>
        <div className="h-3 rounded bg-gray-100"><div className={`h-3 rounded ${s.label === 'Unknown' ? 'bg-amber-500' : 'bg-brand-forest'}`} style={{ width: `${percentage(s.people,total) || 0}%` }} /></div>
      </div>)}
      {!rows?.length && <p className="text-sm text-gray-500">No cohort people.</p>}
    </div>
  </section>;
}

export default function MarketoDatabaseDashboard({ report: r, filters: f }: {
  report: MarketoDatabaseReport; filters: DatabaseFilters;
}) {
  const c = r.cohort;
  const sourceLabel = SOURCE_FIELDS[f.sourceField];
  const freshnessHours = r.freshness_hours ?? null;
  return <div className="space-y-6 text-gray-900">
    <header>
      <p className="text-sm font-semibold text-brand-forest">PrePass · Full Marketo person database</p>
      <h1 className="mt-1 text-3xl font-bold">Marketo database</h1>
      <p className="mt-2 max-w-4xl text-sm text-gray-600">Where people come from, how they progress, and where to investigate conversion and speed. Unique people and lifetime lifecycle milestones from the verified full snapshot, separate from paid attribution and call matching.</p>
    </header>
    {!r.available || !c || !r.lifetime ? <section className={`${panel} border-amber-300`} role="status">
      <h2 className="font-semibold">Marketo database unavailable</h2>
      <p className="mt-2 text-sm">{r.reason || 'No verified full snapshot is available.'}</p>
      <p className="mt-2 text-sm text-gray-500">Unavailable is not zero. No partial or restricted population is substituted.</p>
    </section> : <>
      <section className={panel}>
        <p className="text-sm">Snapshot completed: <strong>{r.completed_at}</strong> · {r.field_count == null ? 'Field count unavailable' : `${count(r.field_count)} accessible fields in receipt`}</p>
        <p className="mt-1 text-sm text-gray-500">{freshnessHours === null || !Number.isFinite(freshnessHours) ? 'Freshness unavailable' : `${freshnessHours.toFixed(1)} hours old`}. Aging is measured as of the snapshot date, in UTC. A successful older snapshot does not prove today&apos;s refresh succeeded.</p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Entire database · lifetime milestones</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {([['Unique people','people'],['Ever MQL · dateMQL','mql'],['Ever SQL · dateSQL','sql'],['Ever Closed Won · dateClosedWon','won']] as const).map(([label,key]) => <div key={key} className={panel}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{key === 'people' || r.fields?.[key] ? count(r.lifetime![key]) : 'Unavailable'}</p>
            <p className="mt-1 text-xs text-gray-500">Not affected by the filters below. People, not unique companies or deals.</p>
          </div>)}
        </div>
      </section>
      <form action="/dashboard/marketo" className={`${panel} flex flex-wrap items-end gap-4`}>
        <label className="text-sm">Lead-created cohort from<input aria-label="Cohort start" type="date" name="start" defaultValue={f.start || ''} className="mt-1 block rounded-lg border border-gray-300 p-2" /></label>
        <label className="text-sm">Through (inclusive)<input aria-label="Cohort end" type="date" name="end" defaultValue={f.end || ''} className="mt-1 block rounded-lg border border-gray-300 p-2" /></label>
        <label className="text-sm">Source field<select name="sourceField" defaultValue={f.sourceField} className="mt-1 block rounded-lg border border-gray-300 p-2">
          {Object.entries(SOURCE_FIELDS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {([['source',`${sourceLabel} value`,r.source_options],['segment','Fleet segment (raw field)',r.segment_options]] as const).map(([key,label,options]) => <label key={key} className="text-sm">{label}
          <select name={key} defaultValue={f[key] || ''} className="mt-1 block max-w-64 rounded-lg border border-gray-300 p-2"><option value="">All</option>{options?.map(o => <option key={o} value={o}>{o}</option>)}</select>
        </label>)}
        <button className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white">Apply cohort</button>
        <Link className="text-sm underline" href="/dashboard/marketo">Reset</Link>
        <p className="w-full text-xs text-gray-500">When changing the source field, choose All for the source value first. Field values are not merged or automatically attributed to paid channels.</p>
      </form>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Acquisition cohort · {count(c.people)} unique people</h2>
        <p className="mt-1 text-sm text-gray-500">{f.start || 'All dates'} to {f.end || 'latest'} · {sourceLabel}: {f.source || 'All'} · {f.segment || 'All raw fleet segments'}. Dates filter createdAt, not MQL, SQL, or Won dates. Milestones may occur outside the acquisition window. Missing createdAt is retained without date bounds and excluded with either bound ({count(r.missing_acquisition_dates)} in the full database). SMB/ABM labels appear only if supplied by pp_fleetsizesegment.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">{(['mql','sql','won'] as const).map(k => <div key={k}>
          <p className="font-semibold">Ever {k === 'won' ? 'Closed Won' : k.toUpperCase()}</p>
          <p className="text-2xl">{r.fields?.[k] ? count(c[k]) : 'Unavailable'}</p>
          <p className="text-sm text-gray-500">{r.fields?.[k] ? `${pct(c[k],c.people)} of all cohort people` : 'Field not in snapshot receipt'}</p>
        </div>)}</div>
        <p className="mt-4 border-t border-gray-100 pt-4 text-sm">Cohort conversion, requiring both milestones: MQL → SQL {r.fields?.mql && r.fields?.sql ? `${pct(c.mql_sql,c.mql)} (${count(c.mql_sql)} / ${count(c.mql)})` : 'Unavailable'} · SQL → Won {r.fields?.sql && r.fields?.won ? `${pct(c.sql_won,c.sql)} (${count(c.sql_won)} / ${count(c.sql)})` : 'Unavailable'}. Counts are independent ever-reached milestones, not forced into a descending funnel. Young cohorts have had less time to close; compare cohorts of similar maturity.</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <SourceBars title={sourceLabel} note={`Raw ${f.sourceField} only, with no fallback. Marketo lead source may be edited over time; original UTMs and original source type are separate choices.`} rows={r.sources} total={c.people} />
        <SourceBars title="Latest-touch source" note="utmsource only. This is not original acquisition or paid attribution." rows={r.latest_sources} total={c.people} />
      </div>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Source quality and closing speed · {sourceLabel}</h2>
        <p className="my-2 text-sm text-gray-500">All rates below use people from that source as the denominator. Compare sources at similar cohort maturity and fleet mix, not volume alone. Small samples are not reliable rankings.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-gray-200">
          {['Source','People','MQL / people','SQL / people','Won / people','Median lead → Won'].map(label => <th key={label} className="px-2 py-3 font-semibold">{label}</th>)}
        </tr></thead><tbody>{r.sources?.map(s => <tr key={s.label} className="border-b border-gray-100">
          <td className="px-2 py-3">{s.label}</td><td className="px-2 py-3">{count(s.people)}</td>
          {(['mql','sql','won'] as const).map(k => <td key={k} className="px-2 py-3">{r.fields?.[k] ? `${count(s[k])} · ${pct(s[k],s.people)}` : 'Unavailable'}</td>)}
          <td className="px-2 py-3">{days(s.median_won_days)} · valid pairs n={count(s.won_pairs)}</td>
        </tr>)}</tbody></table></div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-semibold">Median lifecycle time</h2>
          <p className="my-2 text-sm text-gray-500">Calendar days. Ordered date pairs ending no later than the snapshot only. Pair denominators vary; missing and reversed dates are excluded. These are observed intervals, not causal effects.</p>
          {r.velocity?.map(v => <div key={v.label} className="flex justify-between gap-3 border-t border-gray-100 py-3 text-sm"><span>{v.label}</span><span>{days(v.median_days)} · valid pairs n={count(v.n)}</span></div>)}
        </section>
        <section className={panel}>
          <h2 className="text-lg font-semibold">Open-stage aging</h2>
          <p className="my-2 text-sm text-gray-500">Proxy: highest dated milestone among people without Won or Closed Lost dates. Not a definitive current CRM status. Days since stage date as of snapshot; missing/future dates excluded from median. Over 90 days is descriptive, not an SLA.</p>
          {r.aging?.map(a => <div key={a.stage} className="border-t border-gray-100 py-3 text-sm"><strong>{a.stage} · {count(a.people)} people</strong><p>{days(a.median_days)} median · valid dates n={count(a.valid_dates)} · {count(a.over_90_days)} over 90 days</p></div>)}
        </section>
      </div>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Conversion and acceleration opportunities</h2>
        <p className="mt-2 text-sm text-gray-600">Present parsed dates / all cohort people: Lead {count(c.lead_dates)}/{count(c.people)} · MQL {count(c.mql_dates)}/{count(c.people)} · SQL {count(c.sql_dates)}/{count(c.people)} · Won {count(c.won_dates)}/{count(c.people)}. Blank milestone dates can mean not reached, not necessarily bad data. Actions are diagnostic priorities, not proven causes or predicted uplift.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          {recommendations({ people:c.people, unknownSource:c.unknown_source, missingLeadDate:c.missing_lead_date, invalidTransitions:c.invalid_transitions, mql:r.fields?.mql && r.fields?.sql ? c.mql : undefined, mqlSql:c.mql_sql, sql:r.fields?.sql && r.fields?.won ? c.sql : undefined, sqlWon:c.sql_won }).map(s => <li key={s}>{s}</li>)}
          {r.aging?.filter(a => a.over_90_days>0).map(a => <li key={a.stage}>Review the {count(a.over_90_days)} dated {a.stage} people over 90 days using authorized CRM workflows; verify current status and follow-up ownership before action.</li>)}
        </ul>
      </section>
    </>}
  </div>;
}
