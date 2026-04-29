'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export async function updateBridgewayBudget(budget: number): Promise<{ error?: string }> {
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const db = createSpartacoSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .ilike('client', 'bridgeway');
  if (error) return { error: error.message };
  revalidatePath('/dashboard/bridgeway');
  return {};
}
