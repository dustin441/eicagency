export const IHH_PIXEL_RELIABLE_START = '2026-08-19';

export type IhhPixelCoverage = 'none' | 'partial' | 'full';

export type IhhPixelRow = {
  date: string;
  cost: number | null;
  conversions: number | null;
  scheduled_appointments: number | null;
};

export type IhhPixelDailyPoint = {
  label: string;
  leads: number | null;
  scheduledAppointments: number | null;
};

export type IhhPixelAggregation = {
  coverage: IhhPixelCoverage;
  trackingStart: string;
  leads: number | null;
  scheduledAppointments: number | null;
  conversionRate: number | null;
  costPerLead: number | null;
  costPerScheduledAppointment: number | null;
  trackingSpend: number | null;
  daily: IhhPixelDailyPoint[];
};

export function ihhPixelCoverage(start: string, end: string): IhhPixelCoverage {
  if (end < IHH_PIXEL_RELIABLE_START) return 'none';
  if (start < IHH_PIXEL_RELIABLE_START) return 'partial';
  return 'full';
}

/**
 * Aggregates canonical Meta pixel outcomes already normalized in ihh_master.
 * `conversions` is the canonical offsite_conversion.fb_pixel_lead value and
 * `scheduled_appointments` is canonical schedule_total; callers must not add
 * Meta action aliases to these values.
 */
export function aggregateIhhPixelRows(
  rows: IhhPixelRow[],
  start: string,
  end: string,
): IhhPixelAggregation {
  const coverage = ihhPixelCoverage(start, end);
  const daily = new Map<string, IhhPixelDailyPoint>();
  let leads = 0;
  let scheduledAppointments = 0;
  let trackingSpend = 0;

  for (const row of rows) {
    if (row.date < start || row.date > end) continue;

    const tracked = row.date >= IHH_PIXEL_RELIABLE_START;
    const point = daily.get(row.date) ?? {
      label: row.date,
      leads: tracked ? 0 : null,
      scheduledAppointments: tracked ? 0 : null,
    };

    if (tracked) {
      const rowLeads = Number(row.conversions ?? 0);
      const rowSchedules = Number(row.scheduled_appointments ?? 0);
      leads += rowLeads;
      scheduledAppointments += rowSchedules;
      trackingSpend += Number(row.cost ?? 0);
      point.leads = Number(point.leads ?? 0) + rowLeads;
      point.scheduledAppointments = Number(point.scheduledAppointments ?? 0) + rowSchedules;
    }
    daily.set(row.date, point);
  }

  const hasCoverage = coverage !== 'none';
  return {
    coverage,
    trackingStart: IHH_PIXEL_RELIABLE_START,
    leads: hasCoverage ? leads : null,
    scheduledAppointments: hasCoverage ? scheduledAppointments : null,
    conversionRate: hasCoverage && leads > 0 ? (scheduledAppointments / leads) * 100 : null,
    costPerLead: hasCoverage && leads > 0 ? trackingSpend / leads : null,
    costPerScheduledAppointment: hasCoverage && scheduledAppointments > 0
      ? trackingSpend / scheduledAppointments
      : null,
    trackingSpend: hasCoverage ? trackingSpend : null,
    daily: Array.from(daily.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
