'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  Loader2,
  PlayCircle,
  Search,
  Send,
  UploadCloud,
  Video,
  X,
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
  copy_body?: string | null;
  first_comment?: string | null;
  creative_notes?: string | null;
};

type UploadResult = { ok: boolean; batchId?: string; episodeId?: string; message: string };

type Props = {
  data: EicContentDashboardData;
  approvePost: (postId: string) => Promise<void>;
  rejectPost: (postId: string) => Promise<void>;
  updatePost: (postId: string, updates: UpdatePayload) => Promise<void>;
  createUploadBatch: (formData: FormData) => Promise<UploadResult>;
};

type QueueKey = 'all' | 'needs_review' | 'missing_assets' | 'ready_to_schedule' | 'approved' | 'scheduled';

type Readiness = { missing: string[]; warnings: string[]; isReady: boolean };

type InlineDraft = {
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string;
  destination_url: string;
  copy_body: string;
  first_comment: string;
  creative_notes: string;
};

const statusLabels: Record<string, string> = {
  needs_review: 'Needs review', draft: 'Draft', changes_requested: 'Changes requested', copy_approved: 'Copy approved', media_approved: 'Media approved', approved: 'Approved', ready_to_schedule: 'Ready to schedule', rejected: 'Rejected', pushed_to_ghl: 'Pushed to GHL', scheduled: 'Scheduled', published: 'Published',
};

function statusClass(status: string) {
  if (['approved', 'ready_to_schedule', 'copy_approved', 'media_approved'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'rejected' || status === 'changes_requested') return 'bg-red-50 text-red-700 border-red-100';
  if (status === 'scheduled' || status === 'pushed_to_ghl' || status === 'published') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function when(date: string | null, time: string | null) { return date ? `${date}${time ? ` · ${time}` : ''}` : 'Unscheduled'; }
function inlineValue(post: EicContentPost, key: 'inline_copy' | 'first_comment' | 'creative_notes') { const value = post.metadata?.[key]; return typeof value === 'string' ? value : ''; }
function postNeedsMedia(post: EicContentPost) { const combined = `${post.platform} ${post.post_type}`.toLowerCase(); return ['blog', 'linkedin', 'facebook', 'instagram', 'youtube', 'short', 'video', 'clip'].some((word) => combined.includes(word)); }
function imageQaStatus(post: EicContentPost) { const value = post.platform.toLowerCase() === 'youtube' ? post.metadata?.thumbnail_qa_status ?? post.metadata?.image_qa_status : post.metadata?.image_qa_status; return typeof value === 'string' ? value : ''; }

function readinessFor(post: EicContentPost): Readiness {
  const missing: string[] = [];
  const warnings: string[] = [];
  const inlineCopy = inlineValue(post, 'inline_copy');
  const qaStatus = imageQaStatus(post).toLowerCase();
  if (!inlineCopy) missing.push('Inline copy');
  if (post.copy_doc_url && !inlineCopy) warnings.push('Google Doc source');
  if (postNeedsMedia(post) && !post.asset_url && !post.asset_id && post.platform.toLowerCase() !== 'youtube') missing.push('Media asset');
  if (post.platform.toLowerCase() === 'youtube' && !post.asset_url && !post.asset_id) missing.push('Video asset');
  if (post.platform.toLowerCase() === 'youtube' && !post.metadata?.thumbnail_url) warnings.push('Thumbnail');
  if (qaStatus === 'needs_qa' || qaStatus === 'failed') missing.push('Image QA');
  if (!post.scheduled_date) missing.push('Schedule date');
  if (!post.scheduled_time) warnings.push('Schedule time');
  if (!post.destination_url && ['blog', 'linkedin', 'facebook', 'instagram', 'email', 'newsletter'].includes(post.platform.toLowerCase())) warnings.push('Destination URL');
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
  return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p><p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p></div>;
}

function episodeScore(posts: EicContentPost[]) { if (!posts.length) return 0; return Math.round((posts.filter((post) => readinessFor(post).isReady).length / posts.length) * 100); }
function missingSummary(posts: EicContentPost[]) { const counts = new Map<string, number>(); posts.forEach((post) => readinessFor(post).missing.concat(readinessFor(post).warnings).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1))); return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); }
function safeDateTitle() { return new Date().toISOString().slice(0, 10); }

export default function EicContentSocialClient({ data, approvePost, rejectPost, updatePost, createUploadBatch }: Props) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(data.episodes[0]?.id ?? 'all');
  const [platform, setPlatform] = useState('all');
  const [queue, setQueue] = useState<QueueKey>('all');
  const [query, setQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState(data.posts[0]?.id ?? '');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InlineDraft>({ title: '', scheduled_date: '', scheduled_time: '', notes: '', destination_url: '', copy_body: '', first_comment: '', creative_notes: '' });
  const [uploadOpen, setUploadOpen] = useState(true);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  const [uploadDriveUrl, setUploadDriveUrl] = useState('');
  const [uploadMessage, setUploadMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const episodes = useMemo(() => new Map(data.episodes.map((episode) => [episode.id, episode])), [data.episodes]);
  const assets = useMemo(() => new Map(data.assets.map((asset) => [asset.id, asset])), [data.assets]);
  const platforms = useMemo(() => ['all', ...Array.from(new Set(data.posts.map((post) => post.platform))).sort()], [data.posts]);
  const episodePosts = useMemo(() => data.posts.filter((post) => selectedEpisodeId === 'all' || post.episode_id === selectedEpisodeId), [data.posts, selectedEpisodeId]);
  const queueCounts = useMemo(() => { const base: Record<QueueKey, number> = { all: episodePosts.length, needs_review: 0, missing_assets: 0, ready_to_schedule: 0, approved: 0, scheduled: 0 }; episodePosts.forEach((post) => { base[queueFor(post)] += 1; }); return base; }, [episodePosts]);
  const posts = useMemo(() => data.posts.filter((post) => {
    const q = query.trim().toLowerCase();
    const episode = episodes.get(post.episode_id); const asset = post.asset_id ? assets.get(post.asset_id) : null;
    if (selectedEpisodeId !== 'all' && post.episode_id !== selectedEpisodeId) return false;
    if (platform !== 'all' && post.platform !== platform) return false;
    if (queue !== 'all' && queueFor(post) !== queue) return false;
    if (!q) return true;
    return [post.title, post.platform, post.post_type, post.story_phase, post.notes, inlineValue(post, 'inline_copy'), episode?.title, asset?.title, asset?.file_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  }), [assets, data.posts, episodes, platform, query, queue, selectedEpisodeId]);

  const selected = posts.find((post) => post.id === selectedPostId) ?? posts[0] ?? null;
  const selectedEpisode = selected ? episodes.get(selected.episode_id) : null;
  const selectedAsset = selected?.asset_id ? assets.get(selected.asset_id) : null;
  const selectedReadiness = selected ? readinessFor(selected) : null;
  const needsReview = data.posts.filter((post) => post.status === 'needs_review' || post.status === 'draft').length;
  const missingAssets = data.posts.filter((post) => !readinessFor(post).isReady).length;
  const approved = data.posts.filter((post) => ['approved', 'ready_to_schedule', 'pushed_to_ghl', 'scheduled'].includes(post.status) || post.ghl_status === 'ready_to_push').length;
  const clipPages = data.posts.filter((post) => post.post_type.toLowerCase().includes('clip seo')).length;

  if (data.setupRequired) return <main className="min-h-screen bg-gray-50 p-8"><section className="rounded-[2rem] bg-white p-8 shadow-sm"><h1 className="text-3xl font-bold">Social Content Hub setup required</h1><p className="mt-3 text-gray-600">{data.setupMessage}</p></section></main>;

  function selectEpisode(id: string) { setSelectedEpisodeId(id); const first = data.posts.find((post) => id === 'all' || post.episode_id === id); if (first) setSelectedPostId(first.id); setEditing(false); }
  function startEdit() { if (!selected) return; setDraft({ title: selected.title, scheduled_date: selected.scheduled_date ?? '', scheduled_time: selected.scheduled_time ?? '', notes: selected.notes ?? '', destination_url: selected.destination_url ?? '', copy_body: inlineValue(selected, 'inline_copy'), first_comment: inlineValue(selected, 'first_comment'), creative_notes: inlineValue(selected, 'creative_notes') }); setEditing(true); }
  function run(kind: 'approve' | 'reject' | 'save', id: string) { setPendingId(id); startTransition(async () => { try { if (kind === 'approve') await approvePost(id); if (kind === 'reject') await rejectPost(id); if (kind === 'save') { await updatePost(id, { title: draft.title, scheduled_date: draft.scheduled_date || null, scheduled_time: draft.scheduled_time || null, notes: draft.notes || null, destination_url: draft.destination_url || null, copy_body: draft.copy_body, first_comment: draft.first_comment, creative_notes: draft.creative_notes }); setEditing(false); } } finally { setPendingId(null); } }); }

  function addUploadFiles(nextFiles: FileList | File[]) { const incoming = Array.from(nextFiles); setUploadFiles((current) => { const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`)); return [...current, ...incoming.filter((file) => !keys.has(`${file.name}:${file.size}:${file.lastModified}`))]; }); setUploadMessage(null); if (!uploadTitle && selectedEpisode?.title) setUploadTitle(selectedEpisode.title); }
  function submitUpload() { const formData = new FormData(); formData.set('episode_title', uploadTitle || selectedEpisode?.title || `Podcast upload ${safeDateTitle()}`); formData.set('recording_date', uploadDate); formData.set('source_type', uploadDriveUrl.trim() ? 'dashboard_google_drive' : 'dashboard_inline_drop'); formData.set('notes', uploadDriveUrl.trim() ? 'Google Drive folder intake from the main Content Hub editing page. Large media remains in Drive; n8n imports transcript and media references.' : 'Uploaded from the main Content Hub editing page. Expected package: full episode, clips, and transcript.'); formData.set('drive_folder_url', uploadDriveUrl); uploadFiles.forEach((file) => formData.append('files', file)); startTransition(async () => { const result = await createUploadBatch(formData); setUploadMessage({ ok: result.ok, text: result.message }); if (result.ok) { setUploadFiles([]); setUploadTitle(''); setUploadDate(''); setUploadDriveUrl(''); } }); }

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">EIC Agency</p><h1 className="mt-2 text-3xl font-bold text-gray-950">Podcast Content Command Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">Paste a Google Drive episode folder or upload a small transcript, then edit/approve the generated copy inline from Supabase — no Google Doc round-trip required.</p></div>
            <button onClick={() => setUploadOpen((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-forest/90"><UploadCloud size={18} /> {uploadOpen ? 'Hide upload' : 'Upload files'}</button>
          </div>
          <div className="grid border-t border-gray-100 bg-gray-50/70 md:grid-cols-4"><div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">1. Upload</p><p className="mt-1 text-sm text-gray-600">Drive folder or transcript</p></div><div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">2. Generate</p><p className="mt-1 text-sm text-gray-600">Blog, social, YouTube, newsletter</p></div><div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">3. Edit</p><p className="mt-1 text-sm text-gray-600">Inline copy stored in Supabase</p></div><div className="p-4"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">4. Approve</p><p className="mt-1 text-sm text-gray-600">Ready rows push to HighLevel</p></div></div>
        </section>

        {uploadOpen && <InlineUploadPanel files={uploadFiles} title={uploadTitle} date={uploadDate} driveUrl={uploadDriveUrl} message={uploadMessage} isPending={isPending} inputRef={uploadInputRef} setTitle={setUploadTitle} setDate={setUploadDate} setDriveUrl={setUploadDriveUrl} addFiles={addUploadFiles} removeFile={(index) => setUploadFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} submit={submitUpload} />}

        <section className="grid gap-4 md:grid-cols-5"><Kpi label="Episodes" value={data.episodes.length} /><Kpi label="Posts / Pages" value={data.posts.length} /><Kpi label="Clip SEO Pages" value={clipPages} tone="blue" /><Kpi label="Needs Review" value={needsReview} tone="amber" /><Kpi label="Approved / Ready" value={approved} tone="emerald" /></section>

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Video size={16} /> Episode packages</div>{missingAssets > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{missingAssets} gaps</span>}</div><EpisodeButton label="All episodes" count={data.posts.length} score={episodeScore(data.posts)} selected={selectedEpisodeId === 'all'} onClick={() => selectEpisode('all')} />{data.episodes.map((episode) => { const related = data.posts.filter((post) => post.episode_id === episode.id); return <EpisodeButton key={episode.id} episode={episode} label={episode.title} count={related.length} score={episodeScore(related)} selected={selectedEpisodeId === episode.id} onClick={() => selectEpisode(episode.id)} />; })}<div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Missing pieces</p><div className="mt-3 space-y-2">{missingSummary(episodePosts).length ? missingSummary(episodePosts).map(([label, count]) => <div key={label} className="flex items-center justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-bold text-gray-900">{count}</span></div>) : <p className="text-sm text-emerald-700">Everything in this view has the required fields.</p>}</div></div></aside>

          <div className="flex flex-col gap-4"><section className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_190px]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm" placeholder="Search posts, inline copy, story phase, assets..." /></label><select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">{platforms.map((item) => <option key={item} value={item}>{item === 'all' ? 'All platforms' : item}</option>)}</select></div><div className="mt-4 flex flex-wrap gap-2"><QueueButton label="All" value="all" active={queue === 'all'} count={queueCounts.all} onClick={setQueue} /><QueueButton label="Needs review" value="needs_review" active={queue === 'needs_review'} count={queueCounts.needs_review} onClick={setQueue} /><QueueButton label="Missing pieces" value="missing_assets" active={queue === 'missing_assets'} count={queueCounts.missing_assets} onClick={setQueue} /><QueueButton label="Ready" value="ready_to_schedule" active={queue === 'ready_to_schedule'} count={queueCounts.ready_to_schedule} onClick={setQueue} /><QueueButton label="Approved" value="approved" active={queue === 'approved'} count={queueCounts.approved} onClick={setQueue} /><QueueButton label="Scheduled" value="scheduled" active={queue === 'scheduled'} count={queueCounts.scheduled} onClick={setQueue} /></div></section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]"><div className="space-y-3">{posts.length ? posts.map((post) => { const episode = episodes.get(post.episode_id); const readiness = readinessFor(post); const hasInline = Boolean(inlineValue(post, 'inline_copy')); return <button key={post.id} onClick={() => { setSelectedPostId(post.id); setEditing(false); }} className={`w-full rounded-[1.5rem] border p-4 text-left shadow-sm transition hover:border-brand-orange/40 hover:bg-orange-50/30 ${selected?.id === post.id ? 'border-brand-orange bg-orange-50/70' : 'border-gray-100 bg-white'}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{post.platform}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}>{statusLabels[post.status] ?? post.status}</span>{hasInline ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Inline copy</span> : <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">Doc source</span>}{readiness.isReady ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} /> Ready</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><AlertTriangle size={13} /> Needs {readiness.missing.length}</span>}</div><h3 className="mt-2 text-base font-bold leading-6 text-gray-950">{post.title}</h3><p className="mt-1 text-sm text-gray-500">{episode?.title ?? post.episode_id} · {post.story_phase || 'No phase'} · {post.post_type}</p></div><div className="shrink-0 rounded-2xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">{when(post.scheduled_date, post.scheduled_time)}</div></div>{(readiness.missing.length > 0 || readiness.warnings.length > 0) && <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">{readiness.missing.concat(readiness.warnings).map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-100">{item}</span>)}</div>}</button>; }) : <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">No content items match this queue.</div>}</div>

              <aside className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">{selected ? <div className="flex flex-col gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Selected item</p><h2 className="mt-2 text-xl font-bold leading-7 text-gray-950">{selected.title}</h2><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{selected.platform}</span><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(selected.status)}`}>{statusLabels[selected.status] ?? selected.status}</span></div></div>{selectedReadiness && <div className={`rounded-2xl p-4 ${selectedReadiness.isReady ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}><p className="flex items-center gap-2 text-sm font-bold">{selectedReadiness.isReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {selectedReadiness.isReady ? 'Ready for approval' : 'Missing before handoff'}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">{selectedReadiness.missing.concat(selectedReadiness.warnings).length ? selectedReadiness.missing.concat(selectedReadiness.warnings).map((item) => <span key={item} className="rounded-full bg-white/70 px-2.5 py-1">{item}</span>) : <span className="rounded-full bg-white/70 px-2.5 py-1">All required fields present</span>}</div></div>}<div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600"><p><b>Episode:</b> {selectedEpisode?.title ?? selected.episode_id}</p><p><b>Story phase:</b> {selected.story_phase ?? '—'}</p><p><b>Schedule:</b> {when(selected.scheduled_date, selected.scheduled_time)}</p>{selectedAsset && <p><b>Asset:</b> {selectedAsset.title ?? selectedAsset.file_name}</p>}</div>{editing ? <div className="grid gap-3"><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Date<input type="date" value={draft.scheduled_date} onChange={(event) => setDraft({ ...draft, scheduled_date: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Time<input value={draft.scheduled_time} onChange={(event) => setDraft({ ...draft, scheduled_time: event.target.value })} placeholder="9:00 AM" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900" /></label></div><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Destination URL<input value={draft.destination_url} onChange={(event) => setDraft({ ...draft, destination_url: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Post / page copy<textarea value={draft.copy_body} onChange={(event) => setDraft({ ...draft, copy_body: event.target.value })} placeholder="Paste or edit the final approved copy here. This saves to Supabase metadata." className="mt-1 min-h-44 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400">First comment / CTA<textarea value={draft.first_comment} onChange={(event) => setDraft({ ...draft, first_comment: event.target.value })} placeholder="Optional first comment, CTA, or link comment." className="mt-1 min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Internal notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Creative / scheduler notes<textarea value={draft.creative_notes} onChange={(event) => setDraft({ ...draft, creative_notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><div className="grid grid-cols-2 gap-2"><button onClick={() => setEditing(false)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold">Cancel</button><button disabled={isPending && pendingId === selected.id} onClick={() => run('save', selected.id)} className="rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white">Save inline copy</button></div></div> : <><InlineCopyPreview post={selected} /><div className="grid gap-2">{selected.copy_doc_url && <a className="inline-flex items-center justify-between rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50" href={selected.copy_doc_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><FileText size={16} /> Legacy Google Doc source</span><ExternalLink size={16} /></a>}{selected.asset_url && <a className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50" href={selected.asset_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><PlayCircle size={16} /> Open media asset</span><ExternalLink size={16} /></a>}{selected.destination_url && <a className="inline-flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50" href={selected.destination_url} target="_blank" rel="noreferrer"><span className="inline-flex items-center gap-2"><Send size={16} /> Open destination URL</span><ExternalLink size={16} /></a>}</div>{selected.notes && <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">{selected.notes}</div>}<button onClick={startEdit} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50">Edit inline content</button><div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-5"><button disabled={isPending && pendingId === selected.id} onClick={() => run('reject', selected.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-50">{isPending && pendingId === selected.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Changes needed</button><button disabled={(isPending && pendingId === selected.id) || !selectedReadiness?.isReady} onClick={() => run('approve', selected.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-forest px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending && pendingId === selected.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve</button></div><p className="text-xs leading-5 text-gray-400">Approval now expects inline copy in Supabase. Google Docs remain as legacy/source references only.</p></>}</div> : <p className="text-sm text-gray-500">Select a post to review.</p>}</aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function QueueButton({ label, value, active, count, onClick }: { label: string; value: QueueKey; active: boolean; count: number; onClick: (value: QueueKey) => void }) { return <button onClick={() => onClick(value)} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition ${active ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}<span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/15 text-white' : 'bg-white text-gray-700'}`}>{count}</span></button>; }
function EpisodeButton({ label, count, score, selected, onClick, episode }: { label: string; count: number; score: number; selected: boolean; onClick: () => void; episode?: EicContentEpisode }) { return <button onClick={onClick} className={`w-full rounded-2xl px-4 py-3 text-left transition ${selected ? 'bg-brand-forest text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{label}</div><div className="mt-1 text-xs opacity-70">{count} items{episode?.status ? ` · ${episode.status}` : ''}</div></div><ChevronRight size={16} className="mt-1 shrink-0 opacity-60" /></div><div className="mt-3 h-2 rounded-full bg-black/10"><div className={`h-full rounded-full ${selected ? 'bg-white' : 'bg-brand-orange'}`} style={{ width: `${score}%` }} /></div><div className="mt-1 text-xs font-semibold opacity-70">{score}% field-ready</div></button>; }

function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function fileIcon(file: File) { if (file.type.startsWith('video/')) return <Video size={16} />; if (file.type.startsWith('audio/')) return <FileAudio size={16} />; if (file.type.startsWith('image/')) return <FileImage size={16} />; return <FileText size={16} />; }
function InlineUploadPanel({ files, title, date, driveUrl, message, isPending, inputRef, setTitle, setDate, setDriveUrl, addFiles, removeFile, submit }: { files: File[]; title: string; date: string; driveUrl: string; message: { ok: boolean; text: string } | null; isPending: boolean; inputRef: React.RefObject<HTMLInputElement | null>; setTitle: (value: string) => void; setDate: (value: string) => void; setDriveUrl: (value: string) => void; addFiles: (files: FileList | File[]) => void; removeFile: (index: number) => void; submit: () => void }) { const counts = { transcript: files.filter((file) => /text|pdf|word|vtt|srt/i.test(`${file.type} ${file.name}`)).length, media: files.filter((file) => file.type.startsWith('video/') || file.type.startsWith('audio/')).length }; return <section className="grid gap-4 rounded-[2rem] border border-brand-orange/20 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px]"><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="rounded-[1.5rem] border-2 border-dashed border-brand-orange/30 bg-orange-50/20 p-5"><input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} /><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold text-gray-950">Google Drive folder or small transcript upload</p><p className="mt-1 text-sm text-gray-500">Recommended: paste the Drive folder with the full episode, clips, and transcript. Large media stays in Drive; n8n imports the transcript and media links.</p></div><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white"><UploadCloud size={16} /> Choose files</button></div>{files.length > 0 && <div className="mt-4 divide-y divide-gray-100 rounded-2xl bg-white px-3">{files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 py-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500">{fileIcon(file)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-gray-900">{file.name}</p><p className="text-xs text-gray-400">{file.type || 'unknown'} · {formatSize(file.size)}</p></div><button onClick={() => removeFile(index)} className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button></div>)}</div>}</div><aside className="rounded-[1.5rem] bg-gray-50 p-4"><label className="text-xs font-bold uppercase tracking-widest text-gray-400">Episode title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Podcast upload ${safeDateTitle()}`} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="mt-3 block text-xs font-bold uppercase tracking-widest text-gray-400">Recording date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900" /></label><label className="mt-3 block text-xs font-bold uppercase tracking-widest text-gray-400">Google Drive folder URL<input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white p-2"><b>{files.length}</b><br />files</div><div className="rounded-xl bg-white p-2"><b>{counts.media}</b><br />media</div><div className="rounded-xl bg-white p-2"><b>{counts.transcript}</b><br />docs</div></div><button disabled={isPending || (!driveUrl.trim() && files.length === 0)} onClick={submit} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-forest px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Create intake batch</button>{message && <div className={`mt-3 rounded-xl p-3 text-xs leading-5 ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</div>}</aside></section>; }

function InlineCopyPreview({ post }: { post: EicContentPost }) { const copy = inlineValue(post, 'inline_copy'); const firstComment = inlineValue(post, 'first_comment'); const creativeNotes = inlineValue(post, 'creative_notes'); if (!copy && !firstComment && !creativeNotes) return <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"><b>No inline Supabase copy yet.</b><br />Click “Edit inline content” to paste or write the final copy here. The Google Doc can remain as source material, but approval should happen from this inline version.</div>; return <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4"><div><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Inline post/page copy</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{copy || '—'}</p></div>{firstComment && <div><p className="text-xs font-bold uppercase tracking-widest text-gray-400">First comment / CTA</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{firstComment}</p></div>}{creativeNotes && <div><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Creative / scheduler notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{creativeNotes}</p></div>}</div>; }
