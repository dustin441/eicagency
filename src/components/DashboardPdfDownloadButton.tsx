'use client';

import React, { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

export default function DashboardPdfDownloadButton({ className, client }: { className?: string; client?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientSlug = useMemo(() => {
    if (client) return client;
    const [, dashboard, slug] = pathname.split('/');
    return dashboard === 'dashboard' && slug ? slug : 'spartaco';
  }, [client, pathname]);

  const exportUrl = useMemo(() => {
    const query = searchParams.toString();
    const currentPath = query ? `${pathname}?${query}` : pathname;
    return `/api/dashboard/${clientSlug}/pdf?path=${encodeURIComponent(currentPath)}`;
  }, [clientSlug, pathname, searchParams]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
      });
      const contentType = response.headers.get('content-type') ?? '';

      if (!response.ok || !contentType.includes('application/pdf')) {
        throw new Error('PDF export failed. Refresh the dashboard and try again.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download =
        filenameFromDisposition(response.headers.get('content-disposition')) ??
        `${clientSlug}-dashboard.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn('flex flex-col items-start gap-1 sm:items-end', className)} data-pdf-hidden="true">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-brand-forest shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span>{downloading ? 'Preparing PDF' : 'Download PDF'}</span>
      </button>
      {error && <span className="max-w-56 text-xs font-medium text-rose-600">{error}</span>}
    </div>
  );
}
