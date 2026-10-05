'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { CHAMPAGNE_SCOPE_CONFIG, type ChampagneCampaignScope } from '@/lib/champagne-campaign-scope';
import { createClient } from '@/utils/supabase/server';

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

export async function updateChampagneBudget(
  scope: ChampagneCampaignScope,
  budget: number,
): Promise<{ error?: string }> {
  if (!Object.prototype.hasOwnProperty.call(CHAMPAGNE_SCOPE_CONFIG, scope)) {
    return { error: 'Invalid Champagne campaign scope' };
  }
  if (!Number.isFinite(budget) || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };
  const db = createSpartacoSupabaseClient();
  const client = CHAMPAGNE_SCOPE_CONFIG[scope].budgetClient;
  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const { data: existing, error: lookupError } = await db
    .from('budgets')
    .select('id')
    .eq('client', client)
    .order('id', { ascending: false })
    .limit(2);
  if (lookupError) return { error: lookupError.message };
  if ((existing ?? []).length === 0) return { error: 'Budget row is not configured' };
  if ((existing ?? []).length > 1) return { error: 'Duplicate budget rows require cleanup' };

  const budgetId = existing![0].id;
  const writeResult = await db
    .from('budgets')
    .update({ budget, period_start: periodStart, period_end: periodEnd })
    .eq('id', budgetId)
    .eq('client', client);
  if (writeResult.error) return { error: writeResult.error.message };

  const { data: saved, error: readbackError } = await db
    .from('budgets')
    .select('client,budget,period_start,period_end')
    .eq('id', budgetId)
    .single();
  if (readbackError) return { error: readbackError.message };
  if (
    saved?.client !== client ||
    Number(saved?.budget) !== budget ||
    saved?.period_start !== periodStart ||
    saved?.period_end !== periodEnd
  ) {
    return { error: 'Budget update could not be verified' };
  }
  revalidatePath('/dashboard/champagne');
  revalidatePath('/dashboard/champagne/halloween');
  return {};
}
