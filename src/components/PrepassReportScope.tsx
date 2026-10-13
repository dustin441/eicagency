import type { FilterParams, WeeklyExecutiveReadout } from '@/services/analytics';

function dateRange(start: string, end: string) {
  if (!start || !end) return 'Summary dates unavailable';
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${format(start)} – ${format(end)}`;
}

/** A stored readout is not a live calculation, even when its date window matches. */
export default function PrepassReportScope({ readout, filters }: {
  readout: Pick<WeeklyExecutiveReadout, 'currentStart' | 'currentEnd'>;
  filters: FilterParams;
}) {
  const hasSummaryDates = Boolean(readout.currentStart && readout.currentEnd);
  const matches = hasSummaryDates
    && readout.currentStart === filters.start && readout.currentEnd === filters.end
    && (!filters.channel || filters.channel === 'all')
    && (!filters.focus || filters.focus === 'all');
  const summaryScope = `${dateRange(readout.currentStart, readout.currentEnd)} · All channels · All segments`;
  const selectedScope = `${dateRange(filters.start, filters.end)} · ${filters.channel && filters.channel !== 'all' ? filters.channel : 'All channels'} · ${filters.focus && filters.focus !== 'all' ? filters.focus : 'All segments'}`;

  return (
    <div role="note" className="px-8 py-3 border-b bg-slate-50 border-slate-100 text-slate-700">
      <p className="text-sm font-semibold">
        {!hasSummaryDates || matches ? 'Weekly summary context' : 'Weekly summary and scorecard periods'}
      </p>
      <p className="text-sm mt-1">
        {!hasSummaryDates
          ? `Scorecards: ${selectedScope}`
          : matches
          ? `Summary and scorecards: ${summaryScope}`
          : `Weekly summary: ${summaryScope} · Scorecards: ${selectedScope}`}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {!hasSummaryDates
          ? 'The saved weekly narrative does not include a reporting period. Scorecards still follow the selected filters.'
          : matches
          ? 'The weekly narrative is saved for this reporting period. Scorecards can reflect later source revisions.'
          : 'This is expected: the weekly narrative stays tied to its reporting period, while scorecards follow the selected filters.'}
      </p>
    </div>
  );
}
