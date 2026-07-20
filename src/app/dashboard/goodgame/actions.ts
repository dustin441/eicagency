'use server';

import { revalidatePath } from 'next/cache';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
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
  return profile.role === 'agency' || profile.role === 'super_admin'
    ? null
    : 'Forbidden';
}

export async function updateGoodGameBudget(budget: number): Promise<{ error?: string }> {
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };
  const db = createSpartacoSupabaseClient();
  const { error } = await db
    .from('budgets')
    .update({ budget })
    .ilike('client', 'goodgame');
  if (error) return { error: error.message };
  revalidatePath('/dashboard/goodgame');
  return {};
}

export async function updateGoodGameSalesBudget(budget: number): Promise<{ error?: string }> {
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };

  const db = createSpartacoSupabaseClient();
  const client = 'goodgame_sales';
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
  revalidatePath('/dashboard/goodgame/sales');
  return {};
}

export async function updateGoodGameFootTrafficBudget(budget: number): Promise<{ error?: string }> {
  if (!budget || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };

  const db = createSpartacoSupabaseClient();
  const client = 'goodgame_foot_traffic';
  const { data: existing, error: fetchError } = await db
    .from('budgets')
    .select('client')
    .eq('client', client)
    .limit(1);

  if (fetchError) return { error: fetchError.message };

  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];
  const result = (existing ?? []).length > 0
    ? await db.from('budgets').update({ budget }).eq('client', client)
    : await db.from('budgets').insert({ client, budget, period_start: periodStart, period_end: periodEnd });

  if (result.error) return { error: result.error.message };
  revalidatePath('/dashboard/goodgame/foot-traffic');
  return {};
}
