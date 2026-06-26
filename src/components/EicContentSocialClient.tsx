'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, ExternalLink, Filter, LayoutList, Link2, Loader2, Search, Video, XCircle } from 'lucide-react';
import type { EicContentDashboardData } from '@/services/eic-content';

type Props = {
  data: EicContentDashboardData;
  approvePost: (postId: string) => Promise<void>;
  rejectPost: (postId: string) => Promise<void>;
};

const STATUS_LABELS: Record<string, string> = {
  needs_review: 'Needs review',
  approved: 'Approved',
  pushed_to_ghl: 'Pushed to GHL',
  scheduled: 'Scheduled',
  rejected: 'Rejected',
};

function statusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'pushed_to_ghl' || status === 'scheduled') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function safeDate(date: string | null, time: string | null) {
  if (!date) return 'Unscheduled';
  return `${date}${time ? ` · ${time}` : ''}`;
}

function hostLabel(url: string | null) {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Open'; }
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SetupCard({ message }: { message?: string }) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 lg:p-10">
      <section className="mx-auto max-w-5xl rounded-[2rem] border border-amber-100 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Setup required</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-950">EIC Social Content Hub</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          {message ?? 'The Supabase tables for the content flywheel are not available yet.'}
        </p>
        <div className="mt-6 rounded-2xl bg-gray-950 p-4 font-mono text-xs leading-6 text-gray-100">
          supabase/eic_content_flywheel.sql
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Once the tables exist, n8n should write episodes, assets, and posts here instead of making the spreadsheet the primary UI.
        </p>
      </section>
    </main>
  );
}

export default function EicContentSocialClient({ data, approvePost, rejectPost }: Props) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>(data.episodes[0]?.id ?? 'all');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(data.posts[0]?.id ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const episodesById = useMemo(() => new Map(data.episodes.map(e => [e.id, e])), [data.episodes]);
  const assetsById = useMemo(() => new Map(data.assets.map(a => [a.id, a])), [data.assets]);
  const platforms = useMemo(() => ['all', ...Array.from(new Set(data.posts.map(p => p.platform))).sort()], [data.posts]);
  const statuses = useMemo(() => ['all', ...Array.from(new Set(data.posts.map(p => p.status))).sort()], [data.posts]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.posts.filter(post => {
      const episode = episodesById.get(post.episode_id);
      const asset = post.asset_id ? assetsById.get(post.asset_id) : null;
      if (selectedEpisodeId !== 'all' && post.episode_id !== selectedEpisodeId) return false;
      if (platform !== 'all' && post.platform !== platform) return false;
      if (status !== 'all' && post.status !== status) return false;
      if (!q) return true;
      return [post.title, post.platform, post.post_type, post.story_phase, post.notes, episode?.title, asset?.title, asset?.file_name]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [assetsById, data.posts, episodesById, platform, query, selectedEpisodeId, status]);

  const selectedPost = useMemo(() => {
    if (!selectedPostId) return filteredPosts[0] ?? null;
    return data.posts.find(p => p.id === selectedPostId) ?? filteredPosts[0] ?? null;
  }, [data.posts, filteredPosts, selectedPostId]);

  const selectedEpisode = selectedPost ? episodesById.get(selectedPost.episode_id) : null;
  const selectedAsset = selectedPost?.asset_id ? assetsById.get(selectedPost.asset_id) : null;
  const needsReviewCount = data.posts.filter(p => p.status === 'needs_review').length;
  const clipPageCount = data.posts.filter(p => p.post_type.toLowerCase().includes('clip seo')).length;

  if (data.setupRequired) return <SetupCard message={data.setupMessage} />;

  function runAction(kind: 'approve' | 'reject', postId: string) {
    setPendingId(postId);
    startTransition(async () => {
      try {
        if (kind === 'approve') await approvePost(postId);
        else await rejectPost(postId);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">EIC Agency</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-950">Social Content Hub</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Episode-first approval workspace: review the main hub, clip SEO pages, and platform posts before they move to HighLevel.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600">
              <LayoutList size={16} /> {filteredPosts.length} visible posts
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Kpi label="Episodes" value={data.episodes.length} />
          <Kpi label="Posts / Pages" value={data.posts.length} />
          <Kpi label="Clip SEO Pages" value={clipPageCount} />
          <Kpi label="Needs Review" value={needsReviewCount} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Video size={16} className="text-brand-orange" /> Episodes
            </div>
            <button
              type="button"
              onClick={() => setSelectedEpisodeId('all')}
              className={`mb-2 w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${selectedEpisodeId === 'all' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              All episodes
              <span className="float-right text-xs opacity-70">{data.posts.length}</span>
            </button>
            <div className="space-y-2">
              {data.episodes.map(episode => {
                const count = data.posts.filter(p => p.episode_id === episode.id).length;
                return (
                  <button
                    type="button"
                    key={episode.id}
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${selectedEpisodeId === episode.id ? 'bg-brand-forest text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="text-sm font-bold leading-5">{episode.title}</div>
                    <div className="mt-1 flex items-center justify-between text-xs opacity-75">
                      <span>{episode.status}</span>
                      <span>{count} items</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex flex-col gap-4">
            <section className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                <label className="relative block">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search story phase, title, notes, asset..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-orange focus:bg-white"
                  />
                </label>
                <label className="relative block">
                  <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-orange focus:bg-white">
                    {platforms.map(p => <option key={p} value={p}>{p === 'all' ? 'All platforms' : p}</option>)}
                  </select>
                </label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-brand-orange focus:bg-white">
                  {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS_LABELS[s] ?? s}</option>)}
                </select>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Story / Post</th>
                        <th className="px-4 py-3">Platform</th>
                        <th className="px-4 py-3">Schedule</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPosts.map(post => (
                        <tr
                          key={post.id}
                          onClick={() => setSelectedPostId(post.id)}
                          className={`cursor-pointer transition hover:bg-orange-50/40 ${selectedPost?.id === post.id ? 'bg-orange-50/60' : 'bg-white'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-950">{post.title}</div>
                            <div className="mt-1 text-xs text-gray-500">{post.story_phase || 'No story phase'} · {post.post_type}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-700">{post.platform}</td>
                          <td className="px-4 py-3 text-gray-600">{safeDate(post.scheduled_date, post.scheduled_time)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}>
                              {STATUS_LABELS[post.status] ?? post.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredPosts.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">No posts match these filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
                {selectedPost ? (
                  <div className="flex h-full flex-col gap-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Selected item</p>
                      <h2 className="mt-2 text-xl font-bold leading-7 text-gray-950">{selectedPost.title}</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{selectedPost.platform}</span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{selectedPost.post_type}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(selectedPost.status)}`}>{STATUS_LABELS[selectedPost.status] ?? selectedPost.status}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                      <p><strong className="text-gray-900">Episode:</strong> {selectedEpisode?.title ?? selectedPost.episode_id}</p>
                      <p><strong className="text-gray-900">Story phase:</strong> {selectedPost.story_phase ?? '—'}</p>
                      <p><strong className="text-gray-900">Schedule:</strong> {safeDate(selectedPost.scheduled_date, selectedPost.scheduled_time)}</p>
                      {selectedAsset && <p><strong className="text-gray-900">Asset:</strong> {selectedAsset.title ?? selectedAsset.file_name}</p>}
                    </div>

                    {selectedPost.notes && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{selectedPost.notes}</p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      {selectedPost.copy_doc_url && (
                        <a href={selectedPost.copy_doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                          Open copy / page doc <ExternalLink size={16} />
                        </a>
                      )}
                      {selectedPost.asset_url && (
                        <a href={selectedPost.asset_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                          Open media asset <Video size={16} />
                        </a>
                      )}
                      {selectedPost.destination_url && (
                        <a href={selectedPost.destination_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                          Destination: {hostLabel(selectedPost.destination_url)} <Link2 size={16} />
                        </a>
                      )}
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-100 pt-5">
                      <button
                        type="button"
                        disabled={isPending && pendingId === selectedPost.id}
                        onClick={() => runAction('reject', selectedPost.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {isPending && pendingId === selectedPost.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={isPending && pendingId === selectedPost.id}
                        onClick={() => runAction('approve', selectedPost.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-forest px-4 py-3 text-sm font-bold text-white hover:bg-brand-forest/90 disabled:opacity-60"
                      >
                        {isPending && pendingId === selectedPost.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Approve
                      </button>
                    </div>
                    <p className="text-xs leading-5 text-gray-400">
                      Approval marks this row <strong>ready_to_push</strong> for the HighLevel scheduler handoff.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select a post to review details.</p>
                )}
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
