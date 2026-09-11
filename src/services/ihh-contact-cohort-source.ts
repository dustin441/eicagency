import 'server-only';
import { z } from 'zod';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { buildIhhContactCohort, type IhhCohortInput, type IhhCohortPublicState, sanitizeIhhCohort } from './ihh-contact-cohort';

const LOCATION = 'm1hqL3irI6uiyW5tCGhR';
const instant = z.string().datetime({ offset: true });
const coverage = z.object({ status: z.enum(['complete', 'partial', 'none', 'unknown']), evidence: z.string().min(1) });
export const ihhManifestSchema = z.object({
  location_id: z.literal(LOCATION), export_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal('published'), source_table: z.literal('ihh_funnel_contacts'),
  classifier_version: z.literal('preserved_native_snapshots'), classification_evidence: z.string().min(1),
  cohort_start: instant, cohort_end_exclusive: instant, observation_cutoff: instant,
  row_count: z.number().int().min(0).max(100000), published_at: instant,
  coverage: z.object({ quizLead: coverage, appointmentScheduled: coverage, closerScheduled: coverage, closedWon: coverage }),
});
const rowSchema = z.object({
  location_id: z.literal(LOCATION), contact_id: z.string().min(1), contact_key: z.string(),
  export_sha256: z.string(), lead_at: instant, quiz_taker: z.literal(true),
  appointment_scheduled: z.boolean().nullable(), appointment_at: instant.nullable(),
  opportunity_id: z.string().min(1), attribution_channel: z.literal('paid_social'),
  attribution_source: z.enum(['facebook', 'instagram']), snapshot_at: instant,
  snapshot_schema_version: z.string().refine(value => value.trim().length > 0), source_table: z.literal('ihh_funnel_contacts'),
  lifecycle_tracking_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payload: z.object({ lifecycle_events: z.array(z.object({
    event_type: z.string(), event_at: instant, is_qa: z.literal(false),
  })) }),
});
/** Validate the entire immutable export before core filters the clipped cohort. */
export function inputFromIhhExport(rawManifest: unknown, rawRows: unknown[], start: string, end: string): IhhCohortInput {
  const m = ihhManifestSchema.parse(rawManifest);
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(start) >= Date.parse(end)
    || Date.parse(start) < Date.parse(m.cohort_start) || Date.parse(end) > Date.parse(m.cohort_end_exclusive)
    || Date.parse(m.cohort_start) >= Date.parse(m.cohort_end_exclusive) || Date.parse(m.observation_cutoff) < Date.parse(m.cohort_end_exclusive)
    || Date.parse(m.observation_cutoff) > Date.parse(m.published_at) || Date.parse(m.published_at) > Date.now()) throw new Error('Unmatched scope');
  if (rawRows.length !== m.row_count) throw new Error('Incomplete export');
  const contacts: IhhCohortInput['contacts'][number][] = [], events: IhhCohortInput['events'][number][] = [];
  const seen = new Set<string>();
  for (const raw of rawRows) {
    const r = rowSchema.parse(raw);
    if (r.export_sha256 !== m.export_sha256 || r.contact_key !== `ghl:${r.contact_id}` || seen.has(r.contact_id)
      || Date.parse(r.lead_at) < Date.parse(m.cohort_start) || Date.parse(r.lead_at) >= Date.parse(m.cohort_end_exclusive)
      || Date.parse(r.snapshot_at) > Date.parse(m.observation_cutoff)) throw new Error('Invalid export row');
    seen.add(r.contact_id);
    contacts.push({ contactId: r.contact_id, quizEntryAt: r.lead_at, acquisition: 'paid', attributionSnapshot: {
      normalizedSource: r.attribution_source, normalizedChannel: r.attribution_channel,
      schemaVersion: r.snapshot_schema_version, snapshotAt: r.snapshot_at, conflict: false,
    } });
    if (r.appointment_scheduled && !r.appointment_at && m.coverage.appointmentScheduled.status === 'complete') {
      m.coverage.appointmentScheduled = { status: 'partial', evidence: 'An observed appointment lacks its scheduling timestamp' };
    }
    if (r.appointment_at && !r.appointment_scheduled) throw new Error('Inconsistent schedule');
    if (r.appointment_scheduled && r.appointment_at) events.push({ contactId: r.contact_id, stage: 'appointmentScheduled', occurredAt: r.appointment_at });
    for (const event of r.payload.lifecycle_events) {
      const stage = event.event_type === 'closer_booked' ? 'closerScheduled' : event.event_type === 'closed_won' ? 'closedWon' : null;
      if (stage) events.push({ contactId: r.contact_id, stage, occurredAt: event.event_at });
    }
    for (const stage of ['closerScheduled', 'closedWon'] as const) {
      if (m.coverage[stage].status === 'complete' && start.slice(0, 10) < r.lifecycle_tracking_start) throw new Error('History coverage not established');
    }
  }
  return { cohortStart: start, cohortEndExclusive: end, observationCutoff: m.observation_cutoff,
    acquisitionFilter: 'paid', classificationEvidence: m.classification_evidence, contacts, events, coverage: m.coverage };
}

/** Only called after route authorization. Publisher must commit rows + published manifest atomically and immutably. */
export async function fetchIhhMetaPaidCohort(params: { start: string; end: string; sinceCollectionStart?: boolean }): Promise<IhhCohortPublicState> {
  try {
    for (const day of [params.start, params.end]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Invalid date');
    }
    const requestedStart = new Date(`${params.start}T00:00:00Z`).toISOString();
    const endDate = new Date(`${params.end}T00:00:00Z`); endDate.setUTCDate(endDate.getUTCDate() + 1);
    const requestedEnd = endDate.toISOString();
    if (Date.parse(requestedStart) >= Date.parse(requestedEnd)) return { status: 'blocked' };
    const db = createEicSupabaseClient();
    const { data, error } = await db.from('ihh_meta_paid_cohort_manifests').select('*')
      .eq('location_id', LOCATION).eq('status', 'published')
      .order('published_at', { ascending: false }).order('export_sha256', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error('Manifest unavailable');
    if (!data) return { status: 'blocked' };
    const m = ihhManifestSchema.parse(data);
    if (Date.parse(m.observation_cutoff) > Date.parse(m.published_at) || Date.parse(m.published_at) > Date.now()
      || Date.parse(m.cohort_start) >= Date.parse(m.cohort_end_exclusive)
      || Date.parse(m.cohort_end_exclusive) > Date.parse(m.observation_cutoff)) throw new Error('Invalid manifest times');
    if (Date.now() - Date.parse(m.observation_cutoff) > 6 * 60 * 60 * 1000) return { status: 'stale', observationCutoff: m.observation_cutoff };
    const hash = m.export_sha256;
    const start = params.sinceCollectionStart ? new Date(m.cohort_start).toISOString()
      : new Date(Math.max(Date.parse(requestedStart), Date.parse(m.cohort_start))).toISOString();
    const end = params.sinceCollectionStart ? new Date(m.cohort_end_exclusive).toISOString()
      : new Date(Math.min(Date.parse(requestedEnd), Date.parse(m.cohort_end_exclusive), Date.parse(m.observation_cutoff))).toISOString();
    if (Date.parse(start) >= Date.parse(end)) return { status: 'blocked' };
    const rows: unknown[] = [];
    for (let offset = 0; offset < Math.max(1, m.row_count); offset += 500) {
      const expected = Math.min(500, m.row_count - offset);
      const size = Math.max(1, expected);
      const page = await db.from('ihh_meta_paid_original_cohort')
        .select('location_id,contact_id,contact_key,export_sha256,lead_at,quiz_taker,appointment_scheduled,appointment_at,opportunity_id,attribution_channel,attribution_source,snapshot_at,snapshot_schema_version,source_table,lifecycle_tracking_start,payload', { count: 'exact' })
        .eq('location_id', LOCATION).eq('export_sha256', hash).order('contact_id', { ascending: true }).range(offset, offset + size - 1);
      if (page.error || page.count !== m.row_count || page.data?.length !== expected) throw new Error('Incomplete page');
      rows.push(...page.data);
    }
    return { status: 'ready', cohort: sanitizeIhhCohort(buildIhhContactCohort(inputFromIhhExport(m, rows, start, end))) };
  } catch {
    return { status: 'error' }; // Never leak raw source errors, evidence or identifiers.
  }
}
