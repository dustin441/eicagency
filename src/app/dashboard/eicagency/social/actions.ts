'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@/utils/supabase/server';

type InlineContentUpdates = {
  copy_body?: string | null;
  first_comment?: string | null;
  creative_notes?: string | null;
};

type UpdatePayload = {
  title?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  platform?: string;
  notes?: string | null;
  destination_url?: string | null;
} & InlineContentUpdates;

function db() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

const BLOG_URL_BASE = 'https://www.eic.agency/resources';
const SOCIAL_PLATFORMS = new Set(['linkedin', 'facebook', 'instagram']);

function isBlogPost(post: { platform?: string | null; post_type?: string | null }) {
  return `${post.platform ?? ''} ${post.post_type ?? ''}`.toLowerCase().includes('blog');
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'episode';
}

function isLockedUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && !value.includes('[BLOG_LINK]') && !value.includes('[YOUTUBE_LINK]');
}

function stripPostBodyLinks(value: unknown) {
  return String(value ?? '')
    .replace(/\s*\[BLOG_LINK\]\s*/g, '')
    .replace(/\s*\[CLIP_PAGE_LINK\]\s*/g, '')
    .split('\n')
    .filter((line) => !/^\s*(read|full|learn|more|link|article|blog|recap).*https?:\/\//i.test(line) && !/^\s*https?:\/\//i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function approveEicContentPost(postId: string) {
  const client = db();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: post, error: fetchError } = await client.from('eic_content_posts').select('id, episode_id, platform, post_type, title, destination_url, metadata').eq('id', postId).single();
  if (fetchError) throw fetchError;

  const now = new Date().toISOString();
  const metadata = post?.metadata && typeof post.metadata === 'object' && !Array.isArray(post.metadata) ? post.metadata as Record<string, unknown> : {};
  const approvalUpdate: Record<string, unknown> = { status: 'approved', approval_status: 'approved', approved_at: now, approved_by: user.id, ghl_status: 'ready_to_push' };

  if (post && isBlogPost(post)) {
    const lockedUrl = isLockedUrl(post.destination_url) ? String(post.destination_url) : `${BLOG_URL_BASE}/${slugify(post.title)}`;
    approvalUpdate.destination_url = lockedUrl;
    approvalUpdate.metadata = { ...metadata, locked_blog_url: lockedUrl, blog_url_locked_at: now };

    const { error: updateError } = await client.from('eic_content_posts').update(approvalUpdate).eq('id', postId);
    if (updateError) throw updateError;

    const { data: related, error: relatedError } = await client.from('eic_content_posts').select('id, platform, metadata').eq('episode_id', post.episode_id).neq('id', postId);
    if (relatedError) throw relatedError;

    for (const row of related ?? []) {
      const rowMetadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
      const platform = String(row.platform ?? '').toLowerCase();
      const firstComment = SOCIAL_PLATFORMS.has(platform) ? `Full article: ${lockedUrl}` : String(rowMetadata.first_comment ?? '');
      const nextMetadata = {
        ...rowMetadata,
        inline_copy: SOCIAL_PLATFORMS.has(platform) ? stripPostBodyLinks(rowMetadata.inline_copy) : rowMetadata.inline_copy,
        first_comment: firstComment,
        locked_blog_url: lockedUrl,
        blog_url_locked_at: now,
      };
      const { error: propagateError } = await client.from('eic_content_posts').update({ destination_url: lockedUrl, metadata: nextMetadata, updated_at: now }).eq('id', row.id);
      if (propagateError) throw propagateError;
    }
  } else {
    const platform = String(post?.platform ?? '').toLowerCase();
    if (post && SOCIAL_PLATFORMS.has(platform) && isLockedUrl(post.destination_url)) {
      approvalUpdate.metadata = {
        ...metadata,
        inline_copy: stripPostBodyLinks(metadata.inline_copy),
        first_comment: String(metadata.first_comment || `Full article: ${post.destination_url}`),
      };
    }
    const { error } = await client.from('eic_content_posts').update(approvalUpdate).eq('id', postId);
    if (error) throw error;
  }

  revalidatePath('/dashboard/eicagency/social');
}

export async function rejectEicContentPost(postId: string) {
  const { error } = await db().from('eic_content_posts').update({ status: 'rejected', approval_status: 'rejected', ghl_status: 'not_pushed' }).eq('id', postId);
  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}

export async function updateEicContentPost(postId: string, updates: UpdatePayload) {
  const client = db();
  const { copy_body, first_comment, creative_notes, ...rowUpdates } = updates;
  const hasInlineUpdates = copy_body !== undefined || first_comment !== undefined || creative_notes !== undefined;
  const nextUpdates: Record<string, unknown> = { ...rowUpdates, updated_at: new Date().toISOString() };

  if (hasInlineUpdates) {
    const { data: current, error: fetchError } = await client.from('eic_content_posts').select('metadata').eq('id', postId).single();
    if (fetchError) throw fetchError;
    const metadata = current?.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata) ? current.metadata as Record<string, unknown> : {};
    nextUpdates.metadata = {
      ...metadata,
      inline_copy: copy_body ?? '',
      first_comment: first_comment ?? '',
      creative_notes: creative_notes ?? '',
      inline_updated_at: new Date().toISOString(),
    };
  }

  const { error } = await client.from('eic_content_posts').update(nextUpdates).eq('id', postId);
  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}
