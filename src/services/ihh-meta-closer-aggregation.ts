export const IHH_META_CLOSER_ACTION_TYPE = 'offsite_conversion.custom.1794339368427062';
export const IHH_META_CLOSER_RELIABLE_START = '2026-09-11';
export const IHH_META_CLOSER_ATTRIBUTION_LABEL = '7-day click and 1-day view';

export type IhhMetaCloserCoverage = 'none' | 'partial' | 'full';

export type IhhMetaCloserRow = {
  date: string;
  cost: number | null;
  closer_appointments: number | null;
};

export type IhhMetaCloserAggregation = {
  coverage: IhhMetaCloserCoverage;
  trackingStart: string;
  available: boolean;
  spend: number;
  closerAppointments: number | null;
  costPerCloserAppointment: number | null;
  daily: Array<{
    label: string;
    closerAppointments: number | null;
    costPerCloserAppointment: number | null;
  }>;
};

export function ihhMetaCloserCoverage(start: string, end: string): IhhMetaCloserCoverage {
  if (end < IHH_META_CLOSER_RELIABLE_START) return 'none';
  if (start < IHH_META_CLOSER_RELIABLE_START) return 'partial';
  return 'full';
}

/**
 * Aggregates the exact IHH Meta custom conversion by account reporting date.
 * Spend always covers the complete selected period so the cost metric matches
 * Meta Ads Manager for the same account, filters, dates, and attribution window.
 */
export function aggregateIhhMetaCloserRows(
  rows: IhhMetaCloserRow[],
  start: string,
  end: string,
): IhhMetaCloserAggregation {
  const selected = rows.filter(row => row.date >= start && row.date <= end);
  const coverage = ihhMetaCloserCoverage(start, end);
  const spend = selected.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const attributableRows = selected.filter(row => row.date >= IHH_META_CLOSER_RELIABLE_START);
  const available = coverage !== 'none'
    && attributableRows.length > 0
    && attributableRows.every(row => row.closer_appointments !== null && row.closer_appointments !== undefined);

  const closerAppointments = available
    ? attributableRows.reduce((sum, row) => sum + Number(row.closer_appointments ?? 0), 0)
    : null;

  const byDate = new Map<string, { spend: number; conversions: number; available: boolean }>();
  for (const row of selected) {
    const tracked = row.date >= IHH_META_CLOSER_RELIABLE_START;
    const existing = byDate.get(row.date) ?? { spend: 0, conversions: 0, available: tracked };
    existing.spend += Number(row.cost ?? 0);
    if (tracked) {
      if (row.closer_appointments === null || row.closer_appointments === undefined) existing.available = false;
      else existing.conversions += Number(row.closer_appointments);
    } else {
      existing.available = false;
    }
    byDate.set(row.date, existing);
  }

  return {
    coverage,
    trackingStart: IHH_META_CLOSER_RELIABLE_START,
    available,
    spend,
    closerAppointments,
    costPerCloserAppointment: closerAppointments !== null && closerAppointments > 0
      ? spend / closerAppointments
      : null,
    daily: Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({
        label,
        closerAppointments: value.available ? value.conversions : null,
        costPerCloserAppointment: value.available && value.conversions > 0
          ? value.spend / value.conversions
          : null,
      })),
  };
}
