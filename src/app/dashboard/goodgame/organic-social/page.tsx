import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchGoodGameOrganicSocialDashboardData, type GoodGameOrganicSocialPost } from '@/services/goodgame-organic-social';
import GoodGameOrganicSocialUpload from './GoodGameOrganicSocialUpload';
import GoodGameOrganicSocialDateFilter from './GoodGameOrganicSocialDateFilter';
import GoodGameOrganicSocialTimeSeries from './GoodGameOrganicSocialTimeSeries';

export const dynamic = 'force-dynamic';

function num(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
}

function compactNum(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function compactMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Phoenix' }).format(date);
}

function shortTitle(value: string | null | undefined, length = 150) {
  const clean = (value ?? 'Untitled post').replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function Kpi({
  label,
  value,
  hint,
  trend,
  accent = 'orange',
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  accent?: 'orange' | 'forest' | 'slate';
}) {
  const accentClasses = {
    orange: 'from-orange-50 to-white text-brand-orange ring-orange-100',
    forest: 'from-emerald-50 to-white text-brand-forest ring-emerald-100',
    slate: 'from-slate-50 to-white text-slate-600 ring-slate-100',
  }[accent];

  return (
    <div className={`min-w-0 rounded-[1.5rem] border border-gray-100 bg-gradient-to-br ${accentClasses} p-5 shadow-sm ring-1`}>
      <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <div className="mt-3 flex min-w-0 items-baseline gap-2">
        <p className="truncate text-3xl font-black leading-none tracking-tight text-gray-950 md:text-4xl" title={String(value)}>{value}</p>
        {trend ? <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : trend.startsWith('-') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{trend}</span> : null}
      </div>
      {hint ? <p className="mt-2 min-h-4 truncate text-xs font-semibold text-gray-500">{hint}</p> : <p className="mt-2 min-h-4 text-xs">&nbsp;</p>}
    </div>
  );
}

function topPosts(posts: GoodGameOrganicSocialPost[], metric: keyof Pick<GoodGameOrganicSocialPost, 'impressions' | 'interactions' | 'views' | 'comments'>) {
  return [...posts].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)).slice(0, 10);
}

function brandRows(posts: GoodGameOrganicSocialPost[]) {
  const groups = new Map<string, GoodGameOrganicSocialPost[]>();
  posts.forEach((post) => groups.set(post.brand, [...(groups.get(post.brand) ?? []), post]));
  return Array.from(groups.entries()).map(([brand, rows]) => {
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const interactions = rows.reduce((sum, row) => sum + row.interactions, 0);
    const views = rows.reduce((sum, row) => sum + row.views, 0);
    return { brand, posts: rows.length, impressions, interactions, views, engagementRate: pct(interactions, impressions) };
  }).sort((a, b) => b.impressions - a.impressions);
}

function postTypeRows(posts: GoodGameOrganicSocialPost[]) {
  const groups = new Map<string, GoodGameOrganicSocialPost[]>();
  posts.forEach((post) => {
    const key = post.post_type || 'Unknown';
    groups.set(key, [...(groups.get(key) ?? []), post]);
  });
  return Array.from(groups.entries()).map(([type, rows]) => ({
    type,
    count: rows.length,
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    interactions: rows.reduce((sum, row) => sum + row.interactions, 0),
    views: rows.reduce((sum, row) => sum + row.views, 0),
    avgImpressions: Math.round(rows.reduce((sum, row) => sum + row.impressions, 0) / rows.length),
  })).sort((a, b) => b.avgImpressions - a.avgImpressions);
}

type Totals = {
  posts: number;
  impressions: number;
  views: number;
  interactions: number;
  comments: number;
  netFollows: number;
  earnings: number;
};

function summarize(posts: GoodGameOrganicSocialPost[], daily: { net_follows: number }[]): Totals {
  return {
    posts: posts.length,
    impressions: posts.reduce((sum, row) => sum + row.impressions, 0),
    views: posts.reduce((sum, row) => sum + row.views, 0),
    interactions: posts.reduce((sum, row) => sum + row.interactions, 0),
    comments: posts.reduce((sum, row) => sum + row.comments, 0),
    netFollows: daily.reduce((sum, row) => sum + row.net_follows, 0),
    earnings: posts.reduce((sum, row) => sum + (row.approximate_earnings ?? 0), 0),
  };
}

function trend(current: number, previous: number | undefined) {
  if (previous === undefined) return undefined;
  if (!previous && !current) return '0%';
  if (!previous) return '+100%';
  const value = ((current - previous) / Math.abs(previous)) * 100;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

function dimensionRows(posts: GoodGameOrganicSocialPost[], getLabel: (post: GoodGameOrganicSocialPost) => string) {
  const groups = new Map<string, GoodGameOrganicSocialPost[]>();
  posts.forEach((post) => {
    const key = getLabel(post) || 'Unknown';
    groups.set(key, [...(groups.get(key) ?? []), post]);
  });
  return Array.from(groups.entries()).map(([label, rows]) => {
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const interactions = rows.reduce((sum, row) => sum + row.interactions, 0);
    const views = rows.reduce((sum, row) => sum + row.views, 0);
    const comments = rows.reduce((sum, row) => sum + row.comments, 0);
    return {
      label,
      posts: rows.length,
      impressions,
      views,
      interactions,
      comments,
      engagementRate: impressions > 0 ? (interactions / impressions) * 100 : 0,
      avgImpressions: Math.round(impressions / Math.max(rows.length, 1)),
      avgInteractions: Math.round(interactions / Math.max(rows.length, 1)),
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

function formatLabel(post: GoodGameOrganicSocialPost) {
  const type = (post.post_type ?? '').toLowerCase();
  if (type.includes('reel') || (post.duration_seconds ?? 0) > 0) return 'Video / Reel';
  if (type.includes('content')) return 'Static / Link / Photo';
  return post.post_type ?? 'Unknown';
}

function durationBucket(post: GoodGameOrganicSocialPost) {
  const seconds = post.duration_seconds ?? 0;
  if (seconds <= 0) return 'No video duration';
  if (seconds < 15) return 'Short video (<15s)';
  if (seconds < 30) return 'Mid video (15–29s)';
  if (seconds < 60) return 'Long video (30–59s)';
  return '60s+ video';
}

function DimensionTable({ title, note, rows }: { title: string; note: string; rows: ReturnType<typeof dimensionRows> }) {
  return (
    <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{note}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-gray-400">
            <tr><th className="py-3 pr-4">Dimension</th><th className="py-3 pr-4">Posts</th><th className="py-3 pr-4">Impressions</th><th className="py-3 pr-4">Views</th><th className="py-3 pr-4">Engagement</th><th className="py-3 pr-4">Eng. rate</th><th className="py-3 pr-4">Avg impr.</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
            {rows.map((row) => <tr key={row.label}><td className="py-3 pr-4 text-gray-950">{row.label}</td><td className="py-3 pr-4">{num(row.posts)}</td><td className="py-3 pr-4">{num(row.impressions)}</td><td className="py-3 pr-4">{num(row.views)}</td><td className="py-3 pr-4">{num(row.interactions)}</td><td className="py-3 pr-4">{row.engagementRate.toFixed(1)}%</td><td className="py-3 pr-4">{num(row.avgImpressions)}</td></tr>)}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="mt-4 text-sm text-gray-500">No rows match this filter.</p> : null}
    </section>
  );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

function resolveDateFilter(params: Record<string, string | undefined>) {
  const range = params.range ?? 'last28';
  if (range === 'all') return { range, start: '', end: '' };
  if (range === 'custom') return { range, start: params.start ?? '', end: params.end ?? '' };
  if (range === 'last7') return { range, start: dateDaysAgo(6), end: isoDate(new Date()) };
  if (range === 'last90') return { range, start: dateDaysAgo(89), end: isoDate(new Date()) };
  return { range: 'last28', start: dateDaysAgo(27), end: isoDate(new Date()) };
}

function previousDateFilter(filter: { start: string; end: string }) {
  if (!filter.start || !filter.end) return null;
  const start = new Date(`${filter.start}T12:00:00`);
  const end = new Date(`${filter.end}T12:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return { start: isoDate(previousStart), end: isoDate(previousEnd) };
}

export default async function GoodGameOrganicSocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = await searchParams;
  const dateFilter = resolveDateFilter(params);
  const previousFilter = previousDateFilter(dateFilter);
  const [data, previousData] = await Promise.all([
    fetchGoodGameOrganicSocialDashboardData({
      brand: params.brand ?? 'all',
      start: dateFilter.start || null,
      end: dateFilter.end || null,
    }),
    previousFilter
      ? fetchGoodGameOrganicSocialDashboardData({
        brand: params.brand ?? 'all',
        start: previousFilter.start,
        end: previousFilter.end,
      })
      : Promise.resolve(null),
  ]);

  if (data.setupRequired) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Good Game</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Organic Social</h1>
          <p className="mt-3 max-w-3xl text-gray-600">{data.setupMessage}</p>
        </section>
      </main>
    );
  }

  const posts = data.posts;
  const daily = data.dailyMetrics;
  const totals = summarize(posts, daily);
  const previousTotals = previousData && !previousData.setupRequired ? summarize(previousData.posts, previousData.dailyMetrics) : undefined;
  const previousRange = previousFilter ? `${formatDate(previousFilter.start)} – ${formatDate(previousFilter.end)}` : null;

  const latestImport = data.imports[0];
  const dateRange = dateFilter.start && dateFilter.end
    ? `${formatDate(dateFilter.start)} – ${formatDate(dateFilter.end)}`
    : latestImport?.report_start_date && latestImport?.report_end_date
      ? `${formatDate(latestImport.report_start_date)} – ${formatDate(latestImport.report_end_date)}`
      : posts.length
        ? `${formatDate(posts[posts.length - 1]?.publish_time)} – ${formatDate(posts[0]?.publish_time)}`
        : 'No imported data yet';

  function brandHref(brand?: string) {
    const query = new URLSearchParams();
    if (brand) query.set('brand', brand);
    if (dateFilter.range !== 'last28') query.set('range', dateFilter.range);
    if (dateFilter.range === 'custom') {
      if (dateFilter.start) query.set('start', dateFilter.start);
      if (dateFilter.end) query.set('end', dateFilter.end);
    }
    const qs = query.toString();
    return qs ? `/dashboard/goodgame/organic-social?${qs}` : '/dashboard/goodgame/organic-social';
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="p-6 lg:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Good Game</p>
            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-gray-950">Organic Social</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                  CSV-powered organic social reporting by brand. Current view: {dateRange}. Uploads refresh the dashboard immediately after import.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={brandHref()} className={`rounded-full px-4 py-2 text-sm font-black ${data.selectedBrand === 'all' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All brands</Link>
                {data.brands.map((brand) => (
                  <Link key={brand} href={brandHref(brand)} className={`rounded-full px-4 py-2 text-sm font-black ${data.selectedBrand === brand ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{brand}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <GoodGameOrganicSocialDateFilter range={dateFilter.range} start={dateFilter.start} end={dateFilter.end} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Posts" value={num(totals.posts)} hint={`${data.selectedBrand === 'all' ? data.brands.length : 1} brand${(data.selectedBrand === 'all' ? data.brands.length : 1) === 1 ? '' : 's'}${previousRange ? ` · vs ${previousRange}` : ''}`} trend={trend(totals.posts, previousTotals?.posts)} accent="slate" />
          <Kpi label="Impressions" value={compactNum(totals.impressions)} hint={`${num(totals.impressions)} total · ${compactNum(Math.round(totals.impressions / Math.max(totals.posts, 1)))} avg/post`} trend={trend(totals.impressions, previousTotals?.impressions)} accent="orange" />
          <Kpi label="Views" value={compactNum(totals.views)} hint={`${num(totals.views)} total`} trend={trend(totals.views, previousTotals?.views)} accent="orange" />
          <Kpi label="Interactions" value={compactNum(totals.interactions)} hint={`${pct(totals.interactions, totals.impressions)} per impression`} trend={trend(totals.interactions, previousTotals?.interactions)} accent="forest" />
          <Kpi label="Comments" value={compactNum(totals.comments)} hint={`${num(totals.comments)} total`} trend={trend(totals.comments, previousTotals?.comments)} accent="slate" />
          <Kpi label="Net follows" value={compactNum(totals.netFollows)} hint={`${num(totals.netFollows)} total`} trend={trend(totals.netFollows, previousTotals?.netFollows)} accent="forest" />
          <Kpi label="Earnings" value={compactMoney(totals.earnings)} hint={money(totals.earnings)} trend={trend(totals.earnings, previousTotals?.earnings)} accent="slate" />
        </section>

        <GoodGameOrganicSocialTimeSeries rows={daily} dateRange={dateRange} />

        <section className="grid gap-6 xl:grid-cols-2">
          <DimensionTable title="What is driving eyeballs?" note="Post-level roll-up sorted by impressions so the biggest reach drivers stay at the top." rows={dimensionRows(posts, (post) => post.post_type ?? 'Unknown content type')} />
          <DimensionTable title="Format mix" note="Video/Reel vs static/link/photo content, using post type and duration from the export." rows={dimensionRows(posts, formatLabel)} />
          <DimensionTable title="Video duration" note="Buckets videos by length to show whether short or longer clips are carrying views and engagement." rows={dimensionRows(posts, durationBucket)} />
          <DimensionTable title="Page / placement" note="Breaks performance out by page name so multi-brand uploads can show where reach is coming from." rows={dimensionRows(posts, (post) => post.page_name ?? post.brand)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-gray-950">Top posts by interactions</h2>
              <p className="mt-1 text-sm text-gray-500">Use this list to spot which posts, reels, and content formats are carrying organic reach.</p>
              <div className="mt-5 divide-y divide-gray-100">
                {topPosts(posts, 'interactions').map((post) => (
                  <div key={post.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{post.brand}</span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{post.post_type ?? 'Unknown'}</span>
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-brand-orange">{formatDate(post.publish_time)}</span>
                      </div>
                      <p className="text-sm font-bold leading-6 text-gray-950">{shortTitle(post.title)}</p>
                      {post.permalink ? <Link href={post.permalink} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-forest hover:underline">Open post <ExternalLink size={12} /></Link> : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600">
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.interactions)}</div><div>Interactions</div></div>
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.impressions)}</div><div>Impr.</div></div>
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.views)}</div><div>Views</div></div>
                    </div>
                  </div>
                ))}
                {!posts.length ? <p className="py-8 text-sm text-gray-500">No post rows imported yet.</p> : null}
              </div>
            </section>

            {data.selectedBrand === 'all' ? (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black text-gray-950">Brand roll-up</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-widest text-gray-400">
                      <tr><th className="py-3 pr-4">Brand</th><th className="py-3 pr-4">Posts</th><th className="py-3 pr-4">Impressions</th><th className="py-3 pr-4">Views</th><th className="py-3 pr-4">Interactions</th><th className="py-3 pr-4">Eng. rate</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
                      {brandRows(posts).map((row) => <tr key={row.brand}><td className="py-3 pr-4 text-gray-950">{row.brand}</td><td className="py-3 pr-4">{num(row.posts)}</td><td className="py-3 pr-4">{num(row.impressions)}</td><td className="py-3 pr-4">{num(row.views)}</td><td className="py-3 pr-4">{num(row.interactions)}</td><td className="py-3 pr-4">{row.engagementRate}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
            <GoodGameOrganicSocialUpload />

            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-950">Format performance</h2>
              <div className="mt-4 space-y-3">
                {postTypeRows(posts).map((row) => (
                  <div key={row.type} className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-gray-950">{row.type}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-600">{row.count} posts</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <div><b className="block text-base text-gray-950">{num(row.avgImpressions)}</b>Avg impr.</div>
                      <div><b className="block text-base text-gray-950">{num(row.interactions)}</b>Interactions</div>
                      <div><b className="block text-base text-gray-950">{num(row.views)}</b>Views</div>
                    </div>
                  </div>
                ))}
                {!posts.length ? <p className="text-sm text-gray-500">No format rows yet.</p> : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-950">Imports</h2>
              <div className="mt-4 space-y-3">
                {data.imports.length ? data.imports.map((batch) => (
                  <div key={batch.id} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                    <p className="font-bold text-gray-950">{batch.source_label}</p>
                    <p>{batch.report_start_date && batch.report_end_date ? `${formatDate(batch.report_start_date)} – ${formatDate(batch.report_end_date)}` : 'No report range'}</p>
                    <p className="mt-1 text-xs text-gray-500">{batch.content_file_names?.length ?? 0} content file(s), {batch.profile_file_names?.length ?? 0} activity file(s)</p>
                  </div>
                )) : <p className="text-sm text-gray-500">No imports recorded yet.</p>}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
