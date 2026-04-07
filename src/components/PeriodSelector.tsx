'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PERIODS = ['Day', 'Week', 'Month', 'Year'] as const;

export default function PeriodSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('period') ?? 'month';

  return (
    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm self-start">
      {PERIODS.map((p) => {
        const value = p.toLowerCase();
        return (
          <button
            key={p}
            onClick={() => router.push(`/dashboard?period=${value}`)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              current === value
                ? 'bg-brand-forest text-white shadow-md shadow-brand-forest/10'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
