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

export async function updateIhhsBudget(budget: number): Promise<{ error?: string }> {
  if (!Number.isFinite(budget) || budget <= 0) return { error: 'Invalid budget amount' };
  const authError = await requireBudgetAdmin();
  if (authError) return { error: authError };

  const db = createSpartacoSupabaseClient();
  const { data: currentBudget, error: fetchError } = await db
    .from('budgets')
    .select('id')
    .eq('client', 'ihh')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!currentBudget) return { error: 'IHH budget is not configured' };

  const { error } = await db
    .from('budgets')
    .update({ budget })
    .eq('id', currentBudget.id)
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/dashboard/ihh');
  return {};
}
