'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@/utils/supabase/server';

export async function approveEicContentPost(postId: string) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const db = createServerSupabaseClient();
  const { error } = await db
    .from('eic_content_posts')
    .update({
      status: 'approved',
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      ghl_status: 'ready_to_push',
    })
    .eq('id', postId);

  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}

export async function rejectEicContentPost(postId: string) {
  const db = createServerSupabaseClient();
  const { error } = await db
    .from('eic_content_posts')
    .update({
      status: 'rejected',
      approval_status: 'rejected',
      ghl_status: 'not_pushed',
    })
    .eq('id', postId);

  if (error) throw error;
  revalidatePath('/dashboard/eicagency/social');
}
