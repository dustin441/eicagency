'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  buildDashboardWorkbook,
  dashboardXlsxFilename,
  type DashboardWorkbookData,
} from '@/lib/dashboard-xlsx';
import { cn } from '@/lib/utils';

export default function DashboardXlsxDownloadButton({
  data,
  title,
  className,
}: {
  data: DashboardWorkbookData;
  title: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const record = data as Record<string, unknown>;
      const filters = (record.filterParams ?? record.params ?? record.filters) as Record<string, unknown> | undefined;
      const workbook = await buildDashboardWorkbook(data, title);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = dashboardXlsxFilename(title, filters);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      console.error('Dashboard XLSX download failed', cause);
      setError('Could not create the workbook. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-brand-dark shadow-sm transition hover:border-brand-forest/30 hover:bg-brand-forest/5 disabled:cursor-wait disabled:opacity-70',
          className,
        )}
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {downloading ? 'Preparing workbook…' : 'Download page XLSX'}
      </button>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
