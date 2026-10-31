'use client';

export default function EicAgencyError({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-bold text-gray-900">EIC paid-media data is unavailable.</h2>
      <p className="text-sm text-gray-500">Please try again. No partial performance totals are shown.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-brand-forest px-5 py-2.5 text-sm font-bold text-white">Retry</button>
    </div>
  );
}
