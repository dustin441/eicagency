'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@/utils/supabase/server';

const BUCKET = 'eic-content-uploads';

type UploadResult = {
  ok: boolean;
  batchId?: string;
  episodeId?: string;
  message: string;
};

function db() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'episode';
}

function safeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 140) || 'upload.bin';
}

function inferAssetType(file: File) {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith('video/') || ['.mp4', '.mov', '.m4v', '.webm'].some((ext) => name.endsWith(ext))) return 'video';
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.m4a'].some((ext) => name.endsWith(ext))) return 'audio';
  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => name.endsWith(ext))) return 'image';
  if (['.srt', '.vtt', '.txt', '.docx', '.pdf'].some((ext) => name.endsWith(ext))) return 'transcript';
  return 'source_file';
}

export async function createEicContentUploadBatch(formData: FormData): Promise<UploadResult> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, message: 'You need to be logged in to upload podcast files.' };

  const episodeTitle = String(formData.get('episode_title') ?? '').trim();
  const recordingDate = String(formData.get('recording_date') ?? '').trim() || null;
  const sourceType = String(formData.get('source_type') ?? 'manual_drop').trim() || 'manual_drop';
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);

  if (!episodeTitle) return { ok: false, message: 'Add an episode title before uploading.' };
  if (!files.length) return { ok: false, message: 'Drop at least one transcript, video, clip, or image file.' };

  const client = db();
  const now = new Date();
  const episodeId = `eic-${slugify(episodeTitle)}-${now.toISOString().slice(0, 10)}`;
  const batchMetadata = {
    source: 'dashboard_drop',
    next_step: 'Trigger n8n content generation from this batch once upload validation passes.',
  };

  const { error: episodeError } = await client.from('eic_content_episodes').upsert({
    id: episodeId,
    title: episodeTitle,
    slug: slugify(episodeTitle),
    status: 'intake_uploaded',
    dropped_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });

  if (episodeError) return { ok: false, message: `Could not create episode intake row: ${episodeError.message}` };

  const { data: batch, error: batchError } = await client.from('eic_content_upload_batches').insert({
    episode_id: episodeId,
    episode_title: episodeTitle,
    recording_date: recordingDate,
    source_type: sourceType,
    status: 'uploaded',
    file_count: files.length,
    notes,
    created_by: user.id,
    metadata: batchMetadata,
  }).select('id').single();

  if (batchError || !batch) return { ok: false, episodeId, message: `Files were not uploaded because the upload batch table is not ready: ${batchError?.message ?? 'missing batch id'}` };

  const uploadedFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const assetType = inferAssetType(file);
    const storagePath = `${episodeId}/${batch.id}/${String(index + 1).padStart(2, '0')}-${safeFileName(file.name)}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    if (uploadError) {
      await client.from('eic_content_upload_batches').update({ status: 'upload_error', updated_at: new Date().toISOString(), metadata: { ...batchMetadata, error: uploadError.message } }).eq('id', batch.id);
      return { ok: false, episodeId, batchId: batch.id, message: `Upload failed for ${file.name}: ${uploadError.message}. Confirm the ${BUCKET} storage bucket exists from supabase/eic_content_flywheel.sql.` };
    }

    uploadedFiles.push({
      batch_id: batch.id,
      episode_id: episodeId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      asset_type: assetType,
      status: 'uploaded',
      metadata: { last_modified: file.lastModified || null },
    });
  }

  const { error: fileInsertError } = await client.from('eic_content_upload_files').insert(uploadedFiles);
  if (fileInsertError) return { ok: false, episodeId, batchId: batch.id, message: `Files uploaded, but file metadata was not saved: ${fileInsertError.message}` };

  await client.from('eic_content_upload_batches').update({ status: 'ready_for_generation', updated_at: new Date().toISOString() }).eq('id', batch.id);
  revalidatePath('/dashboard/eicagency/social');
  revalidatePath('/dashboard/eicagency/social/drop');

  return {
    ok: true,
    episodeId,
    batchId: batch.id,
    message: `Uploaded ${files.length} file${files.length === 1 ? '' : 's'} and created an intake batch. Next step: n8n can pick up batch ${batch.id} for generation.`,
  };
}
