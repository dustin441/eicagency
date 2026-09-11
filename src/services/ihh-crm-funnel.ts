import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { IhhFilterParams } from '@/services/ihh-analytics';

// The IHH lifecycle ledger (closer_booked / closed_won events, synced from
// GoHighLevel via `ihh_lifecycle_events`) only started recording on this
// date. Lead/Appointment stages come from `ihh_funnel_contacts`, which has
// full history back to 2025-03 — so the two halves of this funnel have very
// different coverage windows. See ihhLifecycleCoverage().
export const IHH_LIFECYCLE_TRACKING_START = '2026-08-28';

export type IhhLifecycleCoverage = 'none' | 'partial' | 'full';

export type IhhCrmFunnelStage = {
  key: 'lead' | 'appointment' | 'closerScheduled' | 'closedWon';
  label: string;
  value: number;
};

export type IhhCrmFunnel = {
  stages: IhhCrmFunnelStage[];
  leadToAppointmentRate: number | null;
  appointmentToCloserRate: number | null;
  closerToWonRate: number | null;
  avgDaysLeadToAppointment: number | null;
  avgDaysAppointmentToCloser: number | null;
  avgDaysCloserToWon: number | null;
  lifecycleCoverage: IhhLifecycleCoverage;
  lifecycleTrackingStart: string;
};

type FunnelContactRow = {
  contact_key: string;
  lead_at: string | null;
  quiz_taker: boolean | null;
  appointment_scheduled: boolean | null;
  appointment_at: string | null;
};

type LifecycleEventRow = {
  event_type: string;
  contact_id: string;
  event_at: string;
};

function ihhLifecycleCoverage(start: string, end: string): IhhLifecycleCoverage {
  if (end < IHH_LIFECYCLE_TRACKING_START) return 'none';
  if (start < IHH_LIFECYCLE_TRACKING_START) return 'partial';
  return 'full';
}

function dayBounds(start: string, end: string) {
  return { startTs: `${start}T00:00:00.000Z`, endTs: `${end}T23:59:59.999Z` };
}

function avgDaysBetween(pairs: { from: string; to: string }[]): number | null {
  if (pairs.length === 0) return null;
  const totalMs = pairs.reduce((sum, p) => sum + (new Date(p.to).getTime() - new Date(p.from).getTime()), 0);
  return totalMs / pairs.length / (1000 * 60 * 60 * 24);
}

// Contacts whose lead OR appointment timestamp falls in the window. A row
// matched only on appointment_at can still carry a lead_at from long before
// the window (an older lead converting now) — that's needed for the
// Lead → Appointment avg-days calc, so both columns are always selected.
async function fetchPagedFunnelContacts(
  db: ReturnType<typeof createEicSupabaseClient>,
  startTs: string,
  endTs: string,
): Promise<FunnelContactRow[]> {
  const rows: FunnelContactRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_funnel_contacts')
      .select('contact_key,lead_at,quiz_taker,appointment_scheduled,appointment_at')
      .or(`and(lead_at.gte.${startTs},lead_at.lte.${endTs}),and(appointment_at.gte.${startTs},appointment_at.lte.${endTs})`)
      .order('lead_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH funnel contacts: ${error.message}`);
    const page = (data ?? []) as unknown as FunnelContactRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

// The lifecycle ledger is small (tracking just started) — pull it whole each
// time rather than windowing, so a closer_booked event from before the
// selected range is still available to pair with a closed_won inside it.
async function fetchAllLifecycleEvents(
  db: ReturnType<typeof createEicSupabaseClient>,
): Promise<LifecycleEventRow[]> {
  const rows: LifecycleEventRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('ihh_lifecycle_events')
      .select('event_type,contact_id,event_at')
      .in('event_type', ['closer_booked', 'closed_won'])
      .order('event_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch IHH lifecycle events: ${error.message}`);
    const page = (data ?? []) as unknown as LifecycleEventRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

// Powers the "Funnel Distribution" card on the IHH dashboard: Lead →
// Appointment → Closer Scheduled → Closed Won. Lead/Appointment are CRM
// contact facts (ihh_funnel_contacts); Closer Scheduled/Closed Won are
// derived from the ihh_lifecycle_events ledger, keyed by GHL contact id
// (`ghl:{contact_id}` matches ihh_funnel_contacts.contact_key).
export async function fetchIhhCrmFunnel(params: IhhFilterParams): Promise<IhhCrmFunnel> {
  const { start, end } = params;
  const { startTs, endTs } = dayBounds(start, end);
  const db = createEicSupabaseClient();

  const [contacts, lifecycleEvents] = await Promise.all([
    fetchPagedFunnelContacts(db, startTs, endTs),
    fetchAllLifecycleEvents(db),
  ]);

  const leadContacts = contacts.filter(c => c.quiz_taker && c.lead_at && c.lead_at >= startTs && c.lead_at <= endTs);
  const apptContacts = contacts.filter(c => c.appointment_scheduled && c.appointment_at && c.appointment_at >= startTs && c.appointment_at <= endTs);

  const leadAtByContact = new Map(contacts.filter(c => c.lead_at).map(c => [c.contact_key, c.lead_at!]));
  const apptAtByContact = new Map(contacts.filter(c => c.appointment_scheduled && c.appointment_at).map(c => [c.contact_key, c.appointment_at!]));

  const leadToApptPairs = apptContacts
    .map(c => ({ from: leadAtByContact.get(c.contact_key), to: c.appointment_at! }))
    .filter((p): p is { from: string; to: string } => Boolean(p.from));

  // Earliest occurrence per contact per event type, keyed to the
  // ihh_funnel_contacts.contact_key format.
  const firstEventByContact = new Map<string, Map<string, string>>();
  for (const row of lifecycleEvents) {
    const key = `ghl:${row.contact_id}`;
    const byType = firstEventByContact.get(key) ?? new Map<string, string>();
    if (!byType.has(row.event_type)) byType.set(row.event_type, row.event_at);
    firstEventByContact.set(key, byType);
  }

  const closerInWindow: { contactKey: string; eventAt: string }[] = [];
  const wonInWindow: { contactKey: string; eventAt: string }[] = [];
  for (const [contactKey, byType] of firstEventByContact) {
    const closerAt = byType.get('closer_booked');
    const wonAt = byType.get('closed_won');
    if (closerAt && closerAt >= startTs && closerAt <= endTs) closerInWindow.push({ contactKey, eventAt: closerAt });
    if (wonAt && wonAt >= startTs && wonAt <= endTs) wonInWindow.push({ contactKey, eventAt: wonAt });
  }

  const apptToCloserPairs = closerInWindow
    .map(c => ({ from: apptAtByContact.get(c.contactKey), to: c.eventAt }))
    .filter((p): p is { from: string; to: string } => Boolean(p.from));

  const closerToWonPairs = wonInWindow
    .map(c => {
      const closerAt = firstEventByContact.get(c.contactKey)?.get('closer_booked');
      return closerAt ? { from: closerAt, to: c.eventAt } : null;
    })
    .filter((p): p is { from: string; to: string } => p !== null);

  const leadCount = leadContacts.length;
  const apptCount = apptContacts.length;
  const closerCount = closerInWindow.length;
  const wonCount = wonInWindow.length;

  return {
    stages: [
      { key: 'lead', label: 'Lead', value: leadCount },
      { key: 'appointment', label: 'Appointment', value: apptCount },
      { key: 'closerScheduled', label: 'Closer Scheduled', value: closerCount },
      { key: 'closedWon', label: 'Closed Won', value: wonCount },
    ],
    leadToAppointmentRate: leadCount > 0 ? (apptCount / leadCount) * 100 : null,
    appointmentToCloserRate: apptCount > 0 ? (closerCount / apptCount) * 100 : null,
    closerToWonRate: closerCount > 0 ? (wonCount / closerCount) * 100 : null,
    avgDaysLeadToAppointment: avgDaysBetween(leadToApptPairs),
    avgDaysAppointmentToCloser: avgDaysBetween(apptToCloserPairs),
    avgDaysCloserToWon: avgDaysBetween(closerToWonPairs),
    lifecycleCoverage: ihhLifecycleCoverage(start, end),
    lifecycleTrackingStart: IHH_LIFECYCLE_TRACKING_START,
  };
}
