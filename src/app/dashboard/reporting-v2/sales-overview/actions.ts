'use server';

import { revalidatePath } from 'next/cache';
import { loadAccessContext } from '@/lib/auth-guard';
import { getDeploymentTenant } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const PAGE = '/dashboard/reporting-v2/sales-overview';
const KINDS = ['test', 'change', 'note'] as const;

export type SalesNoteState = { ok: boolean; message: string };

/** Only EIC agency users can log notes. Clients can read the page but not write to it. */
export async function canEditSalesNotes(): Promise<boolean> {
  if (!getDeploymentTenant().internalFeatures) return false;
  const ctx = await loadAccessContext();
  return !!ctx && (ctx.role === 'super_admin' || ctx.role === 'agency');
}

export async function addSalesNote(_prev: SalesNoteState, form: FormData): Promise<SalesNoteState> {
  if (!(await canEditSalesNotes())) return { ok: false, message: 'Only agency users can add notes.' };

  const body = String(form.get('body') ?? '').trim();
  const kind = String(form.get('kind') ?? 'note');
  const date = String(form.get('note_date') ?? '');
  if (!body) return { ok: false, message: 'Write what you tested or changed first.' };
  if (body.length > 2000) return { ok: false, message: 'Keep it under 2,000 characters.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, message: 'Pick test, change or note.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Pick a valid date.' };

  const { error } = await createServerSupabaseClient()
    .from('prepass_sales_notes')
    .insert({ body, kind, note_date: date });
  if (error) return { ok: false, message: 'Could not save. Try again in a moment.' };

  revalidatePath(PAGE);
  return { ok: true, message: 'Saved.' };
}
