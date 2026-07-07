import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { fetchDustinsSocialDashboardData, type DustinsSocialPost } from '@/services/dustins-social';

function num(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function shortTitle(value: string | null | undefined, length = 150) {
  const clean = (value ?? 'Untitled post').replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Phoenix' }).format(date);
}

function topPosts(posts: DustinsSocialPost[], metric: keyof Pick<DustinsSocialPost, 'impressions' | 'interactions' | 'comments' | 'views'>) {
  return [...posts].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)).slice(0, 8);
}

function postTypeRows(posts: DustinsSocialPost[]) {
  const groups = new Map<string, DustinsSocialPost[]>();
  posts.forEach((post) => {
    const key = post.post_type || 'Unknown';
    groups.set(key, [...(groups.get(key) ?? []), post]);
  });
  return [...groups.entries()].map(([type, rows]) => ({
    type,
    count: rows.length,
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    interactions: rows.reduce((sum, row) => sum + row.interactions, 0),
    comments: rows.reduce((sum, row) => sum + row.comments, 0),
    avgImpressions: Math.round(rows.reduce((sum, row) => sum + row.impressions, 0) / rows.length),
    avgInteractions: Number((rows.reduce((sum, row) => sum + row.interactions, 0) / rows.length).toFixed(1)),
  })).sort((a, b) => b.avgImpressions - a.avgImpressions);
}

async function requireDustinSocialAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const allowedEmails = (process.env.DUSTIN_SOCIAL_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = user.email?.toLowerCase() ?? '';

  if (allowedEmails.length > 0) {
    if (allowedEmails.includes(email)) return;
    redirect('/dashboard/eicagency');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const profileName = String(profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').toLowerCase();
  if (email.includes('dustin') || profileName.includes('dustin')) return;
  redirect('/dashboard/eicagency');
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export default async function DustinsSocialPage() {
  await requireClientAccess('eicagency');
  await requireDustinSocialAccess();

  const data = await fetchDustinsSocialDashboardData();
  const posts = data.posts;
  const daily = data.dailyMetrics;

  if (data.setupRequired) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">EIC Agency</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Dustin&apos;s Social</h1>
          <p className="mt-3 max-w-3xl text-gray-600">{data.setupMessage}</p>
        </section>
      </main>
    );
  }

  const totals = {
    posts: posts.length,
    impressions: posts.reduce((sum, row) => sum + row.impressions, 0),
    views: posts.reduce((sum, row) => sum + row.views, 0),
    interactions: posts.reduce((sum, row) => sum + row.interactions, 0),
    comments: posts.reduce((sum, row) => sum + row.comments, 0),
    saves: posts.reduce((sum, row) => sum + row.saves, 0),
    netFollows: daily.reduce((sum, row) => sum + row.net_follows, 0),
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
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">EIC Agency · Private</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950">Dustin&apos;s Social</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              Monthly personal-social reporting for planning content pillars, formats, and post angles. Current view: {dateRange}.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Posts" value={num(totals.posts)} />
          <Kpi label="Impressions" value={num(totals.impressions)} hint={`${num(Math.round(totals.impressions / Math.max(totals.posts, 1)))} avg/post`} />
          <Kpi label="Views" value={num(totals.views)} />
          <Kpi label="Interactions" value={num(totals.interactions)} hint={`${pct(totals.interactions, totals.impressions)} per impression`} />
          <Kpi label="Comments" value={num(totals.comments)} />
          <Kpi label="Net follows" value={num(totals.netFollows)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-950">Top posts by interactions</h2>
                  <p className="mt-1 text-sm text-gray-500">Use this list for monthly planning: repeat, remix, expand, or drop.</p>
                </div>
              </div>
              <div className="mt-5 divide-y divide-gray-100">
                {topPosts(posts, 'interactions').map((post) => (
                  <div key={post.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{post.post_type ?? 'Unknown'}</span>
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-brand-orange">{formatDate(post.publish_time)}</span>
                      </div>
                      <p className="text-sm font-bold leading-6 text-gray-950">{shortTitle(post.title)}</p>
                      {post.permalink ? <Link href={post.permalink} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-forest hover:underline">Open post <ExternalLink size={12} /></Link> : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600">
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.interactions)}</div><div>Interactions</div></div>
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.impressions)}</div><div>Impr.</div></div>
                      <div className="rounded-2xl bg-gray-50 p-3"><div className="text-lg text-gray-950">{num(post.comments)}</div><div>Comments</div></div>
                    </div>
                  </div>
                ))}
                {!posts.length ? <p className="py-8 text-sm text-gray-500">No post rows imported yet.</p> : null}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
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
                      <div><b className="block text-base text-gray-950">{num(row.avgInteractions)}</b>Avg int.</div>
                      <div><b className="block text-base text-gray-950">{num(row.comments)}</b>Comments</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-950">Imports</h2>
              <div className="mt-4 space-y-3">
                {data.imports.length ? data.imports.map((batch) => (
                  <div key={batch.id} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                    <p className="font-bold text-gray-950">{batch.source_label}</p>
                    <p>{batch.report_start_date && batch.report_end_date ? `${formatDate(batch.report_start_date)} – ${formatDate(batch.report_end_date)}` : 'No report range'}</p>
                    {batch.clickup_task_url ? <Link href={batch.clickup_task_url} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-forest hover:underline">Source task <ExternalLink size={12} /></Link> : null}
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
