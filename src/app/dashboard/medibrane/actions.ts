'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyAccess } from '@/lib/auth-guard';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export async function updateMedibraneBudget(budget: number): Promise<{ error?: string }> {
  await requireAgencyAccess();
  if (!Number.isFinite(budget) || budget <= 0) return { error: 'Invalid budget amount' };

  const db = createSpartacoSupabaseClient();
  const { data: latest, error: lookupError } = await db
    .from('budgets')
    .select('id')
    .ilike('client', 'medibrane')
    .order('period_start', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) return { error: lookupError.message };
  if (!latest) return { error: 'MediBraine budget row is not configured' };

  const { error } = await db
    .from('budgets')
    .update({ budget })
    .eq('id', latest.id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/medibrane');
  return {};
}
