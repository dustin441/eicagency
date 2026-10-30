'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { checkBudgetEditor } from '@/lib/auth-guard';

export async function updateKinseyBudget(budget: number): Promise<{ error?: string }> {
  const access = await checkBudgetEditor('kinsey');
  if (access !== 'ok') return { error: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden' };
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const db = createSpartacoSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .ilike('client', 'kinsey');
  if (error) return { error: error.message };
  revalidatePath('/dashboard/kinsey');
  return {};
}
