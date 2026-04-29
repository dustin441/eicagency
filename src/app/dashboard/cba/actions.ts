'use server';

import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { revalidatePath } from 'next/cache';

export async function updateCBABudget(budget: number): Promise<{ error?: string }> {
  const db = createSpartacoSupabaseClient();
  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { error } = await db
    .from('budgets')
    .upsert({ client: 'cba', budget, period_start: periodStart }, { onConflict: 'client,period_start' });

  if (error) return { error: error.message };
  revalidatePath('/dashboard/cba');
  return {};
}
