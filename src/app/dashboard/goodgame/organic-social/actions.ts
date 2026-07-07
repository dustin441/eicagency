'use server';

import { revalidatePath } from 'next/cache';
import { requireClientAccess } from '@/lib/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createGoodGameOrganicSocialSupabaseClient } from '@/services/goodgame-organic-social';

type ImportState = {
  ok: boolean;
  message: string;
};

type CsvRow = Record<string, string>;

const DASHBOARD_PATH = '/dashboard/goodgame/organic-social';

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

function text(row: CsvRow, key: string) {
  const value = row[key]?.trim();
  return value && value !== '--' ? value : null;
}

function int(row: CsvRow, key: string) {
  const value = text(row, key);
  if (!value) return 0;
  const parsed = Number.parseInt(value.replace(/[$,%x,\s]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function num(row: CsvRow, key: string) {
  const value = text(row, key);
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/[$,%x,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNum(row: CsvRow, key: string) {
  const value = text(row, key);
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[$,%x,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) return value;
  const [, month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseDateTime(value: string | null) {
  if (!value) return null;
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!parts) return value;
  const [, month, day, year, hour, minute] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00-07:00`;
}

function inferRangeFromFileName(fileName: string) {
  const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const match = fileName.match(/([A-Z][a-z]{2})-(\d{2})-(\d{4})_([A-Z][a-z]{2})-(\d{2})-(\d{4})/);
  if (!match) return { start: null, end: null };
  const [, sm, sd, sy, em, ed, ey] = match;
  return {
    start: `${sy}-${months[sm] ?? '01'}-${sd}`,
    end: `${ey}-${months[em] ?? '01'}-${ed}`,
  };
}

function cleanBrand(value: FormDataEntryValue | null) {
  const brand = String(value ?? '').trim();
  return brand || null;
}

export async function importGoodGameOrganicSocialCsvs(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  await requireClientAccess('goodgame');

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, message: 'Please log in again before uploading.' };

  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) return { ok: false, message: 'Choose at least one CSV export to upload.' };

  const requestedBrand = cleanBrand(formData.get('brand'));
  const db = createGoodGameOrganicSocialSupabaseClient();
  const contentFileNames: string[] = [];
  const profileFileNames: string[] = [];
  const postRows: Record<string, unknown>[] = [];
  const dailyRows: Record<string, unknown>[] = [];
  let inferredBrand = requestedBrand;
  let reportStart: string | null = null;
  let reportEnd: string | null = null;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.csv')) return { ok: false, message: `${file.name} is not a CSV file.` };
    const rows = parseCsv(await file.text());
    if (!rows.length) continue;

    const headers = Object.keys(rows[0]);
    const isContent = headers.includes('Post ID') && headers.includes('Publish time');
    const isDaily = headers.includes('Page ID') && headers.includes('Date') && headers.includes('Comments and replies');
    const range = inferRangeFromFileName(file.name);
    reportStart ||= range.start;
    reportEnd ||= range.end;

    if (isContent) {
      contentFileNames.push(file.name);
      for (const row of rows) {
        const pageName = text(row, 'Page name');
        const brand = requestedBrand ?? pageName ?? 'Good Game';
        inferredBrand ||= brand;
        postRows.push({
          brand,
          platform: 'Facebook',
          post_id: text(row, 'Post ID'),
          page_id: text(row, 'Page ID'),
          page_name: pageName,
          title: text(row, 'Title'),
          duration_seconds: int(row, 'Duration (sec)'),
          publish_time: parseDateTime(text(row, 'Publish time')),
          permalink: text(row, 'Permalink'),
          post_type: text(row, 'Post type'),
          data_comment: text(row, 'Data comment'),
          comments: int(row, 'Comments'),
          distribution: optionalNum(row, 'Distribution'),
          approximate_earnings: num(row, 'Approximate earnings (USD)'),
          content_monetization: num(row, 'Content monetization (USD)'),
          in_stream_ads: num(row, 'In-stream ads (USD)'),
          stars: num(row, 'Stars (USD)'),
          impressions: int(row, 'Impressions'),
          interactions: int(row, 'Interactions'),
          net_follows: int(row, 'Net follows'),
          reactions: int(row, 'Reactions'),
          saves: int(row, 'Saves'),
          shares: int(row, 'Shares'),
          viewers: int(row, 'Viewers'),
          views: int(row, 'Views'),
          average_seconds_viewed: optionalNum(row, 'Average Seconds viewed'),
          seconds_viewed: optionalNum(row, 'Seconds viewed'),
          raw: row,
        });
      }
    } else if (isDaily) {
      profileFileNames.push(file.name);
      for (const row of rows) {
        const pageName = text(row, 'Page name');
        const brand = requestedBrand ?? pageName ?? 'Good Game';
        inferredBrand ||= brand;
        dailyRows.push({
          brand,
          platform: 'Facebook',
          page_id: text(row, 'Page ID'),
          page_name: pageName,
          metric_date: parseDate(text(row, 'Date')),
          data_comment: text(row, 'Data comment'),
          approximate_earnings: num(row, 'Approximate earnings (USD)'),
          content_monetization: num(row, 'Content monetization (USD)'),
          in_stream_ads: num(row, 'In-stream ads (USD)'),
          stars: num(row, 'Stars (USD)'),
          impressions: int(row, 'Impressions'),
          interactions: int(row, 'Interactions'),
          net_follows: int(row, 'Net follows'),
          reactions: int(row, 'Reactions'),
          shares: int(row, 'Shares'),
          comments_and_replies: int(row, 'Comments and replies'),
          viewers: int(row, 'Viewers'),
          views: int(row, 'Views'),
          raw: row,
        });
      }
    } else {
      return { ok: false, message: `${file.name} does not match the expected Facebook Content or Page Activity export format.` };
    }
  }

  const { data: batch, error: importError } = await db
    .from('goodgame_organic_social_imports')
    .insert({
      source_label: `${inferredBrand ?? 'Good Game'} organic social CSV upload`,
      brand: inferredBrand,
      report_start_date: reportStart,
      report_end_date: reportEnd,
      content_file_names: contentFileNames,
      profile_file_names: profileFileNames,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (importError) return { ok: false, message: `Import setup failed: ${importError.message}` };

  const withImport = (row: Record<string, unknown>) => ({ ...row, import_id: batch.id, updated_at: new Date().toISOString() });
  if (postRows.length) {
    const { error } = await db
      .from('goodgame_organic_social_posts')
      .upsert(postRows.map(withImport), { onConflict: 'platform,page_id,post_id,publish_time' });
    if (error) return { ok: false, message: `Post import failed: ${error.message}` };
  }

  if (dailyRows.length) {
    const { error } = await db
      .from('goodgame_organic_social_daily_metrics')
      .upsert(dailyRows.map(withImport), { onConflict: 'platform,page_id,metric_date' });
    if (error) return { ok: false, message: `Daily metric import failed: ${error.message}` };
  }

  revalidatePath(DASHBOARD_PATH);
  return { ok: true, message: `Imported ${postRows.length} post rows and ${dailyRows.length} daily metric rows${inferredBrand ? ` for ${inferredBrand}` : ''}.` };
}
