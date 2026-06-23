import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Mail, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { fetchSpartacoProductWrapup, type SpartacoProductWrapup, type WrapupPeriod } from '@/services/spartaco-product-wrapups';
import ProductTrendChart from '@/components/ProductTrendChart';
import SpartacoMetaAdsSection from '@/components/SpartacoMetaAdsSection';
import WrapupSourceMediumTable from '@/components/WrapupSourceMediumTable';
import { requireClientAccess } from '@/lib/auth-guard';
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from '@/lib/utils';

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function fmtCurrencyDecimal(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function liftLabel(value: number | null) {
  if (value === null) return 'New activity from zero baseline';
  if (value === 0) return 'Flat';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function cplBenchmarkLabel(value: number | null) {
  if (value === null) return 'New activity from zero baseline';
  if (value === 0) return 'Flat';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function PeriodCard({ period }: { period: WrapupPeriod }) {
  const summary = period.summary;
  const emailOpenRate = rate(summary.email_opens, summary.email_total_sent);
  const emailClickRate = rate(summary.email_clicks, summary.email_total_sent);
  const gscCtr = rate(summary.gsc_clicks, summary.gsc_impressions);

  const rows = [
    ['Ad spend', fmtCurrency(summary.ad_cost)],
    ['Ad impressions', fmtCompact(summary.ad_impressions)],
    ['Ad clicks', fmtNumber(summary.ad_clicks)],
    ['Tracked conversions/leads', fmtNumber(summary.ad_conversions)],
    ['GA4 sessions', fmtNumber(summary.ga4_sessions)],
    ['GA4 engaged sessions', fmtNumber(summary.ga4_engaged_sessions)],
    ['Online purchases', fmtNumber(summary.ga4_purchases)],
    ['Online revenue', fmtCurrency(summary.ga4_total_revenue)],
    ['Email sent', fmtNumber(summary.email_total_sent)],
    ['Email open rate', summary.email_total_sent > 0 ? fmtPercent(emailOpenRate) : '—'],
    ['Email click rate', summary.email_total_sent > 0 ? fmtPercent(emailClickRate) : '—'],
    ['GSC impressions', fmtCompact(summary.gsc_impressions)],
    ['GSC clicks', fmtNumber(summary.gsc_clicks)],
    ['GSC CTR', summary.gsc_impressions > 0 ? fmtPercent(gscCtr) : '—'],
    ['Keywords ranked', fmtNumber(summary.gsc_keywords_ranked)],
  ];

  return (
    <div className={`rounded-3xl border bg-white p-5 shadow-sm ${period.key === 'during' ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-gray-100'}`}>
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">{period.label}</p>
        <h3 className="mt-1 text-lg font-black text-brand-dark">{formatDate(period.start)} – {formatDate(period.end)}</h3>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-gray-50 py-1.5 last:border-0">
            <span className="text-xs font-semibold text-gray-500">{label}</span>
            <span className="text-sm font-black text-brand-dark">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightBox({ title, icon: Icon, children }: { title: string; icon: typeof CheckCircle2; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-brand-dark p-2 text-white">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-black text-brand-dark">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, tone = 'default' }: { items: string[]; tone?: 'default' | 'good' | 'warning' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-700';
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className={`flex gap-2 text-sm leading-relaxed ${color}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function share(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function AttributionBar({ paid, halo, total, paidLabel = 'Paid-attributed', haloLabel = 'Organic / halo' }: {
  paid: number;
  halo: number;
  total: number;
  paidLabel?: string;
  haloLabel?: string;
}) {
  const paidShare = share(paid, total);
  const haloShare = share(halo, total);
  return (
    <div className="mt-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div className="bg-indigo-600" style={{ width: `${Math.max(0, paidShare * 100)}%` }} />
        <div className="bg-emerald-500" style={{ width: `${Math.max(0, haloShare * 100)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-600" />{paidLabel}: {fmtPercent(paidShare)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />{haloLabel}: {fmtPercent(haloShare)}</span>
      </div>
    </div>
  );
}

function TopLineDigitalScorecard({ period }: { period: WrapupPeriod }) {
  const summary = period.summary;
  const cards = [
    { label: 'Eyeballs', value: fmtCompact(summary.ad_impressions + summary.gsc_impressions), sub: `${fmtCompact(summary.ad_impressions)} paid impr. + ${fmtCompact(summary.gsc_impressions)} GSC impr.` },
    { label: 'Clicks', value: fmtNumber(summary.ad_clicks + summary.gsc_clicks + summary.email_clicks), sub: 'Paid + search + email clicks' },
    { label: 'Sessions', value: fmtNumber(summary.ga4_sessions), sub: 'GA4 product traffic' },
    { label: 'Engaged sessions', value: fmtNumber(summary.ga4_engaged_sessions), sub: 'Quality traffic signal' },
    { label: 'Tracked leads', value: fmtNumber(summary.ad_conversions), sub: 'Ad-platform conversions' },
    { label: 'Online sales', value: fmtNumber(summary.ga4_purchases), sub: fmtCurrency(summary.ga4_total_revenue) },
    { label: 'Email sends', value: fmtNumber(summary.email_total_sent), sub: `${fmtNumber(summary.email_opens)} opens · ${fmtNumber(summary.email_clicks)} clicks` },
  ];

  return (
    <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Campaign-Period Digital Impact</p>
        <h2 className="mt-1 text-xl font-black text-brand-dark">The top-line numbers we can prove</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          This roll-up focuses only on available marketing/dashboard data: eyeballs, clicks, product sessions, engaged sessions, tracked leads, Act-On email activity, and GA4 online sales.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-brand-dark">{card.value}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{card.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaidPerformanceScorecard({ data }: { data: SpartacoProductWrapup['paidOverview'] }) {
  const benchmarkText = data.benchmarkCpl
    ? `${data.cplDelta !== null && data.cplDelta < 0 ? 'Better' : 'Higher'} than ${data.benchmarkProducts} other paid product ${data.benchmarkProducts === 1 ? 'benchmark' : 'benchmarks'} in this window`
    : 'Benchmark unavailable';

  const cards = [
    { label: 'Impressions', value: fmtCompact(data.impressions), sub: 'Paid reach' },
    { label: 'Clicks', value: fmtNumber(data.clicks), sub: `${fmtPercent(data.ctr)} CTR` },
    { label: 'CPC', value: fmtCurrencyDecimal(data.cpc), sub: 'Paid efficiency' },
    { label: 'Leads', value: fmtNumber(data.leads), sub: `${fmtCurrencyDecimal(data.cpl)} CPL` },
    { label: 'Revenue', value: fmtCurrency(data.revenue), sub: `${fmtNumber(data.purchases)} ad-attributed sale${data.purchases === 1 ? '' : 's'}` },
  ];

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Paid Performance Scorecard</p>
          <h2 className="mt-1 text-xl font-black text-brand-dark">Top-level paid advertising numbers</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
            Quick read for the normal paid-media metrics before getting into the deeper wrap-up tables. Use the Product Performance page for filterable product/category comparisons and the paid pages for channel detail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/spartaco/products" className="rounded-full bg-brand-dark px-4 py-2 text-xs font-black uppercase tracking-widest text-white">
            Product Performance
          </Link>
          <Link href="/dashboard/spartaco/all" className="rounded-full border border-gray-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-600">
            Paid Dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-gray-100">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-brand-dark">{card.value}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Product CPL</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">{fmtCurrencyDecimal(data.cpl)}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Cross-product benchmark</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">{data.benchmarkCpl ? fmtCurrencyDecimal(data.benchmarkCpl) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Benchmark read</p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-emerald-900">
              {data.cplDelta !== null ? `${cplBenchmarkLabel(data.cplDelta)} vs benchmark. ` : ''}{benchmarkText}{data.cplRank ? `; CPL rank #${data.cplRank}.` : '.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OutcomeAttributionSnapshot({ attribution }: { attribution: SpartacoProductWrapup['outcomeAttribution'] }) {
  const leadShare = share(attribution.paidTrackedLeads, attribution.totalTrackedLeads);
  return (
    <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Outcome Attribution</p>
          <h2 className="mt-2 text-xl font-black text-brand-dark">What ads directly drove — and what they helped create</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-gray-600">
          This separates directly attributable paid outcomes from the non-paid traffic lift that showed up while marketing was live. The goal is to show the digital impact we can measure: eyeballs, sessions, engagement, tracked leads, and online sales.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100 xl:col-span-2">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Scheduled demos / tracked leads</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-black text-brand-dark">{fmtNumber(attribution.totalTrackedLeads)}</p>
              <p className="mt-1 text-sm font-semibold text-gray-500">total known tracked leads</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-indigo-700">{fmtNumber(attribution.paidTrackedLeads)}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">paid-attributed</p>
            </div>
          </div>
          <AttributionBar
            paid={attribution.paidTrackedLeads}
            halo={attribution.nonPaidTrackedLeads ?? 0}
            total={attribution.totalTrackedLeads}
            haloLabel={attribution.nonPaidTrackedLeads === null ? 'Non-paid lead tracking unavailable' : 'Non-paid leads'}
          />
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            {fmtPercent(leadShare)} of currently tracked leads are paid-attributed. Non-paid lead counts are not separated in the current product-level data, so this card sticks to verified tracked conversions.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Sales signal</p>
          <p className="mt-3 text-4xl font-black text-brand-dark">{fmtNumber(attribution.totalOnlineSales)}</p>
          <p className="text-sm font-semibold text-gray-500">GA4 online sales</p>
          <div className="mt-4 rounded-2xl bg-indigo-50 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Ad-attributed sales</p>
            <p className="mt-1 text-2xl font-black text-indigo-800">{fmtNumber(attribution.paidAttributedSales)}</p>
          </div>
          <p className="mt-3 text-xs text-gray-500">Online sales are partial; this dashboard only reports GA4 online purchases/revenue currently available.</p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Product traffic</p>
          <p className="mt-3 text-4xl font-black text-brand-dark">{fmtNumber(attribution.totalSessions)}</p>
          <p className="text-sm font-semibold text-gray-500">total sessions during campaign</p>
          <AttributionBar paid={attribution.paidSessions} halo={attribution.haloSessions} total={attribution.totalSessions} />
          <p className="mt-3 text-xs text-gray-500">{fmtNumber(attribution.haloSessions)} non-paid sessions showed up while paid media was active.</p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-indigo-100">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Engaged traffic</p>
          <p className="mt-3 text-4xl font-black text-brand-dark">{fmtNumber(attribution.totalEngagedSessions)}</p>
          <p className="text-sm font-semibold text-gray-500">engaged sessions during campaign</p>
          <AttributionBar paid={attribution.paidEngagedSessions} halo={attribution.haloEngagedSessions} total={attribution.totalEngagedSessions} />
          <p className="mt-3 text-xs text-gray-500">Shows paid contribution plus the organic/halo engagement around the product.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-gray-700 ring-1 ring-indigo-100">
        <strong>Presentation framing:</strong> “Before marketing, product activity was lower. When the campaign turned on, paid media and email created measurable eyeballs, traffic, engaged sessions, and tracked leads. After the campaign, traffic settled back down — showing marketing’s measurable role in product attention.”
      </div>
    </section>
  );
}

function ComparisonBars({ periods }: { periods: WrapupPeriod[] }) {
  const metrics = [
    { label: 'Ad Spend', key: 'ad_cost' as const, fmt: fmtCurrency, color: 'bg-brand-dark' },
    { label: 'Ad Impressions', key: 'ad_impressions' as const, fmt: fmtCompact, color: 'bg-indigo-500' },
    { label: 'Ad Clicks', key: 'ad_clicks' as const, fmt: fmtNumber, color: 'bg-indigo-400' },
    { label: 'Tracked Leads', key: 'ad_conversions' as const, fmt: fmtNumber, color: 'bg-emerald-500' },
    { label: 'GA4 Sessions', key: 'ga4_sessions' as const, fmt: fmtNumber, color: 'bg-blue-500' },
    { label: 'Engaged Sessions', key: 'ga4_engaged_sessions' as const, fmt: fmtNumber, color: 'bg-sky-400' },
    { label: 'GSC Impressions', key: 'gsc_impressions' as const, fmt: fmtCompact, color: 'bg-orange-400' },
  ];

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-indigo-600 p-2 text-white"><BarChart3 className="h-4 w-4" /></div>
        <div>
          <h2 className="text-lg font-black text-brand-dark">Visual Lift by Period</h2>
          <p className="text-sm text-gray-500">Same locked windows, displayed as bars so the campaign-period lift is easier to see.</p>
        </div>
      </div>
      <div className="space-y-5">
        {metrics.map((m) => {
          const max = Math.max(...periods.map((p) => Number(p.summary[m.key]) || 0), 1);
          return (
            <div key={m.key}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">{m.label}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {periods.map((period) => {
                  const value = Number(period.summary[m.key]) || 0;
                  const width = Math.max(4, (value / max) * 100);
                  return (
                    <div key={`${m.key}-${period.key}`} className="rounded-2xl bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">{period.label}</span>
                        <span className="text-sm font-black text-brand-dark">{m.fmt(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div className={`h-full rounded-full ${m.color}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="rounded-3xl border border-violet-100 bg-violet-50/40 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-500">Email Activity</p>
              <p className="mt-1 text-sm text-gray-600">Act-On sends, opens, clicks, and rates by period.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {periods.map((period) => {
              const sent = period.summary.email_total_sent;
              const opens = period.summary.email_opens;
              const clicks = period.summary.email_clicks;
              const openRate = rate(opens, sent);
              const clickRate = rate(clicks, sent);
              return (
                <div key={`email-${period.key}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100">
                  <p className="text-[11px] font-black uppercase tracking-widest text-violet-400">{period.label}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sent</p>
                      <p className="text-lg font-black text-brand-dark">{fmtNumber(sent)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Opens</p>
                      <p className="text-lg font-black text-brand-dark">{fmtNumber(opens)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Open Rate</p>
                      <p className="text-lg font-black text-brand-dark">{sent > 0 ? fmtPercent(openRate) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Clicks</p>
                      <p className="text-lg font-black text-brand-dark">{fmtNumber(clicks)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Click Rate</p>
                      <p className="text-lg font-black text-brand-dark">{sent > 0 ? fmtPercent(clickRate) : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmailDetailTable({ emails }: { emails: SpartacoProductWrapup['emailDetails'] }) {
  if (emails.length === 0) return null;

  return (
    <section className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-500">Act-On Email Deep Dive</p>
          <h2 className="mt-1 text-lg font-black text-brand-dark">Email context and performance</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-gray-500">
          Only emails with Material Lifting/product-specific naming are included here. Generic Ronin service, show follow-up, or warranty-style emails are excluded unless the title or subject clearly ties them to the material lifting product.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {emails.slice(0, 3).map((email) => (
          <div key={email.id} className="rounded-2xl bg-violet-50/60 p-4 ring-1 ring-violet-100">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-600 ring-1 ring-violet-100">
                {email.relevance}
              </span>
              <span className="text-xs font-bold text-gray-500">{formatDate(email.date)}</span>
            </div>
            <p className="text-sm font-black leading-snug text-brand-dark">{email.subjectLine}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">{email.name}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sent</p>
                <p className="text-sm font-black text-brand-dark">{fmtCompact(email.totalSent)}</p>
              </div>
              <div className="rounded-xl bg-white p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Open</p>
                <p className="text-sm font-black text-brand-dark">{fmtPercent(email.openRate)}</p>
              </div>
              <div className="rounded-xl bg-white p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Click</p>
                <p className="text-sm font-black text-brand-dark">{fmtPercent(email.clickRate)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Email / subject</th>
              <th className="pb-3 pr-4">Relevance</th>
              <th className="pb-3 pr-4 text-right">Sent</th>
              <th className="pb-3 pr-4 text-right">Opens</th>
              <th className="pb-3 pr-4 text-right">Open rate</th>
              <th className="pb-3 pr-4 text-right">Clicks</th>
              <th className="pb-3 text-right">Click rate</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={`email-row-${email.id}`} className="border-b border-gray-50 last:border-0">
                <td className="py-3 pr-4 text-gray-500">{formatDate(email.date)}</td>
                <td className="py-3 pr-4">
                  <p className="font-black text-brand-dark">{email.subjectLine}</p>
                  <p className="mt-1 text-xs text-gray-500">{email.name}{email.emailId ? ` · ${email.emailId}` : ''}</p>
                </td>
                <td className="py-3 pr-4 text-xs font-bold text-violet-700">{email.relevance}</td>
                <td className="py-3 pr-4 text-right font-bold text-brand-dark">{fmtNumber(email.totalSent)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(email.opens)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtPercent(email.openRate)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(email.clicks)}</td>
                <td className="py-3 text-right font-bold text-brand-dark">{fmtPercent(email.clickRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetaAdPerformanceTable({ ads }: { ads: SpartacoProductWrapup['metaAds'] }) {
  if (ads.length === 0) return null;
  const topAds = ads.slice(0, 8);
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-slate-900 p-2 text-white"><TrendingUp className="h-4 w-4" /></div>
        <div>
          <h2 className="text-lg font-black text-brand-dark">Ads That Ran</h2>
          <p className="text-sm text-gray-500">Top Meta ads from the campaign, ranked by spend, with creative preview below.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
              <th className="pb-3 pr-4">Ad</th>
              <th className="pb-3 pr-4">Campaign</th>
              <th className="pb-3 pr-4 text-right">Spend</th>
              <th className="pb-3 pr-4 text-right">Impr.</th>
              <th className="pb-3 pr-4 text-right">Clicks</th>
              <th className="pb-3 pr-4 text-right">Leads</th>
              <th className="pb-3 text-right">CPL</th>
            </tr>
          </thead>
          <tbody>
            {topAds.map((ad) => {
              const cpl = ad.leads > 0 ? ad.cost / ad.leads : 0;
              return (
                <tr key={ad.adId || `${ad.campaignName}-${ad.adName}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-4 font-bold text-brand-dark">{ad.adName || ad.headline || 'Unnamed ad'}</td>
                  <td className="py-3 pr-4 text-gray-500">{ad.campaignName}</td>
                  <td className="py-3 pr-4 text-right font-bold text-brand-dark">{fmtCurrency(ad.cost)}</td>
                  <td className="py-3 pr-4 text-right text-gray-600">{fmtCompact(ad.impressions)}</td>
                  <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(ad.clicks)}</td>
                  <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(ad.leads)}</td>
                  <td className="py-3 text-right font-bold text-brand-dark">{cpl > 0 ? fmtCurrency(cpl) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function SpartacoProductWrapupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireClientAccess('spartaco');
  const { slug } = await params;
  const wrapup = await fetchSpartacoProductWrapup(slug);
  if (!wrapup) notFound();

  const data = wrapup as SpartacoProductWrapup;
  const during = data.periods.find((period) => period.key === 'during')!;
  const before = data.periods.find((period) => period.key === 'before')!;
  const after = data.periods.find((period) => period.key === 'after')!;

  const sessionsLift = before.summary.ga4_sessions > 0
    ? (during.summary.ga4_sessions - before.summary.ga4_sessions) / before.summary.ga4_sessions
    : null;
  const afterDrop = during.summary.ga4_sessions > 0
    ? (after.summary.ga4_sessions - during.summary.ga4_sessions) / during.summary.ga4_sessions
    : null;

  return (
    <div className="space-y-8 pb-20">
      <Link href="/dashboard/spartaco/wrapups" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand-dark">
        <ArrowLeft className="h-4 w-4" /> Back to Product Wrap-Ups
      </Link>

      <header className="rounded-[2rem] bg-gradient-to-br from-brand-dark to-slate-800 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/50">Spartaco Product Wrap-Up</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{data.config.campaignGroupName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">
              Campaign ran {formatDate(data.config.campaignStart)} – {formatDate(data.config.campaignEnd)}. Comparison windows are locked to 4 weeks before, campaign period, and 4 weeks after so the story stays consistent without manual date/filter changes.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/15">
            {data.config.status}
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/45">Brand</p>
            <p className="mt-1 font-black">{data.config.brand}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/45">Product</p>
            <p className="mt-1 font-black">{data.config.product}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/45">Campaigns included</p>
            <p className="mt-1 font-black">{data.config.campaignNames.length}</p>
          </div>
        </div>
      </header>

      <InsightBox title="Executive Summary" icon={ClipboardList}>
        <p className="text-base leading-relaxed text-gray-700">{data.config.executiveSummary}</p>
      </InsightBox>

      <TopLineDigitalScorecard period={during} />

      <ProductTrendChart
        data={data.fullWindowTimeSeries}
        grain={data.fullWindowTimeSeriesGrain}
        dateRange={`${formatDate(data.config.beforeStart)} – ${formatDate(data.config.afterEnd)}`}
        defaultActiveMetrics={['ga4_sessions', 'ga4_engaged_sessions', 'ad_conversions', 'ga4_purchases', 'ad_purchases']}
      />

      <PaidPerformanceScorecard data={data.paidOverview} />

      <OutcomeAttributionSnapshot attribution={data.outcomeAttribution} />

      <WrapupSourceMediumTable rows={data.sourceMediumRows} />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-black text-brand-dark">Locked Before / During / After View</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {data.periods.map((period) => <PeriodCard key={period.key} period={period} />)}
        </div>
      </section>

      <ComparisonBars periods={data.periods} />

      <EmailDetailTable emails={data.emailDetails} />

      <MetaAdPerformanceTable ads={data.metaAds} />
      <SpartacoMetaAdsSection brand={data.config.brand} mode="ALL" ads={data.metaAds} />

      <div className="grid gap-6 xl:grid-cols-2">
        <InsightBox title="What Changed While Ads Were On" icon={TrendingUp}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-indigo-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Session lift during campaign</p>
              <p className="mt-2 text-2xl font-black text-indigo-900">{liftLabel(sessionsLift)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">After-campaign traffic change</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{liftLabel(afterDrop)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            The page is designed to support Jim’s roll-up style: show what each channel contributed, then explain whether the activity improved during the campaign window. For this Ronin run, paid media drove the clearest lift and Act-On now shows one product-specific send inside the campaign window.
          </p>
        </InsightBox>

        <InsightBox title="Act-On Email + Channel Benchmark Lens" icon={Mail}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-violet-500">Product email sent</p>
              <p className="mt-2 text-2xl font-black text-violet-900">{fmtNumber(data.emailBenchmark.productSent)}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-violet-500">Product click rate</p>
              <p className="mt-2 text-2xl font-black text-violet-900">{data.emailBenchmark.productSent > 0 ? fmtPercent(data.emailBenchmark.productClickRate) : '—'}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            Comparable Ronin products with attributed Act-On sends in this campaign window: <strong>{data.emailBenchmark.comparableProducts}</strong>. Weighted benchmark click rate: <strong>{data.emailBenchmark.avgClickRate > 0 ? fmtPercent(data.emailBenchmark.avgClickRate) : '—'}</strong>. If this shows zero, the wrap-up should call out that email naming/product attribution needs review before saying email had no impact.
          </p>
        </InsightBox>

        <InsightBox title="Google Search Console Signal" icon={Search}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">Impressions lift</p>
              <p className="mt-2 text-xl font-black text-orange-900">{liftLabel(data.gscLift.duringVsBeforeImpressions)}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">Clicks lift</p>
              <p className="mt-2 text-xl font-black text-orange-900">{liftLabel(data.gscLift.duringVsBeforeClicks)}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">Keyword lift</p>
              <p className="mt-2 text-xl font-black text-orange-900">{liftLabel(data.gscLift.duringVsBeforeKeywords)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            This section tests whether marketing activity coincided with more search visibility. It looks for more GSC impressions, clicks, and ranked queries during or after the paid flight. If the data is thin, keep the caveat visible rather than implying organic search did nothing.
          </p>
        </InsightBox>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightBox title="Can Claim" icon={CheckCircle2}>
          <Bullets items={data.config.canClaim} tone="good" />
        </InsightBox>
        <InsightBox title="Cannot Claim Yet" icon={AlertTriangle}>
          <Bullets items={data.config.cannotClaim} tone="warning" />
        </InsightBox>
        <InsightBox title="Recommendations" icon={TrendingUp}>
          <Bullets items={data.config.recommendations} />
        </InsightBox>
      </div>

      <InsightBox title="Data Caveats" icon={AlertTriangle}>
        <Bullets items={data.config.caveats} tone="warning" />
      </InsightBox>
    </div>
  );
}
