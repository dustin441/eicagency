'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const PREPASS_FOCUSES = new Set(['SMB', 'ABM', 'FD360']);

export async function updatePrepassBudget(focus: string, budget: number): Promise<{ error?: string }> {
  if (!PREPASS_FOCUSES.has(focus)) return { error: 'Invalid PrePass focus' };
  if (!Number.isFinite(budget) || budget <= 0) return { error: 'Invalid budget amount' };

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
  return {};
}
