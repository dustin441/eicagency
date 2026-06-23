import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Mail, Search, TrendingUp, UserRoundPen, AlertTriangle } from 'lucide-react';
import { fetchSpartacoProductWrapup, type SpartacoProductWrapup, type WrapupPeriod } from '@/services/spartaco-product-wrapups';
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

function liftLabel(value: number | null) {
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
              Campaign ran {formatDate(data.config.campaignStart)} – {formatDate(data.config.campaignEnd)}. Comparison windows are locked to 4 weeks before, campaign period, and 4 weeks after so Bob does not need to adjust filters or dates.
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

      <section>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-black text-brand-dark">Locked Before / During / After View</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {data.periods.map((period) => <PeriodCard key={period.key} period={period} />)}
        </div>
      </section>

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
            The page is designed to support Jim’s roll-up style: show what each channel contributed, then explain whether the activity improved during the campaign window. For this Ronin run, paid media drove the clearest lift while Act-On/social attribution are currently data-coverage caveats.
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
            This section is where we test the “ads create more search activity” hypothesis. It should look for more GSC impressions, clicks, and ranked queries during or after the paid flight. If the data is thin, keep the caveat visible rather than implying organic search did nothing.
          </p>
        </InsightBox>

        <InsightBox title="Bob Sales Context Input — Iteration 2" icon={UserRoundPen}>
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-700">Form placeholder</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Next iteration: add a secure form here so Bob can enter offline sales, distributor feedback, quote/demo context, lead quality notes, and external factors. After save, the page can rerun the AI summary using both digital data and Bob’s sales-side inputs.
            </p>
          </div>
          <div className="mt-4">
            <Bullets items={data.config.bobPrompts} />
          </div>
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
