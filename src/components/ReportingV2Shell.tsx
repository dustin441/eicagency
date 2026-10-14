'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORTING_V2_LINKS = [
  { name: 'Overview', href: '/dashboard/reporting-v2' },
  { name: 'SMB', href: '/dashboard/reporting-v2/smb' },
  { name: 'ABM', href: '/dashboard/reporting-v2/abm' },
  { name: 'FD360', href: '/dashboard/reporting-v2/fd360' },
  { name: 'Campaign Performance', href: '/dashboard/reporting-v2/campaign-performance' },
  { name: 'Reconciliation', href: '/dashboard/reporting-v2/reconciliation' },
] as const;

export default function ReportingV2Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-forest">PrePass Reporting v2</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{description}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          <GitCompareArrows className="h-4 w-4" /> Comparison only, no cutover
        </div>
      </header>

      <nav aria-label="Reporting v2 pages" className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {REPORTING_V2_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                  active ? 'bg-brand-forest text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950',
                )}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
