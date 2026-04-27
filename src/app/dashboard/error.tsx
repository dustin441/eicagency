'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <RefreshCw className="w-7 h-7 text-red-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">Data Overload</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Too much data hit the pipeline at once. Please refresh to try again.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 bg-brand-forest text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-forest/90 transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
