'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import DashboardPdfDownloadButton from './DashboardPdfDownloadButton';
import { SpartacoPdfContext } from './SpartacoPdfContext';

/** Only mounted by completed Spartaco pages, never by a layout/loading/error boundary. */
export default function SpartacoPdfReport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const identity = `${pathname}?${searchParams.toString()}`;
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(identity));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [identity]);
  return (
    <SpartacoPdfContext.Provider value={searchParams.get('pdf') === '1'}>
    <div data-spartaco-pdf-ready={ready === identity ? pathname : undefined}>
      <style>{`@media print { [data-spartaco-pdf-ready] * { box-shadow: none !important; backdrop-filter: none !important; } }`}</style>
      <div className="mb-4 flex justify-end" data-pdf-hidden="true"><DashboardPdfDownloadButton client="spartaco" /></div>
      {children}
    </div>
    </SpartacoPdfContext.Provider>
  );
}
