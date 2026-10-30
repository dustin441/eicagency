'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { checkBudgetEditor } from '@/lib/auth-guard';

export async function updateBloomBudget(budget: number): Promise<{ error?: string }> {
  const access = await checkBudgetEditor('bloom');
  if (access !== 'ok') return { error: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden' };
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const db = createSpartacoSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .ilike('client', 'bloom');
  if (error) return { error: error.message };
  revalidatePath('/dashboard/bloom');
  return {};
}
