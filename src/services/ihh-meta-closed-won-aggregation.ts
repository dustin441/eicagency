export const IHH_META_CLOSED_WON_ACTION_TYPE = 'offsite_conversion.custom.1060284470313134';
export const IHH_META_CLOSED_WON_RELIABLE_START = '2026-10-05';
export const IHH_META_CLOSED_WON_ATTRIBUTION_LABEL = '7-day click and 1-day view';

export type IhhMetaClosedWonCoverage = 'none' | 'partial' | 'full';

export type IhhMetaClosedWonRow = {
  date: string;
  cost: number | null;
  purchases: number | null;
  revenue: number | null;
};

export type IhhMetaClosedWonAggregation = {
  coverage: IhhMetaClosedWonCoverage;
  trackingStart: string;
  available: boolean;
  spend: number;
  closedWon: number | null;
  revenue: number | null;
  costPerClosedWon: number | null;
  roas: number | null;
};

export function ihhMetaClosedWonCoverage(start: string, end: string): IhhMetaClosedWonCoverage {
  if (end < IHH_META_CLOSED_WON_RELIABLE_START) return 'none';
  if (start < IHH_META_CLOSED_WON_RELIABLE_START) return 'partial';
  return 'full';
}

/**
 * Aggregates the exact value-bearing IHH Closed Won custom conversion by Meta
 * account reporting date. Spend covers the complete selected period so CPA and
 * ROAS reconcile to Meta Ads Manager for the same dates and attribution window.
 */
export function aggregateIhhMetaClosedWonRows(
  rows: IhhMetaClosedWonRow[],
  start: string,
  end: string,
): IhhMetaClosedWonAggregation {
  const selected = rows.filter(row => row.date >= start && row.date <= end);
  const coverage = ihhMetaClosedWonCoverage(start, end);
  const spend = selected.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const attributableRows = selected.filter(row => row.date >= IHH_META_CLOSED_WON_RELIABLE_START);
  const available = coverage !== 'none'
    && attributableRows.length > 0
    && attributableRows.every(row => row.purchases !== null && row.purchases !== undefined
      && row.revenue !== null && row.revenue !== undefined);

  const closedWon = available
    ? attributableRows.reduce((sum, row) => sum + Number(row.purchases ?? 0), 0)
    : null;
  const revenue = available
    ? attributableRows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0)
    : null;

  return {
    coverage,
    trackingStart: IHH_META_CLOSED_WON_RELIABLE_START,
    available,
    spend,
    closedWon,
    revenue,
    costPerClosedWon: closedWon !== null && closedWon > 0 ? spend / closedWon : null,
    roas: revenue !== null && spend > 0 ? revenue / spend : null,
  };
}
