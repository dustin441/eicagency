'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { checkClientAccess } from '@/lib/auth-guard';

export async function updateArabellasBudget(budget: number): Promise<{ error?: string }> {
  const access = await checkClientAccess('arabella');
  if (access !== 'ok') return { error: access === 'unauthorized' ? 'Unauthorized' : 'Forbidden' };
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const db = createSpartacoSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .ilike('client', 'arabella');
  if (error) return { error: error.message };
  revalidatePath('/dashboard/arabella');
  return {};
}
