'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@/utils/supabase/server';

const PREPASS_FOCUSES = new Set(['SMB', 'ABM', 'FD360', 'ATA']);

async function requireBudgetAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Unauthorized';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (error || !profile) return 'Unauthorized';
  return profile.role === 'agency' || profile.role === 'super_admin' ? null : 'Forbidden';
}

export async function updatePrepassBudget(focus: string, budget: number): Promise<{ error?: string }> {
  if (!PREPASS_FOCUSES.has(focus)) return { error: 'Invalid PrePass focus' };
  if (!Number.isFinite(budget) || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };

  const db = createServerSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .eq('client', focus)
    .select('client')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/smb');
  revalidatePath('/dashboard/abm');
  revalidatePath('/dashboard/fd360');
  revalidatePath('/dashboard/ata-event');
  return {};
}
