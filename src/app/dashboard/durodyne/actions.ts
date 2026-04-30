'use server';

import { revalidatePath } from 'next/cache';

export async function updateDurodyneBudget(): Promise<{ error?: string }> {
  revalidatePath('/dashboard/durodyne');
  return { error: 'Duro Dyne budget is fixed at $3,500/month.' };
}
