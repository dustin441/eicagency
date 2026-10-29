import React from 'react';
import type { TenantConfig } from '@/lib/tenant';

/** Tenant logo for dark surfaces; text wordmark when no logo file is configured. */
export default function TenantWordmark({ tenant, className = 'h-10 w-auto' }: { tenant: TenantConfig; className?: string }) {
  if (tenant.logo.dark) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.logo.dark} alt={tenant.agencyName} className={className} />;
  }
  return (
    <span className="inline-flex items-baseline gap-1 font-bold tracking-tight text-white text-2xl leading-none">
      {tenant.agencyName}
      <span className="h-2 w-2 rounded-full bg-brand-orange" aria-hidden="true" />
    </span>
  );
}
