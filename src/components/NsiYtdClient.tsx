'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3, FlaskConical, Printer, TrendingUp } from 'lucide-react';
import NsiYtdEmailSection from './NsiYtdEmailSection';
import NsiYtdMediaSection from './NsiYtdMediaSection';
import type { MediaSnapshot } from '@/lib/nsi-ytd-media';
import { buildModeledRoas, MODELED_ROAS_LABEL, conversionOptions, partitionActivity, yoyLabel, type ConversionColumn } from '@/lib/nsi-ytd-presentation';
import type { NsiYtdData } from '@/services/nsi-ytd';
import type { NsiChannelRow } from '@/services/nsi-analytics';
import type { EmailSnapshot } from '@/lib/nsi-ytd-email';

const money = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const cents = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const integer = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const conversionCount = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : `${(value * 100).toFixed(1)}%`;
const multiple = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not available' : `${value.toFixed(2)}x`;
const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const delta = (current: number | null, previous: number | null) => current === null || previous === null || previous <= 0 ? null : (current - previous) / previous;
function change(current: number | null, previous: number | null) {
  return yoyLabel(current, previous);
}
const panel = 'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm';
const th = 'px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap';
const td = 'px-3 py-3 text-right text-sm tabular-nums whitespace-nowrap';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className={panel}><h2 className="text-sm font-extrabold uppercase tracking-widest text-gray-500">{title}</h2>{subtitle && <p className="mt-2 mb-5 text-sm leading-relaxed text-gray-500">{subtitle}</p>}{children}</section>;
}
function Metric({ label, current, previous, format = integer, note }: { label: string; current: number | null; previous?: number | null; format?: (value: number | null) => string; note?: string }) {
  return <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><p className="mb-2 text-[10px] font-bold uppercase leading-tight tracking-widest text-gray-400">{label}</p><p className="text-lg font-black leading-none tracking-tight text-brand-dark tabular-nums">{format(current)}</p>{previous !== undefined && <><p className="mt-2 text-[10px] font-bold text-gray-500">{change(current, previous)}</p><p className="mt-1 text-[10px] text-gray-400">Jan-Oct 2025: {format(previous)}</p></>}{note && <p className="mt-2 text-xs leading-relaxed text-gray-500">{note}</p>}</div>;
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
  { label: 'Website conversions', current: r => r.websiteConversions, format: conversionCount },
  { label: 'Website conversion rate', current: r => ratio(r.websiteConversions, r.websiteClicks), format: percent },
  { label: 'Website cost / conversion', current: r => ratio(r.websiteCost, r.websiteConversions), format: cents },
  { label: 'Meta lead rate', current: r => ratio(r.metaLeads, r.metaClicks), format: percent },
  { label: 'Meta cost / lead', current: r => ratio(r.metaCost, r.metaLeads), format: cents },
];
function ActivityTable({ title, rows, selected, open = false }: { title: string; rows: ActivityRow[]; selected: readonly ConversionColumn[]; open?: boolean }) {
  const { active, inactive } = partitionActivity(rows);
  const optional = activityMetrics.slice(9).filter(metric =>
    metric.label.startsWith('Meta') ? selected.includes('metaLeads') :
    metric.label.startsWith('Website') ? selected.includes('websiteConversions') :
    metric.label === 'Product Submittals' ? selected.includes('productSubmittals') :
    selected.includes('hubspotFormFills'));
  const metrics = [...activityMetrics.slice(0, 9), { label: 'Total conversions', current: (r: ActivityRow) => r.conversions, format: conversionCount }, ...optional];
  const table = (items: ActivityRow[], columns: ActivityMetric[], caption: string) => <ScrollTable label={caption}><table className="w-full border-collapse text-left"><caption className="sr-only">{caption}. Jan-Oct 2026 vs Jan-Oct 2025. Conversion comparisons are intentionally omitted.</caption><thead className="border-b border-gray-100 bg-white"><tr><th scope="col" className={`${th} text-left`}>Group</th>{columns.map(m => <th key={m.label} scope="col" className={th}>{m.label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{items.map((row, index) => <tr key={`${row.label}-${index}`} className="hover:bg-gray-50/60"><th scope="row" className="min-w-48 px-4 py-3 text-sm font-semibold text-gray-700">{row.label || 'Unmapped'}{!active.includes(row) && <span className="mt-1 block text-xs font-normal text-gray-500">Historical / no current activity</span>}{row.suppressComparison && <span className="mt-1 block text-xs font-normal text-gray-500">Comparison not like-for-like</span>}</th>{columns.map(m => <td key={m.label} className={td}><div className="font-semibold text-gray-800">{m.format(m.current(row))}</div>{m.previous && <div className="mt-1 text-[11px] text-gray-500">{m.format(m.previous(row))}<br />{row.suppressComparison ? 'Historical, not comparable' : change(m.current(row), m.previous(row))}</div>}</td>)}</tr>)}{!items.length && <tr><td colSpan={columns.length + 1} className="p-6 text-sm text-gray-500">No current activity returned for this grouping.</td></tr>}</tbody></table></ScrollTable>;
  return <details open={open} className="rounded-xl border border-gray-100 bg-white nsi-ytd-activity">
    <summary className="cursor-pointer rounded-xl px-4 py-4 text-sm font-bold text-brand-dark focus-visible:outline-2 focus-visible:outline-brand-forest">{title} <span className="ml-2 font-normal text-gray-500">{active.length} current groups</span></summary>
    <div className="px-4 pb-4"><p className="text-xs text-gray-500">Comparable cells show 2026, then 2025 and a neutral directional YoY label. Conversion measures are 2026 only, with up to two decimal places retained. Historical audience values are not like-for-like.</p>
      <div className="nsi-ytd-screen-only">{table(active, metrics, `${title} performance`)}{inactive.length > 0 && <details className="mt-3 rounded-xl bg-gray-50 p-3"><summary className="cursor-pointer text-xs font-semibold text-gray-600">Historical / inactive groups ({inactive.length})</summary>{table(inactive, metrics, `${title} historical and inactive performance`)}</details>}</div>
      <div className="nsi-ytd-print-only">{[metrics.slice(0, 5), metrics.slice(5, 9), metrics.slice(9)].map((columns, index) => <div key={index} className="mt-4"><h3 className="text-xs font-bold">{title}: {['media delivery', 'onsite engagement', '2026 conversions'][index]}</h3>{table(rows, columns, `${title}, ${['media delivery', 'onsite engagement', '2026 conversions'][index]}`)}</div>)}</div>
    </div>
  </details>;
}

export default function NsiYtdClient({ data, emailData, mediaData }: { data: NsiYtdData; emailData: EmailSnapshot; mediaData: MediaSnapshot | null }) {
  const [family, setFamily] = useState('all');
  const [selectedConversions, setSelectedConversions] = useState<ConversionColumn[]>([]);
  const [printError, setPrintError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const printReport = async () => {
    setPrintError(null);
    // Some Chromium builds leave ready pending even while FontFaceSet reports loaded.
    if (document.fonts.status !== 'loaded') {
      await Promise.race([document.fonts.ready, new Promise<void>(resolve => window.setTimeout(resolve, 3000))]);
      if (!['loaded'].includes(document.fonts.status)) {
        setPrintError('Report fonts are still loading. Please try Print / Save PDF again.');
        return;
      }
    }
    const details = Array.from(reportRef.current?.querySelectorAll('details') ?? []);
    const previous = details.map(element => element.open);
    const restore = () => details.forEach((element, index) => { element.open = previous[index]; });
    details.forEach(element => { element.open = true; });
    window.addEventListener('afterprint', restore, { once: true });
    try { window.print(); } catch {
      window.removeEventListener('afterprint', restore);
      restore();
      setPrintError('The browser could not open printing. Please try again.');
    }
  };
  const s = data.summary;
  const p = data.prevSummary;
  const b = data.conversionBreakout;
  const bpt = data.revenueFamilies.find(f => f.key.toUpperCase() === 'BPT');
  const pol = data.revenueFamilies.find(f => f.key.toUpperCase() === 'POL');
  const cmp = data.revenueFamilies.find(f => f.key.toUpperCase() === 'CMP');
  // Compression is already included in Polaris. Never sum every family row.
  const combined = bpt?.current != null && pol?.current != null ? bpt.current + pol.current : null;
  const previousCombined = bpt?.previous != null && pol?.previous != null ? bpt.previous + pol.previous : null;
  const model = buildModeledRoas(data.revenueFamilies);
  const revenueChange = delta(combined, previousCombined);
  const spendChange = delta(s.cost, p.cost);
  const contraFamilies = data.revenueFamilies.filter(f => {
    const revenueDelta = delta(f.current, f.previous);
    const spendDelta = delta(f.spend, f.previousSpend);
    return revenueDelta !== null && spendDelta !== null && revenueDelta * spendDelta < 0;
  });
  const shownFamilies = family === 'all' ? data.revenueFamilies : data.revenueFamilies.filter(f => f.key === family);
  const completeRevenue = bpt?.months === 10 && pol?.months === 10 && bpt?.previousMonths === 10 && pol?.previousMonths === 10;

  return <div ref={reportRef} className="nsi-ytd-report space-y-6 pb-8">
    <style>{`
      .nsi-ytd-print-only { display: none; }
      @media print {
        @page { size: A4 landscape; margin: 9mm; }
        body:has(.nsi-ytd-report) { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-pdf-shell]:has(.nsi-ytd-report) { display: block !important; min-height: 0 !important; }
        [data-pdf-shell]:has(.nsi-ytd-report) [data-pdf-hidden], .nsi-ytd-screen-only { display: none !important; }
        [data-pdf-canvas]:has(.nsi-ytd-report) { padding: 0 !important; overflow: visible !important; }
        .nsi-ytd-report { width: 100%; color: #111827; font-size: 9pt; }
        .nsi-ytd-report .nsi-ytd-print-only { display: block !important; }
        .nsi-ytd-report section, .nsi-ytd-report details { box-shadow: none !important; }
        .nsi-ytd-report section { padding: 12px; }
        .nsi-ytd-report [role="region"], .nsi-ytd-report .overflow-x-auto { overflow: visible !important; }
        .nsi-ytd-report table { width: 100% !important; table-layout: fixed; }
        .nsi-ytd-report th, .nsi-ytd-report td { min-width: 0 !important; white-space: normal !important; overflow-wrap: anywhere; padding: 5px 4px !important; font-size: 8pt !important; }
        .nsi-ytd-report th:first-child { width: 20%; }
        .nsi-ytd-report thead { display: table-header-group; }
        .nsi-ytd-report tr, .nsi-ytd-report article { break-inside: avoid; }
        .nsi-ytd-report h2, .nsi-ytd-report h3, .nsi-ytd-report summary { break-after: avoid; }
        .nsi-ytd-report summary { list-style: none; }
        [data-pdf-shell]:has(.nsi-ytd-report) > :not(main) { display: none !important; }
        [data-pdf-shell]:has(.nsi-ytd-report) main { display: block !important; }
        [data-pdf-canvas]:has(.nsi-ytd-report), .nsi-ytd-report { background: white !important; height: auto !important; min-height: 0 !important; }
        .nsi-ytd-report section, .nsi-ytd-report table, .nsi-ytd-report details { break-inside: auto !important; page-break-inside: auto !important; }
        .nsi-ytd-report > section[aria-labelledby="executive-title"] { break-inside: avoid !important; page-break-inside: avoid !important; }
        .nsi-ytd-report > section[aria-labelledby="executive-title"] > div { display: grid !important; grid-template-columns: 1fr 1.4fr !important; gap: 18px !important; padding: 16px !important; }
        .nsi-ytd-report > div[aria-label="Revenue by business pillar"] { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 8px !important; }
        .nsi-ytd-report > div[class*="lg:grid-cols-3"] { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
        .nsi-ytd-report p, .nsi-ytd-report li { font-size: 9pt !important; line-height: 1.35 !important; }
        .nsi-ytd-report p[class*="text-lg"], .nsi-ytd-report p[class*="text-xl"], .nsi-ytd-report p[class*="text-2xl"] { font-size: 14pt !important; }
        .nsi-ytd-report section[aria-labelledby="executive-title"] p[class*="text-4xl"] { font-size: 28pt !important; }
        .nsi-ytd-report h1 { font-size: 20pt !important; }
        .nsi-ytd-report h2 { font-size: 13pt !important; }
        .nsi-ytd-report > * { margin-top: 12px !important; }
        .nsi-ytd-report > :first-child { margin-top: 0 !important; }
        .nsi-ytd-report section > div[class*="xl:grid-cols-5"] { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .nsi-ytd-report section > div[class*="xl:grid-cols-4"] { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        .nsi-ytd-report section > div[class*="md:grid-cols-3"] { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .nsi-ytd-report > details:last-child { break-inside: avoid !important; page-break-inside: avoid !important; }
      }
    `}</style>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-800">Year-to-date review</span><span className="text-xs text-gray-500">As of {data.asOf.slice(0, 10)}</span></div><h1 className="text-2xl font-black tracking-tight text-brand-dark">NSI year-to-date review</h1><p className="mt-2 text-sm font-semibold text-gray-600">Jan-Oct 2026 vs Jan-Oct 2025</p><p className="mt-1 text-xs text-gray-500">January 1 - October 31, 2026 compared with January 1 - October 31, 2025</p></div>
      <div className="nsi-ytd-screen-only flex flex-wrap gap-2"><button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-brand-forest px-4 py-2 text-sm font-bold text-white hover:opacity-90"><Printer aria-hidden="true" className="h-4 w-4" />Print / Save PDF</button><Link href="/dashboard/nsi" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-gray-50">Main dashboard <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
    </header>
    {printError && <p role="alert" className="nsi-ytd-screen-only text-sm font-semibold text-amber-800">{printError}</p>}
    <p className="text-xs leading-relaxed text-amber-800">Paid-media comparisons use the warehouse snapshot and remain provisional pending native-source reconciliation. Known ingestion and campaign-tagging exceptions are disclosed in the source notes below.</p>

    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white text-brand-dark shadow-sm" aria-labelledby="executive-title">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.4fr]">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Revenue first</p><h2 id="executive-title" className="mt-3 text-lg font-extrabold tracking-tight">Combined Bridgeport + Polaris</h2><p className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{money(combined)}</p><p className="mt-3 text-xs font-bold text-gray-600">{change(combined, previousCombined)}</p><p className="mt-1 text-xs text-gray-400">Jan-Oct 2025: {money(previousCombined)}</p><p className="mt-4 text-xs leading-relaxed text-gray-500">Reported business revenue, not ad-attributed revenue. CMP is a nested Polaris breakout, not incremental revenue.</p></div>
        <div className="space-y-4 text-gray-600 lg:border-l lg:border-gray-100 lg:pl-6"><p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">Executive readout</p>
          <p className="text-base font-semibold leading-relaxed">{revenueChange === null ? 'The revenue comparison needs a complete prior-year baseline.' : `Reported revenue ${revenueChange > 0 ? 'increased' : revenueChange < 0 ? 'decreased' : 'was unchanged'}${revenueChange === 0 ? '' : ` ${percent(Math.abs(revenueChange))}`} year over year.`} Media spend was {money(s.cost)} ({change(s.cost, p.cost)}).</p>
          <p className="text-sm leading-relaxed">Revenue by business line: Bridgeport {change(bpt?.current ?? null, bpt?.previous ?? null)}, Polaris {change(pol?.current ?? null, pol?.previous ?? null)}. The Compression breakout within Polaris was {change(cmp?.current ?? null, cmp?.previous ?? null)}.</p>
          <p className="text-sm leading-relaxed">Campaign-attributed engaged sessions totaled {integer(s.engagedSessions)} ({change(s.engagedSessions, p.engagedSessions)}), with CPES of {cents(ratio(s.cost, s.engagedSessions))} versus {cents(ratio(p.cost, p.engagedSessions))} in 2025.</p>
          <p className="text-sm leading-relaxed">{contraFamilies.length ? `${contraFamilies.map(f => f.label).join(', ')} showed opposing spend and revenue directions. Review the family detail before drawing a budget conclusion.` : revenueChange !== null && spendChange !== null ? 'Compare revenue direction with media delivery and engagement, not spend in isolation.' : 'Review source coverage before drawing a budget conclusion.'} These are parallel trends, not evidence of causation.</p>
        </div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Revenue by business pillar">
      <Metric label="Bridgeport revenue" current={bpt?.current ?? null} previous={bpt?.previous ?? null} format={money} note="Reported BPT business revenue" />
      <Metric label="Polaris revenue" current={pol?.current ?? null} previous={pol?.previous ?? null} format={money} note="Includes Compression revenue" />
      <Metric label="Compression breakout" current={cmp?.current ?? null} previous={cmp?.previous ?? null} format={money} note="Within Polaris, nonadditive" />
      <Metric label="Contractor360 revenue" current={null} format={() => 'Not linked'} note="Paid activity is reported below, no revenue series is linked" />
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <article className={panel}><TrendingUp aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">What changed</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">2026 expanded the demand-generation foundation already operating in 2025. Contractor and end-user programs added direct Meta lead capture, richer role information, and product-specific follow-up. Paid media delivered {integer(s.clicks)} clicks and {integer(s.sessions)} campaign-attributed sessions alongside the reported revenue growth.</p></article>
      <article className={panel}><BarChart3 aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">What we learned</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">CPC was {cents(ratio(s.cost, s.clicks))} versus {cents(ratio(p.cost, p.clicks))}; onsite engagement rate was {percent(ratio(s.engagedSessions, s.sessions))} versus {percent(ratio(p.engagedSessions, p.sessions))}. Traffic efficiency alone does not establish prospect quality. The next measurement milestone is a verified capture → qualification → sales acceptance path, not simply more form submissions.</p></article>
      <article className={panel}><FlaskConical aria-hidden="true" className="mb-3 h-5 w-5 text-brand-forest" /><h2 className="font-extrabold text-brand-dark">Proposed 2027 tests</h2><p className="mt-3 text-sm leading-relaxed text-gray-600">Test AI-assisted creative production and a broader creative testing cadence. Explore connected TV and audio as controlled pilots with agreed audiences, budgets and success measures. These are proposals, not claims of activity already run.</p></article>
    </div>

    <Section title="Revenue and spend by family" subtitle="Same-period business revenue alongside paid-media investment. Directional comparison only, not attribution or a return calculation.">
      <label htmlFor="nsi-ytd-family" className="text-xs font-bold text-gray-600">Product family</label><select id="nsi-ytd-family" value={family} onChange={event => setFamily(event.target.value)} className="ml-3 max-w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-forest"><option value="all">All families</option>{data.revenueFamilies.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      <ScrollTable label="Revenue and media spend by product family"><table className="w-full"><caption className="sr-only">Jan-Oct 2026 vs Jan-Oct 2025 family revenue and spend</caption><thead className="border-b border-gray-100 bg-white"><tr>{['Family', '2026 revenue', '2025 revenue', 'Revenue YoY', '2026 spend', '2025 spend', 'Spend YoY', 'Revenue coverage'].map((label, index) => <th scope="col" key={label} className={`${th} ${index === 0 ? 'text-left' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{shownFamilies.map(f => <tr key={f.key}><th scope="row" className={`min-w-52 px-4 py-4 text-left text-sm font-semibold text-brand-dark ${f.key.toUpperCase() === 'CMP' ? 'pl-9' : ''}`}>{f.label}{f.key.toUpperCase() === 'CMP' && <span className="mt-1 block text-xs font-normal text-gray-500">Within Polaris · nonadditive</span>}</th><td className={td}>{money(f.current)}</td><td className={td}>{money(f.previous)}</td><td className={td}>{change(f.current, f.previous)}</td><td className={td}>{money(f.spend)}</td><td className={td}>{money(f.previousSpend)}</td><td className={td}>{change(f.spend, f.previousSpend)}</td><td className={td}>{f.current === null && f.previous === null ? 'Not linked' : `${f.months}/10 vs ${f.previousMonths}/10 months`}</td></tr>)}</tbody></table></ScrollTable>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Bridgeport (BPT) + Polaris (POL) form the combined revenue headline. Compression (CMP) is included in Polaris and must not be added again. Contractor360 has no linked revenue series; its paid activity remains in the tables below. Family spend can overlap for nested breakouts and must not be summed across every row.</p>
      {!completeRevenue && <p className="mt-2 text-xs font-semibold text-amber-800">Revenue coverage is incomplete for at least one headline family or comparison period. Treat the headline and YoY as provisional.</p>}
      {contraFamilies.length > 0 && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Opposing trends to investigate</p><ul className="mt-2 space-y-2 text-sm text-amber-900">{contraFamilies.map(f => <li key={f.key}>{f.label}: revenue {change(f.current, f.previous)}, spend {change(f.spend, f.previousSpend)}. This pattern does not establish that the media change caused the revenue change.</li>)}</ul></div>}
    </Section>

    <Section title={MODELED_ROAS_LABEL} subtitle="Scenario only: 0.01 × reported business revenue ÷ matching business-line media spend. Not attributed revenue, actual ROI or evidence of causal return. Both periods use Jan 1 - Oct 31 of their respective year.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Combined Bridgeport + Polaris" current={model.combined.current} previous={model.combined.previous} format={multiple} note="BPT + POL revenue and BPT + POL spend only. Excludes other media; CMP is not added again." />
        <Metric label="Bridgeport" current={model.byFamily[bpt?.key ?? '']?.current ?? null} previous={model.byFamily[bpt?.key ?? '']?.previous ?? null} format={multiple} note="BPT reported revenue and matching BPT media spend" />
        <Metric label="Polaris, including Compression" current={model.byFamily[pol?.key ?? '']?.current ?? null} previous={model.byFamily[pol?.key ?? '']?.previous ?? null} format={multiple} note="POL reported revenue and matching POL media spend, including CMP" />
        <Metric label="Compression breakout within Polaris" current={model.byFamily[cmp?.key ?? '']?.current ?? null} previous={model.byFamily[cmp?.key ?? '']?.previous ?? null} format={multiple} note="Nested, nonadditive CMP scenario using CMP revenue and CMP spend" />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Every value above is modeled ROAS under the 1% revenue assumption. Zero, missing or invalid revenue or matching spend makes the affected model unavailable. Prior-year values use the same assumption and matching period. Contractor360 has no linked revenue series, so no model is available.</p>
    </Section>

    <Section title="From demand generation to a measurable sales handoff" subtitle="Progress and next steps, based on the November 4 review call. This operating-status update is separate from the Jan-Oct performance totals.">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl bg-gray-50 p-4"><h3 className="text-sm font-bold text-brand-dark">Capture and identify</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">2025 search and nurture foundations expanded into contractor and end-user capture. The November 4 call reported that CMP and OOPS role answers were unified into the Meta Lead Role field and backfilled.</p></article>
        <article className="rounded-xl bg-gray-50 p-4"><h3 className="text-sm font-bold text-brand-dark">Qualify consistently</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">Role-specific information makes qualification more actionable. Updated scoring was still pending at the call, so verified MQL or SQL totals are not claimed here.</p></article>
        <article className="rounded-xl bg-brand-forest/5 p-4"><h3 className="text-sm font-bold text-brand-dark">Prove the sales connection</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">Confirm score, lifecycle stage, assigned owner, handoff time, sales acceptance and disposition. Manual forwarding was described in the call; automated closed-loop routing and campaign-to-sale attribution remain unverified.</p></article>
      </div>
      <details className="mt-4 text-xs text-gray-500"><summary className="cursor-pointer font-semibold">Evidence and interpretation</summary><p className="mt-2 leading-relaxed">Search and CRM scoring were documented in 2025. Task status alone is not launch or outcome evidence. The November 4 call is an operating-status source, not activity included in the January-October totals.</p><ul className="mt-2 list-disc space-y-1 pl-4"><li><a href="https://fathom.video/calls/886594458?timestamp=1951" target="_blank" rel="noreferrer" className="underline">November 4 call: role field, scoring and handoff discussion</a></li><li><a href="https://app.clickup.com/t/86b4k98ta" target="_blank" rel="noreferrer" className="underline">2025 LQT search foundation</a></li><li><a href="https://app.clickup.com/t/86b6r0zq0" target="_blank" rel="noreferrer" className="underline">2025 scoring and nurture design</a></li><li><a href="https://app.clickup.com/t/86bcp6e6p" target="_blank" rel="noreferrer" className="underline">2026 OOPS reported launch and integration</a></li></ul></details>
    </Section>

    <Section title="The monthly picture" subtitle="Combined BPT + POL revenue and all paid-media spend shown side by side. Missing revenue is not zero. Each row compares the same calendar month.">
      <ScrollTable label="Monthly business revenue and paid-media spend"><table className="w-full"><caption className="sr-only">Monthly 2026 and 2025 comparison</caption><thead className="border-b border-gray-100 bg-white"><tr>{['Month', '2026 revenue', '2025 revenue', 'Revenue YoY', '2026 spend', '2025 spend', 'Spend YoY'].map((label, index) => <th scope="col" key={label} className={`${th} ${index === 0 ? 'text-left' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{data.monthly.map(month => <tr key={month.month}><th scope="row" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{month.month}</th><td className={td}>{money(month.currentRevenue)}</td><td className={td}>{money(month.previousRevenue)}</td><td className={td}>{change(month.currentRevenue, month.previousRevenue)}</td><td className={td}>{money(month.currentSpend)}</td><td className={td}>{money(month.previousSpend)}</td><td className={td}>{change(month.currentSpend, month.previousSpend)}</td></tr>)}{!data.monthly.length && <tr><td colSpan={7} className="p-6 text-sm text-gray-500">No monthly data returned.</td></tr>}</tbody></table></ScrollTable>
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

    <NsiYtdEmailSection data={emailData} />
    <NsiYtdMediaSection data={mediaData} />

    <Section title="Explore the activity" subtitle="Current activity is shown by default. Previous-only and inactive groups remain available in each table. Controls change columns only, never the underlying totals.">
      <fieldset className="nsi-ytd-screen-only mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4"><legend className="px-1 text-xs font-bold text-gray-600">Optional conversion columns, applies to all four tables</legend><div className="flex flex-wrap gap-4">{conversionOptions.map(option => <label key={option.key} className="inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={selectedConversions.includes(option.key)} onChange={event => setSelectedConversions(values => event.target.checked ? [...values, option.key] : values.filter(value => value !== option.key))} className="accent-brand-forest" />{option.label}</label>)}</div></fieldset>
      <div className="space-y-3"><ActivityTable title="Channels" open selected={selectedConversions} rows={data.channels.map(row => ({ ...row, label: row.channel }))} /><ActivityTable title="Audience types" selected={selectedConversions} rows={data.audiences.map(row => ({ ...row, label: row.audienceType }))} /><ActivityTable title="Subcampaigns" selected={selectedConversions} rows={data.campaigns.map(row => ({ ...row, label: row.subCampaign }))} /><ActivityTable title="Campaign types" selected={selectedConversions} rows={data.campaignTypes.map(row => ({ ...row, label: row.campaignType }))} /></div>
    </Section>

    <details className={panel}><summary className="cursor-pointer text-sm font-bold text-brand-dark focus-visible:outline-2 focus-visible:outline-brand-forest">Source coverage and review notes {data.warnings.length > 0 && `(${data.warnings.length})`}</summary><div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600"><p>Fixed reporting window: {data.start} to {data.end}. Comparison: {data.compStart} to {data.compEnd}. This first draft is for review; revenue, delivery and onsite engagement describe different measurement scopes.</p><p>No causal link between media spend and revenue is established here. Proposed 2027 tests require approval and a measurement plan before launch.</p>{data.warnings.length ? <ul className="list-disc space-y-2 pl-5">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : <p>No additional source warnings were returned.</p>}</div></details>
  </div>;
}
