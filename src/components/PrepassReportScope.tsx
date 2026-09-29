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
  const matches = Boolean(readout.currentStart && readout.currentEnd)
    && readout.currentStart === filters.start && readout.currentEnd === filters.end
    && (!filters.channel || filters.channel === 'all')
    && (!filters.focus || filters.focus === 'all');
  return (
    <div role="note" className={`px-8 py-4 border-b ${matches ? 'bg-gray-50 border-gray-100 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
      <p className="font-bold">{matches ? 'Saved weekly summary' : 'Different scope from selected metrics'}</p>
      <p className="text-sm font-bold mt-1">Historical summary — not refreshed from current source data</p>
      <p className="text-sm mt-1">Saved summary: {dateRange(readout.currentStart, readout.currentEnd)} · All channels · All segments</p>
      <p className="text-sm mt-1">Selected metrics: {dateRange(filters.start, filters.end)} · {filters.channel && filters.channel !== 'all' ? filters.channel : 'All channels'} · {filters.focus && filters.focus !== 'all' ? filters.focus : 'All segments'}</p>
      <p className="text-sm font-medium mt-2">This stored narrative does not recalculate when filters change. Its figures may differ from current scorecards because source data can be revised.</p>
    </div>
  );
}
