'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  PlayCircle,
  Search,
  Send,
  UploadCloud,
  Video,
  XCircle,
} from 'lucide-react';
import type { EicContentDashboardData, EicContentEpisode, EicContentPost } from '@/services/eic-content';

type UpdatePayload = {
  title?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  platform?: string;
  notes?: string | null;
  destination_url?: string | null;
};

type Props = {
  data: EicContentDashboardData;
  approvePost: (postId: string) => Promise<void>;
  rejectPost: (postId: string) => Promise<void>;
  updatePost: (postId: string, updates: UpdatePayload) => Promise<void>;
};

type QueueKey = 'all' | 'needs_review' | 'missing_assets' | 'ready_to_schedule' | 'approved' | 'scheduled';

type Readiness = {
  missing: string[];
  warnings: string[];
  isReady: boolean;
};

const statusLabels: Record<string, string> = {
  needs_review: 'Needs review',
  draft: 'Draft',
  changes_requested: 'Changes requested',
  copy_approved: 'Copy approved',
  media_approved: 'Media approved',
  approved: 'Approved',
  ready_to_schedule: 'Ready to schedule',
  rejected: 'Rejected',
  pushed_to_ghl: 'Pushed to GHL',
  scheduled: 'Scheduled',
  published: 'Published',
};

function statusClass(status: string) {
  if (['approved', 'ready_to_schedule', 'copy_approved', 'media_approved'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'rejected' || status === 'changes_requested') return 'bg-red-50 text-red-700 border-red-100';
  if (status === 'scheduled' || status === 'pushed_to_ghl' || status === 'published') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function when(date: string | null, time: string | null) {
  return date ? `${date}${time ? ` · ${time}` : ''}` : 'Unscheduled';
}

function postNeedsMedia(post: EicContentPost) {
  const combined = `${post.platform} ${post.post_type}`.toLowerCase();
  return ['instagram', 'youtube', 'short', 'video', 'clip'].some((word) => combined.includes(word));
}

function readinessFor(post: EicContentPost): Readiness {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!post.copy_doc_url) missing.push('Copy doc');
  if (postNeedsMedia(post) && !post.asset_url && !post.asset_id) missing.push('Media asset');
  if (!post.scheduled_date) missing.push('Schedule date');
  if (!post.scheduled_time) warnings.push('Schedule time');
  if (!post.destination_url && ['blog', 'linkedin', 'facebook', 'instagram', 'email', 'newsletter'].includes(post.platform.toLowerCase())) {
    warnings.push('Destination URL');
  }
  if (post.status === 'rejected' || post.approval_status === 'rejected') warnings.push('Rejected');

  return { missing, warnings, isReady: missing.length === 0 && post.status !== 'rejected' };
}

function queueFor(post: EicContentPost): QueueKey {
  const readiness = readinessFor(post);
  if (['scheduled', 'pushed_to_ghl', 'published'].includes(post.status)) return 'scheduled';
  if (['approved', 'ready_to_schedule'].includes(post.status) || post.ghl_status === 'ready_to_push') return 'approved';
  if (!readiness.isReady) return 'missing_assets';
  if (post.status === 'draft' || post.status === 'needs_review') return 'needs_review';
  return 'ready_to_schedule';
}

function Kpi({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'amber' | 'emerald' | 'blue' }) {
  const toneClass = tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : tone === 'blue' ? 'text-blue-700' : 'text-gray-900';
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function episodeScore(posts: EicContentPost[]) {
  if (!posts.length) return 0;
  const ready = posts.filter((post) => readinessFor(post).isReady).length;
  return Math.round((ready / posts.length) * 100);
}

function missingSummary(posts: EicContentPost[]) {
  const counts = new Map<string, number>();
  posts.forEach((post) => readinessFor(post).missing.concat(readinessFor(post).warnings).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1)));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default function EicContentSocialClient({ data, approvePost, rejectPost, updatePost }: Props) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(data.episodes[0]?.id ?? 'all');
  const [platform, setPlatform] = useState('all');
  const [queue, setQueue] = useState<QueueKey>('needs_review');
  const [query, setQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState(data.posts[0]?.id ?? '');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', scheduled_date: '', scheduled_time: '', notes: '', destination_url: '' });

  const episodes = useMemo(() => new Map(data.episodes.map((episode) => [episode.id, episode])), [data.episodes]);
  const assets = useMemo(() => new Map(data.assets.map((asset) => [asset.id, asset])), [data.assets]);
  const platforms = useMemo(() => ['all', ...Array.from(new Set(data.posts.map((post) => post.platform))).sort()], [data.posts]);
  const episodePosts = useMemo(() => data.posts.filter((post) => selectedEpisodeId === 'all' || post.episode_id === selectedEpisodeId), [data.posts, selectedEpisodeId]);
  const queueCounts = useMemo(() => {
    const base: Record<QueueKey, number> = { all: episodePosts.length, needs_review: 0, missing_assets: 0, ready_to_schedule: 0, approved: 0, scheduled: 0 };
    episodePosts.forEach((post) => { base[queueFor(post)] += 1; });
    return base;
  }, [episodePosts]);
  const posts = useMemo(() => data.posts.filter((post) => {
    const q = query.trim().toLowerCase();
    const episode = episodes.get(post.episode_id);
    const asset = post.asset_id ? assets.get(post.asset_id) : null;
    if (selectedEpisodeId !== 'all' && post.episode_id !== selectedEpisodeId) return false;
    if (platform !== 'all' && post.platform !== platform) return false;
    if (queue !== 'all' && queueFor(post) !== queue) return false;
    if (!q) return true;
    return [post.title, post.platform, post.post_type, post.story_phase, post.notes, episode?.title, asset?.title, asset?.file_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [assets, data.posts, episodes, platform, query, queue, selectedEpisodeId]);
  const selected = posts.find((post) => post.id === selectedPostId) ?? posts[0] ?? null;
  const selectedEpisode = selected ? episodes.get(selected.episode_id) : null;
  const selectedAsset = selected?.asset_id ? assets.get(selected.asset_id) : null;
  const selectedReadiness = selected ? readinessFor(selected) : null;
  const needsReview = data.posts.filter((post) => post.status === 'needs_review' || post.status === 'draft').length;
  const missingAssets = data.posts.filter((post) => !readinessFor(post).isReady).length;
  const approved = data.posts.filter((post) => ['approved', 'ready_to_schedule', 'pushed_to_ghl', 'scheduled'].includes(post.status) || post.ghl_status === 'ready_to_push').length;
  const clipPages = data.posts.filter((post) => post.post_type.toLowerCase().includes('clip seo')).length;

  if (data.setupRequired) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">Social Content Hub setup required</h1>
          <p className="mt-3 text-gray-600">{data.setupMessage}</p>
        </section>
      </main>
    );
  }

  function selectEpisode(id: string) {
    setSelectedEpisodeId(id);
    const first = data.posts.find((post) => id === 'all' || post.episode_id === id);
    if (first) setSelectedPostId(first.id);
    setEditing(false);
  }

  function startEdit() {
    if (!selected) return;
    setDraft({
      title: selected.title,
      scheduled_date: selected.scheduled_date ?? '',
      scheduled_time: selected.scheduled_time ?? '',
      notes: selected.notes ?? '',
      destination_url: selected.destination_url ?? '',
    });
    setEditing(true);
  }

  function run(kind: 'approve' | 'reject' | 'save', id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        if (kind === 'approve') await approvePost(id);
        if (kind === 'reject') await rejectPost(id);
        if (kind === 'save') {
          await updatePost(id, {
            title: draft.title,
            scheduled_date: draft.scheduled_date || null,
            scheduled_time: draft.scheduled_time || null,
            notes: draft.notes || null,
            destination_url: draft.destination_url || null,
          });
          setEditing(false);
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">EIC Agency</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-950">Podcast Content Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Drop files, generate an episode package, review missing pieces, approve content, then hand clean rows to HighLevel scheduling.
              </p>
            </div>
            <Link href="/dashboard/eicagency/social/drop" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-forest/90">
              <UploadCloud size={18} /> Drop podcast files
            </Link>
          </div>
          <div className="grid border-t border-gray-100 bg-gray-50/70 md:grid-cols-4">
            <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">1. Intake</p><p className="mt-1 text-sm text-gray-600">Transcript, video, clips, thumbnails</p></div>
            <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">2. Generate</p><p className="mt-1 text-sm text-gray-600">Blog, social, YouTube, newsletter</p></div>
            <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">3. Approve</p><p className="mt-1 text-sm text-gray-600">Validate copy, media, URLs, schedule</p></div>
            <div className="p-4"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">4. Schedule</p><p className="mt-1 text-sm text-gray-600">Ready rows push to HighLevel</p></div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <Kpi label="Episodes" value={data.episodes.length} />
          <Kpi label="Posts / Pages" value={data.posts.length} />
          <Kpi label="Clip SEO Pages" value={clipPages} tone="blue" />
          <Kpi label="Needs Review" value={needsReview} tone="amber" />
          <Kpi label="Approved / Ready" value={approved} tone="emerald" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Video size={16} /> Episode packages</div>
              {missingAssets > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{missingAssets} gaps</span>}
            </div>
            <EpisodeButton label="All episodes" count={data.posts.length} score={episodeScore(data.posts)} selected={selectedEpisodeId === 'all'} onClick={() => selectEpisode('all')} />
            {data.episodes.map((episode) => {
              const related = data.posts.filter((post) => post.episode_id === episode.id);
              return <EpisodeButton key={episode.id} episode={episode} label={episode.title} count={related.length} score={episodeScore(related)} selected={selectedEpisodeId === episode.id} onClick={() => selectEpisode(episode.id)} />;
            })}

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Missing pieces</p>
              <div className="mt-3 space-y-2">
                {missingSummary(episodePosts).length ? missingSummary(episodePosts).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-bold text-gray-900">{count}</span></div>
                )) : <p className="text-sm text-emerald-700">Everything in this view has the required fields.</p>}
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-4">
            <section className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1fr_190px]">
                <label className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm" placeholder="Search posts, story phase, assets..." />
                </label>
                <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
                  {platforms.map((item) => <option key={item} value={item}>{item === 'all' ? 'All platforms' : item}</option>)}
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <QueueButton label="All" value="all" active={queue === 'all'} count={queueCounts.all} onClick={setQueue} />
                <QueueButton label="Needs review" value="needs_review" active={queue === 'needs_review'} count={queueCounts.needs_review} onClick={setQueue} />
                <QueueButton label="Missing pieces" value="missing_assets" active={queue === 'missing_assets'} count={queueCounts.missing_assets} onClick={setQueue} />
                <QueueButton label="Ready" value="ready_to_schedule" active={queue === 'ready_to_schedule'} count={queueCounts.ready_to_schedule} onClick={setQueue} />
                <QueueButton label="Approved" value="approved" active={queue === 'approved'} count={queueCounts.approved} onClick={setQueue} />
                <QueueButton label="Scheduled" value="scheduled" active={queue === 'scheduled'} count={queueCounts.scheduled} onClick={setQueue} />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
              <div className="space-y-3">
                {posts.length ? posts.map((post) => {
                  const episode = episodes.get(post.episode_id);
                  const readiness = readinessFor(post);
                  return (
                    <button key={post.id} onClick={() => { setSelectedPostId(post.id); setEditing(false); }} className={`w-full rounded-[1.5rem] border p-4 text-left shadow-sm transition hover:border-brand-orange/40 hover:bg-orange-50/30 ${selected?.id === post.id ? 'border-brand-orange bg-orange-50/70' : 'border-gray-100 bg-white'}`}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{post.platform}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}>{statusLabels[post.status] ?? post.status}</span>
                            {readiness.isReady ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} /> Ready</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><AlertTriangle size={13} /> Needs {readiness.missing.length}</span>}
                          </div>
                          <h3 className="mt-2 text-base font-bold leading-6 text-gray-950">{post.title}</h3>
                          <p className="mt-1 text-sm text-gray-500">{episode?.title ?? post.episode_id} · {post.story_phase || 'No phase'} · {post.post_type}</p>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">{when(post.scheduled_date, post.scheduled_time)}</div>
                      </div>
                      {(readiness.missing.length > 0 || readiness.warnings.length > 0) && <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">{readiness.missing.concat(readiness.warnings).map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-100">{item}</span>)}</div>}
                    </button>
                  );
                }) : <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">No content items match this queue.</div>}
              </div>

              <aside className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
                {selected ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Selected item</p>
                      <h2 className="mt-2 text-xl font-bold leading-7 text-gray-950">{selected.title}</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{selected.platform}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(selected.status)}`}>{statusLabels[selected.status] ?? selected.status}</span>
                      </div>
                    </div>

                    {selectedReadiness && (
                      <div className={`rounded-2xl p-4 ${selectedReadiness.isReady ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                        <p className="flex items-center gap-2 text-sm font-bold">{selectedReadiness.isReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {selectedReadiness.isReady ? 'Ready for approval' : 'Missing before handoff'}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                          {selectedReadiness.missing.concat(selectedReadiness.warnings).length ? selectedReadiness.missing.concat(selectedReadiness.warnings).map((item) => <span key={item} className="rounded-full bg-white/70 px-2.5 py-1">{item}</span>) : <span className="rounded-full bg-white/70 px-2.5 py-1">All required fields present</span>}
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                      <p><b>Episode:</b> {selectedEpisode?.title ?? selected.episode_id}</p>
                      <p><b>Story phase:</b> {selected.story_phase ?? '—'}</p>
                      <p><b>Schedule:</b> {when(selected.scheduled_date, selected.scheduled_time)}</p>
                      {selectedAsset && <p><b>Asset:</b> {selectedAsset.title ?? selectedAsset.file_name}</p>}
                    </div>

                    {editing ? (
                      <div className="grid gap-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Date<input type="date" value={draft.scheduled_date} onChange={(event) => setDraft({ ...draft, scheduled_date: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900" /></label>
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Time<input value={draft.scheduled_time} onChange={(event) => setDraft({ ...draft, scheduled_time: event.target.value })} placeholder="9:00 AM" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900" /></label>
                        </div>
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Destination URL<input value={draft.destination_url} onChange={(event) => setDraft({ ...draft, destination_url: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
                        <div className="grid grid-cols-2 gap-2"><button onClick={() => setEditing(false)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold">Cancel</button><button disabled={isPending && pendingId === selected.id} onClick={() => run('save', selected.id)} className="rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white">Save</button></div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2">
                          {selected.copy_doc_url && <a className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50" href={selected.copy_doc_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><FileText size={16} /> Open copy/page doc</span><ExternalLink size={16} /></a>}
                          {selected.asset_url && <a className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50" href={selected.asset_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><PlayCircle size={16} /> Open media asset</span><ExternalLink size={16} /></a>}
                          {selected.destination_url && <a className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50" href={selected.destination_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><Send size={16} /> Open destination URL</span><ExternalLink size={16} /></a>}
                        </div>
                        {selected.notes && <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">{selected.notes}</div>}
                        <button onClick={startEdit} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50">Edit title/date/notes</button>
                        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-5">
                          <button disabled={isPending && pendingId === selected.id} onClick={() => run('reject', selected.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-50">{isPending && pendingId === selected.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Changes needed</button>
                          <button disabled={(isPending && pendingId === selected.id) || !selectedReadiness?.isReady} onClick={() => run('approve', selected.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-forest px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending && pendingId === selected.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve</button>
                        </div>
                        <p className="text-xs leading-5 text-gray-400">Approval marks this row approved and ready_to_push for the HighLevel handoff. Missing required fields must be cleared first.</p>
                      </>
                    )}
                  </div>
                ) : <p className="text-sm text-gray-500">Select a post to review.</p>}
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function QueueButton({ label, value, active, count, onClick }: { label: string; value: QueueKey; active: boolean; count: number; onClick: (value: QueueKey) => void }) {
  return (
    <button onClick={() => onClick(value)} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition ${active ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {label}<span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/15 text-white' : 'bg-white text-gray-700'}`}>{count}</span>
    </button>
  );
}

function EpisodeButton({ label, count, score, selected, onClick, episode }: { label: string; count: number; score: number; selected: boolean; onClick: () => void; episode?: EicContentEpisode }) {
  return (
    <button onClick={onClick} className={`w-full rounded-2xl px-4 py-3 text-left transition ${selected ? 'bg-brand-forest text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="truncate text-sm font-bold">{label}</div><div className="mt-1 text-xs opacity-70">{count} items{episode?.status ? ` · ${episode.status}` : ''}</div></div>
        <ChevronRight size={16} className="mt-1 shrink-0 opacity-60" />
      </div>
      <div className="mt-3 h-2 rounded-full bg-black/10"><div className={`h-full rounded-full ${selected ? 'bg-white' : 'bg-brand-orange'}`} style={{ width: `${score}%` }} /></div>
      <div className="mt-1 text-xs font-semibold opacity-70">{score}% field-ready</div>
    </button>
  );
}
