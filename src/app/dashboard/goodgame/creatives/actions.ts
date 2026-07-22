'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { CreativeTestStatus } from '@/services/goodgame-creative-learning';

const DASHBOARD_PATH = '/dashboard/goodgame/creatives';
const ALLOWED_TRANSITIONS: Partial<Record<CreativeTestStatus, CreativeTestStatus[]>> = {
  recommended: ['approved', 'declined'],
  approved: ['in_production', 'cancelled'],
  in_production: ['launched', 'cancelled'],
  launched: ['evaluating', 'cancelled'],
  evaluating: ['concluded', 'cancelled'],
};

export type CreativeTestActionState = {
  ok: boolean;
  message: string;
};

async function requireAgencyEditor() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: 'Please sign in again.' } as const;

  const { data: profile } = await auth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role as string | undefined;
  if (role !== 'super_admin' && role !== 'agency') {
    return { error: 'Only agency users can change creative test status.' } as const;
  }
  return { user } as const;
}

export async function canEditGoodGameCreativeTests() {
  const editor = await requireAgencyEditor();
  return !('error' in editor);
}

export async function setGoodGameCreativeTestStatus(
  testId: number,
  nextStatus: CreativeTestStatus
): Promise<CreativeTestActionState> {
  const editor = await requireAgencyEditor();
  if ('error' in editor) return { ok: false, message: editor.error ?? 'Not authorized.' };

  const db = createSpartacoSupabaseClient();
  const { data: test, error: fetchError } = await db
    .from('creative_tests')
    .select('id,status')
    .eq('id', testId)
    .eq('client_key', 'goodgame')
    .eq('initiative_key', 'ecommerce')
    .single();

  if (fetchError || !test) return { ok: false, message: 'Good Game test not found.' };
  const currentStatus = test.status as CreativeTestStatus;
  if (!(ALLOWED_TRANSITIONS[currentStatus] ?? []).includes(nextStatus)) {
    return { ok: false, message: `Cannot move ${currentStatus} to ${nextStatus}.` };
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'approved') {
    updates.approved_at = now;
    updates.approved_by = editor.user.email ?? editor.user.id;
  }
  if (nextStatus === 'in_production') updates.production_started_at = now;
  if (nextStatus === 'launched') updates.launched_at = now;
  if (nextStatus === 'concluded') updates.concluded_at = now;

  const { error } = await db
    .from('creative_tests')
    .update(updates)
    .eq('id', testId)
    .eq('client_key', 'goodgame')
    .eq('initiative_key', 'ecommerce');

  if (error) return { ok: false, message: error.message };
  revalidatePath(DASHBOARD_PATH);
  return { ok: true, message: `Test moved to ${nextStatus.replaceAll('_', ' ')}.` };
}
