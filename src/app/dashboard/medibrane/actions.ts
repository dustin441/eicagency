'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAgencyAccess, requireAgencyIdentity } from '@/lib/auth-guard';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { mergeGroundTruthWorkbookImports, parseGroundTruthWorkbook } from '@/lib/medibrane-groundtruth-import';

export type MedibraneGroundTruthImportState = {
  ok: boolean;
  message: string;
};

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 5;
const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

type GroundTruthImportReceipt = {
  import_id: number;
  campaign_count: number;
  location_count: number;
  batch_timestamp: string;
};

function dateField(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? '').trim();
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  const isExactDate = parsed && parsed.toISOString().slice(0, 10) === value;
  if (!isExactDate) throw new Error(`${name.replace(/_/g, ' ')} must be a valid date.`);
  return value;
}

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
  if (!latest) return { error: 'Medibrane budget row is not configured' };

  const { error } = await db
    .from('budgets')
    .update({ budget })
    .eq('id', latest.id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/medibrane');
  return {};
}

export async function importMedibraneGroundTruthReports(
  _previous: MedibraneGroundTruthImportState,
  formData: FormData,
): Promise<MedibraneGroundTruthImportState> {
  const identity = await requireAgencyIdentity();

  try {
    const collectedAt = dateField(formData, 'collected_at');
    const reportStart = dateField(formData, 'report_start');
    const reportEnd = dateField(formData, 'report_end');
    if (!collectedAt) return { ok: false, message: 'Choose the date this export was collected.' };
    if ((reportStart && !reportEnd) || (!reportStart && reportEnd)) {
      return { ok: false, message: 'Enter both report dates or leave both blank to use the dates in the file name.' };
    }
    if (reportStart && reportEnd && reportStart > reportEnd) {
      return { ok: false, message: 'Report start must be on or before report end.' };
    }

    const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return { ok: false, message: 'Choose at least one GroundTruth XLSX export.' };
    if (files.length > MAX_FILES) return { ok: false, message: `Upload no more than ${MAX_FILES} files at a time.` };
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) return { ok: false, message: 'The combined upload must be 3 MB or smaller.' };

    const seenHashes = new Set<string>();
    const parsed = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.xlsx') || (file.type && !XLSX_MIME_TYPES.has(file.type))) {
        return { ok: false, message: `${file.name} is not an XLSX workbook.` };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = createHash('sha256').update(buffer).digest('hex');
      if (seenHashes.has(hash)) return { ok: false, message: `${file.name} duplicates another selected workbook.` };
      seenHashes.add(hash);
      parsed.push(await parseGroundTruthWorkbook(buffer, file.name));
    }

    const merged = mergeGroundTruthWorkbookImports(parsed);
    if (!merged.campaigns.length) return { ok: false, message: 'No campaign rows were recognized in the uploaded workbooks.' };
    if ((!reportStart || !reportEnd) && merged.campaigns.some(row => !row.dataStart || !row.dataEnd)) {
      return { ok: false, message: 'The file name does not include a valid report range. Enter report start and report end, then upload again.' };
    }

    const campaignRows = merged.campaigns.map(row => ({
      campaign_id: row.campaignId,
      campaign_name: row.campaignName ?? `Campaign ${row.campaignId}`,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      reach: row.reach,
      data_start: reportStart ?? row.dataStart,
      data_end: reportEnd ?? row.dataEnd,
    }));
    if (campaignRows.some(row => !row.data_start || !row.data_end)) {
      return { ok: false, message: 'Every campaign needs a report start and end date.' };
    }

    const locationRows = merged.locations.map(row => ({
      campaign_id: row.campaignId,
      region_type: row.regionType,
      region: row.region,
      state: row.state,
      city: row.city,
      impressions: row.impressions,
      clicks: row.clicks,
    }));

    const db = createSpartacoSupabaseClient();
    const { data: receiptData, error: importError } = await db.rpc('import_medibrane_groundtruth_snapshot', {
      p_campaigns: campaignRows,
      p_locations: locationRows,
      p_collected_at: collectedAt,
      p_file_names: merged.fileNames,
      p_uploaded_by: identity.userId,
    });
    if (importError) return { ok: false, message: `GroundTruth import rolled back: ${importError.message}` };

    const receipt = (Array.isArray(receiptData) ? receiptData[0] : receiptData) as GroundTruthImportReceipt | null;
    if (!receipt || receipt.campaign_count !== campaignRows.length || receipt.location_count !== locationRows.length) {
      return { ok: false, message: 'GroundTruth import did not return a valid verification receipt.' };
    }

    revalidatePath('/dashboard/medibrane');
    const rangeStart = reportStart ?? campaignRows[0].data_start;
    const rangeEnd = reportEnd ?? campaignRows[0].data_end;
    return {
      ok: true,
      message: `Import #${receipt.import_id}: verified ${receipt.campaign_count} campaign${receipt.campaign_count === 1 ? '' : 's'} and ${receipt.location_count} location rows for ${rangeStart} through ${rangeEnd}.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The GroundTruth import failed.' };
  }
}
