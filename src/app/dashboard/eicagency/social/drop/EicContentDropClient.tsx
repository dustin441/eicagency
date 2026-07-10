'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileAudio, FileImage, FileText, Loader2, UploadCloud, Video, X } from 'lucide-react';
import { createEicContentUploadBatch } from './actions';

function fileIcon(file: File) {
  if (file.type.startsWith('video/')) return <Video size={16} />;
  if (file.type.startsWith('audio/')) return <FileAudio size={16} />;
  if (file.type.startsWith('image/')) return <FileImage size={16} />;
  return <FileText size={16} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EicContentDropClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [recordingDate, setRecordingDate] = useState('');
  const [sourceType, setSourceType] = useState('manual_drop');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string; batchId?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => ({
    transcripts: files.filter((file) => /text|pdf|word|vtt|srt/i.test(`${file.type} ${file.name}`)).length,
    media: files.filter((file) => file.type.startsWith('video/') || file.type.startsWith('audio/')).length,
    images: files.filter((file) => file.type.startsWith('image/')).length,
  }), [files]);

  function addFiles(nextFiles: FileList | File[]) {
    const incoming = Array.from(nextFiles);
    setFiles((current) => {
      const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !keys.has(`${file.name}:${file.size}:${file.lastModified}`))];
    });
    setMessage(null);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function submit() {
    const formData = new FormData();
    formData.set('episode_title', episodeTitle);
    formData.set('recording_date', recordingDate);
    formData.set('source_type', sourceType);
    formData.set('notes', notes);
    formData.set('drive_folder_url', driveFolderUrl);
    if (driveFolderUrl.trim()) formData.set('source_type', 'dashboard_google_drive');
    files.forEach((file) => formData.append('files', file));

    startTransition(async () => {
      const result = await createEicContentUploadBatch(formData);
      setMessage({ ok: result.ok, text: result.message, batchId: result.batchId });
      if (result.ok) {
        setFiles([]);
        setEpisodeTitle('');
        setRecordingDate('');
        setNotes('');
        setDriveFolderUrl('');
      }
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/dashboard/eicagency/social" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-950"><ArrowLeft size={16} /> Back to Content Hub</Link>

        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">EIC Podcast Intake</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">Drop podcast files</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Use this as the front door for Google Drive episode folders or small transcript uploads. Large media should stay in Drive; the intake batch lets n8n import the transcript and media references for review-ready content rows.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 md:col-span-2">Episode title<input value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} placeholder="CRM Marketing - full episode" className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Recording date<input type="date" value={recordingDate} onChange={(event) => setRecordingDate(event.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900" /></label>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Source<select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-gray-900"><option value="manual_drop">Manual drop</option><option value="riverside_export">Riverside export</option><option value="google_drive">Google Drive handoff</option><option value="other">Other</option></select></label>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 md:col-span-2">Google Drive folder URL<input value={driveFolderUrl} onChange={(event) => setDriveFolderUrl(event.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-gray-900" /></label><label className="text-xs font-bold uppercase tracking-widest text-gray-400 md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything the content generator/reviewer should know..." className="mt-1 min-h-24 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-gray-900" /></label>
              </div>
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
              className="rounded-[2rem] border-2 border-dashed border-brand-orange/30 bg-white p-8 text-center shadow-sm transition hover:border-brand-orange/60 hover:bg-orange-50/20"
            >
              <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} />
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-brand-orange"><UploadCloud size={28} /></div>
              <h2 className="mt-4 text-xl font-bold text-gray-950">Drop files here</h2>
              <p className="mt-2 text-sm text-gray-500">Recommended: paste a Google Drive folder above. Or upload small transcript files here.</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-bold text-white">Choose files</button>
            </div>

            {files.length > 0 && (
              <div className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-gray-950">Files ready to upload</h2><button onClick={() => setFiles([])} className="text-sm font-bold text-gray-400 hover:text-red-600">Clear all</button></div>
                <div className="mt-4 divide-y divide-gray-100">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-500">{fileIcon(file)}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-gray-900">{file.name}</p><p className="text-xs text-gray-400">{file.type || 'unknown type'} · {formatSize(file.size)}</p></div>
                      <button onClick={() => removeFile(index)} className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Intake summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Files</span><b>{files.length}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">Transcripts/docs</span><b>{grouped.transcripts}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">Video/audio</span><b>{grouped.media}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">Images</span><b>{grouped.images}</b></div>
            </div>
            <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-xs leading-5 text-gray-500">
              After upload, n8n should pick up the batch, generate docs/posts, then write review rows back into the Content Hub.
            </div>
            <button disabled={isPending || !episodeTitle.trim() || (!driveFolderUrl.trim() && files.length === 0)} onClick={submit} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-forest px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Create intake batch
            </button>
            {message && <div className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.ok && <CheckCircle2 size={16} className="mb-2" />}{message.text}</div>}
          </aside>
        </section>
      </div>
    </main>
  );
}
