'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@/utils/supabase/server';

function db() {
  const url = process.env.EIC_CONTENT_SUPABASE_URL;
  const key = process.env.EIC_CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return createServerSupabaseClient();
}

export async function approveEicContentPost(postId: string) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await db().from('eic_content_posts').update({ status: 'approved', approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id, ghl_status: 'ready_to_push' }).eq('id', postId);
  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}
export async function rejectEicContentPost(postId: string) {
  const { error } = await db().from('eic_content_posts').update({ status: 'rejected', approval_status: 'rejected', ghl_status: 'not_pushed' }).eq('id', postId);
  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}
export async function updateEicContentPost(postId: string, updates: { title?: string; scheduled_date?: string | null; scheduled_time?: string | null; platform?: string; notes?: string | null; destination_url?: string | null; }) {
  const { error } = await db().from('eic_content_posts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', postId);
  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}
