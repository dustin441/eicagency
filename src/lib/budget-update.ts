import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_EDITABLE_BUDGET = 100_000_000;

export function validateEditableBudget(budget: number): string | null {
  if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_EDITABLE_BUDGET) {
    return 'Invalid budget amount';
  }
  return null;
}

export async function updateSingleBudgetRow(
  db: SupabaseClient,
  client: string,
  budget: number,
): Promise<string | null> {
  const invalid = validateEditableBudget(budget);
  if (invalid) return invalid;

  const { data: existing, error: lookupError } = await db
    .from('budgets')
    .select('id')
    .eq('client', client)
    .order('id', { ascending: false })
    .limit(2);
  if (lookupError) return lookupError.message;
  if ((existing ?? []).length === 0) return 'Budget row is not configured';
  if ((existing ?? []).length > 1) return 'Duplicate budget rows require cleanup';

  const budgetId = existing![0].id;
  const { data: saved, error: updateError } = await db
    .from('budgets')
    .update({ budget })
    .eq('id', budgetId)
    .eq('client', client)
    .select('id,client,budget')
    .single();
  if (updateError) return updateError.message;
  if (saved?.id !== budgetId || saved?.client !== client || Number(saved?.budget) !== budget) {
    return 'Budget update could not be verified';
  }
  return null;
}