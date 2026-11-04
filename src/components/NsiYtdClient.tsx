'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3, FlaskConical, TrendingUp } from 'lucide-react';
import type { NsiYtdData } from '@/services/nsi-ytd';
import type { NsiChannelRow } from '@/services/nsi-analytics';

const money = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const cents = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const integer = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const conversionCount = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : `${(value * 100).toFixed(1)}%`;
const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const delta = (current: number | null, previous: number | null) => current === null || previous === null || previous <= 0 ? null : (current - previous) / previous;
function change(current: number | null, previous: number | null) {
  const value = delta(current, previous);
  return value === null ? 'YoY not available' : `${value > 0 ? '+' : ''}${percent(value)} YoY`;
}
const panel = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6';
const th = 'px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap';
const td = 'px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className={panel}><h2 className="text-lg font-extrabold tracking-tight text-brand-dark">{title}</h2>{subtitle && <p className="mt-1 mb-5 text-sm leading-relaxed text-gray-500">{subtitle}</p>}{children}</section>;
}
function Metric({ label, current, previous, format = integer, note }: { label: string; current: number | null; previous?: number | null; format?: (value: number | null) => string; note?: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-brand-dark tabular-nums">{format(current)}</p>{previous !== undefined && <><p className="mt-2 text-xs font-semibold text-gray-700">{change(current, previous)}</p><p className="mt-1 text-xs text-gray-500">2025: {format(previous)}</p></>}{note && <p className="mt-2 text-xs leading-relaxed text-gray-500">{note}</p>}</div>;
}
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className="mt-4 overflow-x-auto rounded-xl border border-gray-100 focus-visible:outline-2 focus-visible:outline-brand-forest">{children}</div>;
}

type ActivityRow = Omit<NsiChannelRow, 'channel'> & { label: string; suppressComparison?: boolean };
type ActivityMetric = { label: string; current: (row: ActivityRow) => number | null; previous?: (row: ActivityRow) => number | null; format: (value: number | null) => string };
const activityMetrics: ActivityMetric[] = [
  { label: 'Spend', current: r => r.cost, previous: r => r.prevCost, format: money },
  { label: 'Impressions', current: r => r.impressions, previous: r => r.prevImpressions, format: integer },
  { label: 'Clicks', current: r => r.clicks, previous: r => r.prevClicks, format: integer },
  { label: 'CTR', current: r => ratio(r.clicks, r.impressions), previous: r => ratio(r.prevClicks, r.prevImpressions), format: percent },
  { label: 'CPC', current: r => ratio(r.cost, r.clicks), previous: r => ratio(r.prevCost, r.prevClicks), format: cents },
  { label: 'Sessions', current: r => r.sessions, previous: r => r.prevSessions, format: integer },
  { label: 'Engaged sessions', current: r => r.engagedSessions, previous: r => r.prevEngagedSessions, format: integer },
  { label: 'Engagement rate', current: r => ratio(r.engagedSessions, r.sessions), previous: r => ratio(r.prevEngagedSessions, r.prevSessions), format: percent },
  { label: 'CPES', current: r => ratio(r.cost, r.engagedSessions), previous: r => ratio(r.prevCost, r.prevEngagedSessions), format: cents },
  { label: 'Product Submittals', current: r => r.productSubmittals, format: conversionCount },
  { label: 'HubSpot Form Fills', current: r => r.hubspotFormFills, format: conversionCount },
  { label: 'Meta Leads', current: r => r.metaLeads, format: integer },
  { label: 'Website conversion rate', current: r => ratio(r.websiteConversions, r.websiteClicks), format: percent },
  { label: 'Website cost / conversion', current: r => ratio(r.websiteCost, r.websiteConversions), format: cents },
  { label: 'Meta lead rate', current: r => ratio(r.metaLeads, r.metaClicks), format: percent },
  { label: 'Meta cost / lead', current: r => ratio(r.metaCost, r.metaLeads), format: cents },
];
function ActivityTable({ title, rows, open = false }: { title: string; rows: ActivityRow[]; open?: boolean }) {
  return <details open={open} className="rounded-xl border border-gray-100 bg-white">
    <summary className="cursor-pointer rounded-xl px-4 py-4 text-sm font-bold text-brand-dark focus-visible:outline-2 focus-visible:outline-brand-forest">{title} <span className="ml-2 font-normal text-gray-500">{rows.length} groups</span></summary>
    <div className="px-4 pb-4"><p className="text-xs text-gray-500">Each comparable cell shows 2026, then 2025 and YoY. Conversion measures are 2026 only. Sessions and CPES are campaign-attributed warehouse measures.</p>
      <ScrollTable label={`${title} performance, scroll horizontally for all metrics`}><table className="w-full border-collapse text-left"><caption className="sr-only">{title}: Jan-Oct 2026 vs Jan-Oct 2025. Conversion comparisons are intentionally omitted.</caption><thead className="bg-gray-50"><tr><th scope="col" className={`${th} text-left`}>Group</th>{activityMetrics.map(m => <th key={m.label} scope="col" className={th}>{m.label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row, index) => <tr key={`${row.label}-${index}`} className="hover:bg-gray-50/60"><th scope="row" className="min-w-48 px-4 py-3 text-sm font-semibold text-gray-700">{row.label || 'Unmapped'}{row.cost === 0 && row.prevCost > 0 && <span className="mt-1 block text-xs font-normal text-gray-500">Prior-year spend only</span>}{row.suppressComparison && <span className="mt-1 block text-xs font-normal text-gray-500">Comparison not like-for-like</span>}</th>{activityMetrics.map(m => <td key={m.label} className={td}><div className="font-semibold text-gray-800">{m.format(m.current(row))}</div>{m.previous && <div className="mt-1 text-[11px] text-gray-500">{row.suppressComparison ? <>{m.format(m.previous(row))}<br />Historical, not comparable</> : <>{m.format(m.previous(row))}<br />{change(m.current(row), m.previous(row))}</>}</div>}</td>)}</tr>)}{!rows.length && <tr><td colSpan={activityMetrics.length + 1} className="p-6 text-sm text-gray-500">No activity returned for this grouping.</td></tr>}</tbody></table></ScrollTable>
    </div>
  </details>;
}

export default function NsiYtdClient({ data }: { data: NsiYtdData }) {
  const [family, setFamily] = useState('all');
  const s = data.summary;
  const p = data.prevSummary;
  const b = data.conversionBreakout;
  const bpt = data.revenueFamilies.find(f => f.key.toUpperCase() === 'BPT');
  const pol = data.revenueFamilies.find(f => f.key.toUpperCase() === 'POL');
  const cmp = data.revenueFamilies.find(f => f.key.toUpperCase() === 'CMP');
  // Compression is already included in Polaris. Never sum every family row.
  const combined = bpt?.current != null && pol?.current != null ? bpt.current + pol.current : null;
  const previousCombined = bpt?.previous != null && pol?.previous != null ? bpt.previous + pol.previous : null;
  const revenueChange = delta(combined, previousCombined);
  const spendChange = delta(s.cost, p.cost);
  const contraFamilies = data.revenueFamilies.filter(f => {
    const revenueDelta = delta(f.current, f.previous);
    const spendDelta = delta(f.spend, f.previousSpend);
    return revenueDelta !== null && spendDelta !== null && revenueDelta * spendDelta < 0;
  });
  const shownFamilies = family === 'all' ? data.revenueFamilies : data.revenueFamilies.filter(f => f.key === family);
  const completeRevenue = bpt?.months === 10 && pol?.months === 10 && bpt?.previousMonths === 10 && pol?.previousMonths === 10;

  return <div className="space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-800">First draft · For review</span><span className="text-xs text-gray-500">As of {data.asOf.slice(0, 10)}</span></div><h1 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">NSI year-to-date review</h1><p className="mt-2 text-sm font-semibold text-gray-600">Jan-Oct 2026 vs Jan-Oct 2025</p><p className="mt-1 text-xs text-gray-500">January 1 - October 31, 2026 compared with January 1 - October 31, 2025</p></div>
      <Link href="/dashboard/nsi" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-gray-50">Main dashboard <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
    </header>
    <p className="text-xs leading-relaxed text-amber-800">Paid-media comparisons use the warehouse snapshot and remain provisional pending native-source reconciliation. Known ingestion and campaign-tagging exceptions are disclosed in the source notes below.</p>

    <section className="overflow-hidden rounded-2xl bg-brand-forest text-white shadow-sm" aria-labelledby="executive-title">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
        <div><p className="text-xs font-bold uppercase tracking-widest text-white/75">Revenue first</p><h2 id="executive-title" className="mt-3 text-lg font-bold">Combined Bridgeport + Polaris</h2><p className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{money(combined)}</p><p className="mt-3 font-semibold">{change(combined, previousCombined)}</p><p className="mt-1 text-sm text-white/75">Jan-Oct 2025: {money(previousCombined)}</p><p className="mt-4 text-xs leading-relaxed text-white/75">Reported business revenue, not ad-attributed revenue. CMP is a nested Polaris breakout, not incremental revenue.</p></div>
        <div className="space-y-4 lg:border-l lg:border-white/20 lg:pl-8"><p className="text-xs font-bold uppercase tracking-widest text-white/75">Executive readout</p>
          <p className="text-base font-semibold leading-relaxed">{revenueChange === null ? 'The revenue comparison needs a complete prior-year baseline.' : `Reported revenue ${revenueChange > 0 ? 'increased' : revenueChange < 0 ? 'decreased' : 'was unchanged'}${revenueChange === 0 ? '' : ` ${percent(Math.abs(revenueChange))}`} year over year.`} Media spend was {money(s.cost)} ({change(s.cost, p.cost)}).</p>
          <p className="text-sm leading-relaxed text-white/85">Revenue by business line: Bridgeport {change(bpt?.current ?? null, bpt?.previous ?? null)}, Polaris {change(pol?.current ?? null, pol?.previous ?? null)}. The Compression breakout within Polaris was {change(cmp?.current ?? null, cmp?.previous ?? null)}.</p>
          <p className="text-sm leading-relaxed text-white/85">Campaign-attributed engaged sessions totaled {integer(s.engagedSessions)} ({change(s.engagedSessions, p.engagedSessions)}), with CPES of {cents(ratio(s.cost, s.engagedSessions))} versus {cents(ratio(p.cost, p.engagedSessions))} in 2025.</p>
          <p className="text-sm leading-relaxed text-white/85">{contraFamilies.length ? `${contraFamilies.map(f => f.label).join(', ')} showed opposing spend and revenue directions. Review the family detail before drawing a budget conclusion.` : revenueChange !== null && spendChange !== null ? 'Compare revenue direction with media delivery and engagement, not spend in isolation.' : 'Review source coverage before drawing a budget conclusion.'} These are parallel trends, not evidence of causation.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-3">
      <article className={panel}><TrendingUp aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">What happened</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">{integer(s.impressions)} impressions and {integer(s.clicks)} clicks supported {integer(s.sessions)} campaign-attributed sessions. CPC was {cents(ratio(s.cost, s.clicks))}, compared with {cents(ratio(p.cost, p.clicks))} in 2025.</p></article>
      <article className={panel}><BarChart3 aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">What we learned</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">Engagement rate was {percent(ratio(s.engagedSessions, s.sessions))} versus {percent(ratio(p.engagedSessions, p.sessions))}. Use that traffic-quality signal alongside CPC and CPES. The {conversionCount(b.productSubmittals)} Product Submittals provide a 2026 tracking baseline, not a reliable YoY lift measure.</p></article>
      <article className="rounded-2xl border border-brand-forest/20 bg-brand-forest/5 p-5 sm:p-6"><FlaskConical aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">Proposed 2027 tests</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">Test AI-assisted creative production and a broader creative testing cadence. Explore connected TV and audio as controlled pilots with agreed audiences, budgets and success measures. These are proposals, not claims of activity already run.</p></article>
    </div>

    <Section title="Revenue and spend by family" subtitle="Same-period business revenue alongside paid-media investment. Directional comparison only, not attribution or a return calculation.">
      <label htmlFor="nsi-ytd-family" className="text-xs font-bold text-gray-600">Product family</label><select id="nsi-ytd-family" value={family} onChange={event => setFamily(event.target.value)} className="ml-3 max-w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-forest"><option value="all">All families</option>{data.revenueFamilies.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      <ScrollTable label="Revenue and media spend by product family"><table className="w-full"><caption className="sr-only">Jan-Oct 2026 vs Jan-Oct 2025 family revenue and spend</caption><thead className="bg-gray-50"><tr>{['Family', '2026 revenue', '2025 revenue', 'Revenue YoY', '2026 spend', '2025 spend', 'Spend YoY', 'Revenue coverage'].map((label, index) => <th scope="col" key={label} className={`${th} ${index === 0 ? 'text-left' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{shownFamilies.map(f => <tr key={f.key}><th scope="row" className={`min-w-52 px-4 py-4 text-left text-sm font-semibold text-brand-dark ${f.key.toUpperCase() === 'CMP' ? 'pl-9' : ''}`}>{f.label}{f.key.toUpperCase() === 'CMP' && <span className="mt-1 block text-xs font-normal text-gray-500">Within Polaris · nonadditive</span>}</th><td className={td}>{money(f.current)}</td><td className={td}>{money(f.previous)}</td><td className={td}>{change(f.current, f.previous)}</td><td className={td}>{money(f.spend)}</td><td className={td}>{money(f.previousSpend)}</td><td className={td}>{change(f.spend, f.previousSpend)}</td><td className={td}>{f.current === null && f.previous === null ? 'Not linked' : `${f.months}/10 vs ${f.previousMonths}/10 months`}</td></tr>)}</tbody></table></ScrollTable>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Bridgeport (BPT) + Polaris (POL) form the combined revenue headline. Compression (CMP) is included in Polaris and must not be added again. Contractor360 has no linked revenue series; its paid activity remains in the tables below. Family spend can overlap for nested breakouts and must not be summed across every row.</p>
      {!completeRevenue && <p className="mt-2 text-xs font-semibold text-amber-800">Revenue coverage is incomplete for at least one headline family or comparison period. Treat the headline and YoY as provisional.</p>}
      {contraFamilies.length > 0 && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Opposing trends to investigate</p><ul className="mt-2 space-y-2 text-sm text-amber-900">{contraFamilies.map(f => <li key={f.key}>{f.label}: revenue {change(f.current, f.previous)}, spend {change(f.spend, f.previousSpend)}. This pattern does not establish that the media change caused the revenue change.</li>)}</ul></div>}
    </Section>

    <Section title="The monthly picture" subtitle="Combined BPT + POL revenue and all paid-media spend shown side by side. Missing revenue is not zero. Each row compares the same calendar month.">
      <ScrollTable label="Monthly business revenue and paid-media spend"><table className="w-full"><caption className="sr-only">Monthly 2026 and 2025 comparison</caption><thead className="bg-gray-50"><tr>{['Month', '2026 revenue', '2025 revenue', 'Revenue YoY', '2026 spend', '2025 spend', 'Spend YoY'].map((label, index) => <th scope="col" key={label} className={`${th} ${index === 0 ? 'text-left' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{data.monthly.map(month => <tr key={month.month}><th scope="row" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{month.month}</th><td className={td}>{money(month.currentRevenue)}</td><td className={td}>{money(month.previousRevenue)}</td><td className={td}>{change(month.currentRevenue, month.previousRevenue)}</td><td className={td}>{money(month.currentSpend)}</td><td className={td}>{money(month.previousSpend)}</td><td className={td}>{change(month.currentSpend, month.previousSpend)}</td></tr>)}{!data.monthly.length && <tr><td colSpan={7} className="p-6 text-sm text-gray-500">No monthly data returned.</td></tr>}</tbody></table></ScrollTable>
    </Section>

    <Section title="Paid media and onsite engagement" subtitle="Jan-Oct 2026 vs Jan-Oct 2025. Onsite metrics are campaign-attributed warehouse data, not the GA4 website total. CPES means cost per engaged session.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Spend" current={s.cost} previous={p.cost} format={money} />
        <Metric label="Impressions" current={s.impressions} previous={p.impressions} />
        <Metric label="Clicks" current={s.clicks} previous={p.clicks} />
        <Metric label="CTR" current={ratio(s.clicks, s.impressions)} previous={ratio(p.clicks, p.impressions)} format={percent} />
        <Metric label="CPC" current={ratio(s.cost, s.clicks)} previous={ratio(p.cost, p.clicks)} format={cents} />
        <Metric label="Sessions" current={s.sessions} previous={p.sessions} />
        <Metric label="Engaged sessions" current={s.engagedSessions} previous={p.engagedSessions} />
        <Metric label="Engagement rate" current={ratio(s.engagedSessions, s.sessions)} previous={ratio(p.engagedSessions, p.sessions)} format={percent} />
        <Metric label="CPES" current={ratio(s.cost, s.engagedSessions)} previous={ratio(p.cost, p.engagedSessions)} format={cents} />
      </div>
    </Section>

    <Section title="2026 conversion baseline" subtitle="Conversion tracking was not reliable before 2026. Counts, conversion rates and cost-per-conversion metrics intentionally have no YoY comparison.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total conversions" current={b.totalConversions} format={conversionCount} note="Product Submittals + HubSpot Form Fills + Meta Leads" /><Metric label="Product Submittals" current={b.productSubmittals} format={conversionCount} note="Website product-submittal actions" /><Metric label="HubSpot Form Fills" current={b.hubspotFormFills} format={conversionCount} note="Google Ads hs_form_submission action, not all CRM forms" /><Metric label="Meta Leads" current={b.metaLeads} note="Native Meta lead-form submissions, not website forms" /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Website conversion rate" current={ratio(b.websiteConversions, b.websiteClicks)} format={percent} note="Product Submittals + HubSpot Form Fills, divided by website clicks" /><Metric label="Website cost / conversion" current={ratio(b.websiteCost, b.websiteConversions)} format={cents} note="Website spend divided by website conversions" /><Metric label="Meta lead rate" current={ratio(b.metaLeads, b.metaClicks)} format={percent} note="Native Meta leads divided by Meta clicks" /><Metric label="Meta cost / lead" current={ratio(b.metaCost, b.metaLeads)} format={cents} note="Meta spend divided by native Meta leads" /></div>
    </Section>

    <Section title="Explore the activity" subtitle="All supplied groups are retained, including previous-only activity, Contractor360 and unmapped records. Open a table and scroll horizontally for the full metric set.">
      <div className="space-y-3"><ActivityTable title="Channels" open rows={data.channels.map(row => ({ ...row, label: row.channel }))} /><ActivityTable title="Audience types" rows={data.audiences.map(row => ({ ...row, label: row.audienceType }))} /><ActivityTable title="Subcampaigns" rows={data.campaigns.map(row => ({ ...row, label: row.subCampaign }))} /><ActivityTable title="Campaign types" rows={data.campaignTypes.map(row => ({ ...row, label: row.campaignType }))} /></div>
    </Section>

    <details className={panel}><summary className="cursor-pointer text-sm font-bold text-brand-dark focus-visible:outline-2 focus-visible:outline-brand-forest">Source coverage and review notes {data.warnings.length > 0 && `(${data.warnings.length})`}</summary><div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600"><p>Fixed reporting window: {data.start} to {data.end}. Comparison: {data.compStart} to {data.compEnd}. This first draft is for review; revenue, delivery and onsite engagement describe different measurement scopes.</p><p>No causal link between media spend and revenue is established here. Proposed 2027 tests require approval and a measurement plan before launch.</p>{data.warnings.length ? <ul className="list-disc space-y-2 pl-5">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : <p>No additional source warnings were returned.</p>}</div></details>
  </div>;
}
