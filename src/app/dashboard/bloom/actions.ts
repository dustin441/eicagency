'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { checkBudgetEditor } from '@/lib/auth-guard';
import { updateSingleBudgetRow } from '@/lib/budget-update';

export async function updateBloomBudget(budget: number): Promise<{ error?: string }> {
  const access = await checkBudgetEditor('bloom');
  if (access !== 'ok') return { error: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden' };
  const db = createSpartacoSupabaseClient();
  const error = await updateSingleBudgetRow(db, 'bloom', budget);
  if (error) return { error };
  revalidatePath('/dashboard/bloom');
  return {};
}
