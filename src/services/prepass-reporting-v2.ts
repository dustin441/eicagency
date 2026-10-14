import { createServerSupabaseClient } from '@/lib/supabase-server';

export type ReportingV2CampaignMapping = {
  platform: string;
  campaignId: string | null;
  campaignAlias: string;
  canonicalCampaign: string;
  focus: 'SMB' | 'ABM' | 'FD360' | null;
  validFrom: string | null;
  validTo: string | null;
};

export type ReportingV2CampaignMappings = {
  available: boolean;
  unavailableReason?: string;
  rows: ReportingV2CampaignMapping[];
};

type CampaignMappingRow = {
  platform: string;
  campaign_id: string | null;
  campaign_alias: string;
  canonical_campaign: string;
  focus: ReportingV2CampaignMapping['focus'];
  valid_from: string | null;
  valid_to: string | null;
};

/** Approved mapping rows are assignment metadata, not campaign outcome totals. */
export async function fetchReportingV2CampaignMappings(
  start: string,
  end: string,
): Promise<ReportingV2CampaignMappings> {
  const supabase = createServerSupabaseClient();
  const response = await supabase
    .from('prepass_marketo_campaign_map')
    .select('platform,campaign_id,campaign_alias,canonical_campaign,focus,valid_from,valid_to')
    .eq('mapping_status', 'approved')
    .order('focus', { ascending: true })
    .order('canonical_campaign', { ascending: true });

  if (response.error) {
    return {
      available: false,
      unavailableReason: 'The active campaign mapping is not initialized or is currently unavailable.',
      rows: [],
    };
  }

  const rows = ((response.data ?? []) as CampaignMappingRow[])
    .filter((row) => (!row.valid_from || row.valid_from <= end) && (!row.valid_to || row.valid_to >= start))
    .map((row) => ({
      platform: row.platform,
      campaignId: row.campaign_id,
      campaignAlias: row.campaign_alias,
      canonicalCampaign: row.canonical_campaign,
      focus: row.focus,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    }));

  return { available: true, rows };
}
