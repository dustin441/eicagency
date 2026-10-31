'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { checkBudgetEditor } from '@/lib/auth-guard';
import { updateSingleBudgetRow } from '@/lib/budget-update';

export async function updateKinseyBudget(budget: number): Promise<{ error?: string }> {
  const access = await checkBudgetEditor('kinsey');
  if (access !== 'ok') return { error: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden' };
  const db = createSpartacoSupabaseClient();
  const error = await updateSingleBudgetRow(db, 'kinsey', budget);
  if (error) return { error };
  revalidatePath('/dashboard/kinsey');
  return {};
}
