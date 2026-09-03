import 'server-only';

import { createHash } from 'node:crypto';

import type {
  MonthlyReadout,
  MonthlyReportStats,
  PrepassMonthlySourceBundle,
} from './analytics.ts';

export const PREPASS_MONTHLY_FOCUSES = ['all', 'SMB', 'ABM', 'FD360'] as const;
export type PrepassMonthlyFocus = typeof PREPASS_MONTHLY_FOCUSES[number];

export type ReportMonthWindow = {
  monthStart: string;
  monthEnd: string;
  previousMonthStart: string;
  previousMonthEnd: string;
  trendStart: string;
};

export type PrepassMonthlyPublicationPayload = {
  schemaVersion: 2;
  monthStart: string;
  monthEnd: string;
  readout: MonthlyReadout;
  variants: Record<PrepassMonthlyFocus, MonthlyReportStats>;
};

export type BuiltPrepassMonthlyPublication = {
  monthStart: string;
  monthEnd: string;
  sourceCutoff: string;
  sourceHash: string;
  payloadHash: string;
  sourceRowCount: number;
  payload: PrepassMonthlyPublicationPayload;
};

export type MonthlyPublicationReceipt = {
  publicationId: string;
  revision: number;
  sourceHash: string;
  payloadHash: string;
  sourceRowCount: number;
  idempotent: boolean;
  monthStart: string;
  monthEnd: string;
};

export type ActivePrepassMonthlyPublication = MonthlyPublicationReceipt & {
  publishedAt: string;
  sourceCutoff: string;
  correctionReason: string | null;
  payload: PrepassMonthlyPublicationPayload;
};

export type PublicationBuildDependencies = {
  now?: () => Date;
  fetchSourceBundle?: (monthStart: string, capturedAt: Date) => Promise<PrepassMonthlySourceBundle>;
  deriveReport?: (bundle: PrepassMonthlySourceBundle, focus: PrepassMonthlyFocus) => MonthlyReportStats | Promise<MonthlyReportStats>;
  fetchReadout?: (monthStart: string) => Promise<MonthlyReadout>;
};

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function reportMonthWindow(monthStart: string, now = new Date()): ReportMonthWindow {
  if (!/^\d{4}-\d{2}-01$/.test(monthStart)) throw new Error('monthStart must be the first day of a month');
  const start = new Date(`${monthStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || iso(start) !== monthStart) throw new Error('monthStart is invalid');
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (start >= currentMonth) throw new Error('monthStart must identify a completed month');
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const previousEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  const trendStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 5, 1));
  return {
    monthStart,
    monthEnd: iso(end),
    previousMonthStart: iso(previousStart),
    previousMonthEnd: iso(previousEnd),
    trendStart: iso(trendStart),
  };
}

export function latestCompletedMonthStart(now = new Date()): string {
  return iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

function canonicalize(value: unknown, path = '$'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Canonical values must be finite at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${path}[${index}]`));
  if (typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      if (input[key] === undefined) throw new Error(`Unsupported undefined value at ${path}.${key}`);
      output[key] = canonicalize(input[key], `${path}.${key}`);
    }
    return output;
  }
  throw new Error(`Unsupported canonical value at ${path}`);
}

export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

async function defaultFetchSourceBundle(monthStart: string, capturedAt: Date) {
  const { fetchPrepassMonthlySourceBundle } = await import('./analytics');
  return fetchPrepassMonthlySourceBundle(monthStart, capturedAt);
}

async function defaultDeriveReport(bundle: PrepassMonthlySourceBundle, focus: PrepassMonthlyFocus) {
  const { deriveMonthlyReportData } = await import('./analytics');
  return deriveMonthlyReportData(bundle, focus);
}

async function defaultFetchReadout(monthStart: string) {
  const { fetchMonthlyReadout } = await import('./analytics');
  return fetchMonthlyReadout(monthStart);
}

async function serverSupabaseClient() {
  const { createServerSupabaseClient } = await import('../lib/supabase-server');
  return createServerSupabaseClient();
}

export async function buildPrepassMonthlyPublication(
  monthStart: string,
  dependencies: PublicationBuildDependencies = {},
): Promise<BuiltPrepassMonthlyPublication> {
  const capturedAt = (dependencies.now ?? (() => new Date()))();
  const window = reportMonthWindow(monthStart, capturedAt);
  const fetchSourceBundle = dependencies.fetchSourceBundle ?? defaultFetchSourceBundle;
  const deriveReport = dependencies.deriveReport ?? defaultDeriveReport;
  const fetchReadout = dependencies.fetchReadout ?? defaultFetchReadout;
  // Source reads happen once, before any variant is derived. This prevents the
  // all/SMB/ABM/FD360 payloads from observing different ingestion states.
  const [sourceBundle, readout] = await Promise.all([
    fetchSourceBundle(monthStart, capturedAt),
    fetchReadout(monthStart),
  ]);
  const [all, smb, abm, fd360] = await Promise.all([
    deriveReport(sourceBundle, 'all'), deriveReport(sourceBundle, 'SMB'),
    deriveReport(sourceBundle, 'ABM'), deriveReport(sourceBundle, 'FD360'),
  ]);
  const variants = { all, SMB: smb, ABM: abm, FD360: fd360 };
  for (const [focus, report] of Object.entries(variants)) {
    if (report.focus !== focus || report.currentMonthStart !== window.monthStart || report.currentMonthEnd !== window.monthEnd) {
      throw new Error(`Monthly ${focus} report month does not match the requested report month`);
    }
  }
  if (readout.monthStart !== window.monthStart || readout.monthEnd !== window.monthEnd) {
    throw new Error('Monthly narrative month does not match the requested report month');
  }
  // The database records when the mutable sources were actually captured.
  // Capture time is intentionally excluded from both hashes so an unchanged
  // source bundle remains idempotent when a workflow retry happens later.
  const sourceCutoffAt = sourceBundle.capturedAt;
  const hashableSourceBundle = { ...sourceBundle };
  delete (hashableSourceBundle as Partial<PrepassMonthlySourceBundle>).capturedAt;
  const sourceEvidence = { monthStart, monthEnd: window.monthEnd, sourceBundle: hashableSourceBundle };
  const payload: PrepassMonthlyPublicationPayload = {
    schemaVersion: 2, monthStart, monthEnd: window.monthEnd, readout, variants,
  };
  return {
    monthStart, monthEnd: window.monthEnd, sourceCutoff: sourceCutoffAt, payload,
    sourceHash: canonicalHash(sourceEvidence),
    payloadHash: canonicalHash(payload),
    sourceRowCount: sourceBundle.sourceRowCount,
  };
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Publication RPC returned invalid ${label}`);
  return value;
}

export async function publishPrepassMonthlyPublication(
  monthStart: string,
  correctionReason?: string,
): Promise<MonthlyPublicationReceipt> {
  const built = await buildPrepassMonthlyPublication(monthStart);
  const supabase = await serverSupabaseClient();
  const { data, error } = await supabase.rpc('prepass_publish_monthly_publication', {
    p_report_month: built.monthStart,
    p_source_period_start: built.monthStart,
    p_source_period_end: built.monthEnd,
    p_source_cutoff_at: built.sourceCutoff,
    p_source_hash: built.sourceHash,
    p_payload_hash: built.payloadHash,
    p_source_row_count: built.sourceRowCount,
    p_payload: built.payload,
    p_correction_reason: correctionReason ?? null,
  });
  if (error) throw new Error('Unable to persist monthly publication');
  const raw = Array.isArray(data) ? data[0] : data;
  const row = raw as Record<string, unknown> | null;
  if (!row) throw new Error('Publication RPC returned no receipt');
  return {
    publicationId: nonEmptyString(row.publication_id, 'publication ID'),
    revision: Number(row.publication_revision), sourceHash: built.sourceHash, payloadHash: built.payloadHash,
    sourceRowCount: built.sourceRowCount, idempotent: Boolean(row.idempotent),
    monthStart: built.monthStart, monthEnd: built.monthEnd,
  };
}

export async function fetchActivePrepassMonthlyPublication(
  monthStart?: string,
): Promise<ActivePrepassMonthlyPublication> {
  const supabase = await serverSupabaseClient();
  let query = supabase.from('prepass_monthly_publications_active')
    .select('id,revision,report_month,source_period_end,published_at,source_cutoff_at,source_hash,payload_hash,source_row_count,correction_reason,payload');
  query = monthStart
    ? query.eq('report_month', reportMonthWindow(monthStart).monthStart)
    : query.order('report_month', { ascending: false }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error('Unable to load active monthly publication');
  const row = data as unknown as Record<string, unknown> | null;
  if (!row) throw new Error(monthStart
    ? `No active monthly publication exists for ${monthStart}`
    : 'No active monthly publication exists');
  const reportMonth = nonEmptyString(row.report_month, 'report month').slice(0, 10);
  const window = reportMonthWindow(reportMonth);
  const payload = row.payload as PrepassMonthlyPublicationPayload;
  if (!payload || payload.schemaVersion !== 2 || payload.monthStart !== window.monthStart || payload.monthEnd !== window.monthEnd) {
    throw new Error('Active monthly publication payload is invalid');
  }
  const payloadHash = nonEmptyString(row.payload_hash, 'payload hash');
  if (canonicalHash(payload) !== payloadHash) throw new Error('Active monthly publication payload hash mismatch');
  return {
    publicationId: nonEmptyString(row.id, 'publication ID'), revision: Number(row.revision),
    monthStart: window.monthStart, monthEnd: window.monthEnd,
    sourceHash: nonEmptyString(row.source_hash, 'source hash'), payloadHash,
    sourceRowCount: Number(row.source_row_count), idempotent: true,
    publishedAt: nonEmptyString(row.published_at, 'published time'),
    sourceCutoff: nonEmptyString(row.source_cutoff_at, 'source cutoff'),
    correctionReason: typeof row.correction_reason === 'string' ? row.correction_reason : null,
    payload,
  };
}
