import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { fetchGoodGameOrganicSocialDashboardData, type GoodGameOrganicSocialPost } from '@/services/goodgame-organic-social';
import GoodGameOrganicSocialUpload from './GoodGameOrganicSocialUpload';

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
  accent = 'orange',
}: {
  label: string;
  value: string | number;
  hint?: string;
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
      <p className="mt-3 truncate text-3xl font-black leading-none tracking-tight text-gray-950 md:text-4xl" title={String(value)}>{value}</p>
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

export default async function GoodGameOrganicSocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('goodgame');
  const params = await searchParams;
  const data = await fetchGoodGameOrganicSocialDashboardData(params.brand ?? 'all');

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
  const totals = {
    posts: posts.length,
    impressions: posts.reduce((sum, row) => sum + row.impressions, 0),
    views: posts.reduce((sum, row) => sum + row.views, 0),
    interactions: posts.reduce((sum, row) => sum + row.interactions, 0),
    comments: posts.reduce((sum, row) => sum + row.comments, 0),
    netFollows: daily.reduce((sum, row) => sum + row.net_follows, 0),
    earnings: posts.reduce((sum, row) => sum + (row.approximate_earnings ?? 0), 0),
  };

  const latestImport = data.imports[0];
  const dateRange = latestImport?.report_start_date && latestImport?.report_end_date
    ? `${formatDate(latestImport.report_start_date)} – ${formatDate(latestImport.report_end_date)}`
    : posts.length
      ? `${formatDate(posts[posts.length - 1]?.publish_time)} – ${formatDate(posts[0]?.publish_time)}`
      : 'No imported data yet';

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
                <Link href="/dashboard/goodgame/organic-social" className={`rounded-full px-4 py-2 text-sm font-black ${data.selectedBrand === 'all' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All brands</Link>
                {data.brands.map((brand) => (
                  <Link key={brand} href={`/dashboard/goodgame/organic-social?brand=${encodeURIComponent(brand)}`} className={`rounded-full px-4 py-2 text-sm font-black ${data.selectedBrand === brand ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{brand}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Posts" value={num(totals.posts)} hint={`${data.selectedBrand === 'all' ? data.brands.length : 1} brand${(data.selectedBrand === 'all' ? data.brands.length : 1) === 1 ? '' : 's'}`} accent="slate" />
          <Kpi label="Impressions" value={compactNum(totals.impressions)} hint={`${num(totals.impressions)} total · ${compactNum(Math.round(totals.impressions / Math.max(totals.posts, 1)))} avg/post`} accent="orange" />
          <Kpi label="Views" value={compactNum(totals.views)} hint={`${num(totals.views)} total`} accent="orange" />
          <Kpi label="Interactions" value={compactNum(totals.interactions)} hint={`${pct(totals.interactions, totals.impressions)} per impression`} accent="forest" />
          <Kpi label="Comments" value={compactNum(totals.comments)} hint={`${num(totals.comments)} total`} accent="slate" />
          <Kpi label="Net follows" value={compactNum(totals.netFollows)} hint={`${num(totals.netFollows)} total`} accent="forest" />
          <Kpi label="Earnings" value={compactMoney(totals.earnings)} hint={money(totals.earnings)} accent="slate" />
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
