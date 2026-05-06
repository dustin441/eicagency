'use server';

import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { NsiSubCampaignNote } from '@/services/nsi-analytics';

export async function saveNsiPerformanceNote(data: {
  id?: string;
  periodLabel: string;
  overall: string;
  subCampaignNotes: NsiSubCampaignNote[];
}): Promise<{ error?: string }> {
  const supabase = createSpartacoSupabaseClient();

  if (data.id) {
    const { error } = await supabase
      .from('nsi_performance_notes')
      .update({
        period_label: data.periodLabel,
        overall: data.overall,
        sub_campaign_notes: data.subCampaignNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);
    return { error: error?.message };
  }

  const { error } = await supabase
    .from('nsi_performance_notes')
    .insert({
      period_label: data.periodLabel,
      overall: data.overall,
      sub_campaign_notes: data.subCampaignNotes,
    });
  return { error: error?.message };
}
