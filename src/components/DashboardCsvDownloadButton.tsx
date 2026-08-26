'use client';

import { Download } from 'lucide-react';
import { buildDashboardCsv, dashboardCsvFilename, type DashboardCsvData } from '@/lib/dashboard-csv';
import { cn } from '@/lib/utils';

export default function DashboardCsvDownloadButton({
  data,
  title,
  className,
}: {
  data: DashboardCsvData;
  title: string;
  className?: string;
}) {
  function download() {
    const record = data as Record<string, unknown>;
    const filters = (record.filterParams ?? record.params ?? record.filters) as Record<string, unknown> | undefined;
    const blob = new Blob([buildDashboardCsv(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = dashboardCsvFilename(title, filters);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-brand-dark shadow-sm transition hover:border-brand-forest/30 hover:bg-brand-forest/5',
        className,
      )}
    >
      <Download className="h-4 w-4" />
      Download page CSV
    </button>
  );
}
