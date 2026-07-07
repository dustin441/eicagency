'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { DurodyneProductFilter } from '@/services/durodyne-analytics';

const BUDGET_CLIENTS: Record<Exclude<DurodyneProductFilter, 'all'>, string> = {
  duraline: 'durodyne_duraline',
  dynatite: 'durodyne_dynatite',
};

export async function updateDurodyneBudget(
  product: Exclude<DurodyneProductFilter, 'all'>,
  budget: number
): Promise<{ error?: string }> {
  if (!BUDGET_CLIENTS[product]) return { error: 'Invalid Duro Dyne product budget' };
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };

  const db = createSpartacoSupabaseClient();
  const client = BUDGET_CLIENTS[product];
  const { data: existing, error: fetchError } = await db
    .from('budgets')
    .select('client')
    .eq('client', client)
    .limit(1);

  if (fetchError) return { error: fetchError.message };

  const hasExistingRow = (existing ?? []).length > 0;
  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];
  const result = hasExistingRow
    ? await db.from('budgets').update({ budget }).eq('client', client)
    : await db.from('budgets').insert({ client, budget, period_start: periodStart, period_end: periodEnd });

  if (result.error) return { error: result.error.message };
  revalidatePath('/dashboard/durodyne');
  return {};
}
