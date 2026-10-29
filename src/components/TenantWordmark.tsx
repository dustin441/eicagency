import React from 'react';
import type { TenantConfig } from '@/lib/tenant';

/**
 * Tenant logo for dark surfaces. Uses the full logo file when configured; otherwise
 * the brand mark plus the agency name set in tracked caps (Scott Social brand deck style).
 */
export default function TenantWordmark({ tenant, className = 'h-10 w-auto' }: { tenant: TenantConfig; className?: string }) {
  if (tenant.logo.dark) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.logo.dark} alt={tenant.agencyName} className={className} />;
  }
  return (
    <span className="inline-flex items-center gap-3 text-white" aria-label={tenant.agencyName}>
      {tenant.logo.mark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logo.mark} alt="" className="h-9 w-auto" />
      )}
      <span className="text-lg font-semibold uppercase tracking-[0.25em] leading-none whitespace-nowrap">
        {tenant.agencyName}
      </span>
    </span>
  );
}

/** Inline style for the login / password screens' full-bleed background, if the tenant has one. */
export function tenantAuthBackgroundStyle(tenant: TenantConfig): React.CSSProperties | undefined {
  if (!tenant.authBackground) return undefined;
  // Midnight overlay keeps white text and the glass card readable over the gradient.
  return {
    backgroundImage: `linear-gradient(rgba(0, 5, 36, 0.55), rgba(0, 5, 36, 0.55)), url(${tenant.authBackground})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
