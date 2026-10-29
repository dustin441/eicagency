// White-label agency tenants. One codebase, one Vercel project per tenant.
//
// The tenant is chosen by the project-level env var NEXT_PUBLIC_TENANT_ID
// (unset = 'eic', so existing EIC deployments are unchanged). It is a build-time
// project setting, never a request value. The request host is only used to fail
// closed: a host that belongs to another tenant is rejected, so a misconfigured
// deployment can never serve one agency's brand or clients on the other's domain.
//
// Pure module (no server-only imports) so client components can read branding.

export type TenantId = 'eic' | 'scott-social';

export type TenantConfig = {
  id: TenantId;
  agencyName: string;
  productName: string;
  /** Exact production hostnames owned by this tenant. */
  hostnames: readonly string[];
  /** Client IDs this tenant may serve; null = no tenant-level cap (EIC). */
  allowedClients: readonly string[] | null;
  /** Default route after login / for `/` and `/dashboard`. */
  homePath: string;
  logo: {
    /** Full wordmark for dark backgrounds (sidebar, login). */
    dark: string | null;
    /** Compact brand mark shown next to the text wordmark when there is no full logo file. */
    mark: string | null;
  };
  favicon: string;
  /** Optional full-bleed background for the login / password screens. */
  authBackground: string | null;
  colors: {
    /** Main dark surface (sidebar, primary buttons). Maps to --color-brand-forest. */
    primary: string;
    /** Highlight / call-to-action color. Maps to --color-brand-orange. */
    accent: string;
    /** Darkest text color. Maps to --color-brand-dark. */
    dark: string;
    /** Light surface. Maps to --color-brand-light. */
    light: string;
  };
  loginHeadline: string;
  loginSubcopy: string;
  supportEmail: string | null;
  /** Company identity used in PDF / XLSX exports. */
  exportCompanyName: string;
  /** EIC-only extras: marketing site, GTM, agency tools, AI chat. */
  internalFeatures: boolean;
};

export const SCOTT_SOCIAL_CLIENTS = ['aurit', 'arabella', 'kinsey', 'bloom', 'champagne'] as const;

export const TENANTS: Record<TenantId, TenantConfig> = {
  eic: {
    id: 'eic',
    agencyName: 'EIC Agency',
    productName: 'EIC Client Portal',
    hostnames: ['analytics.eic.agency', 'eic.agency', 'www.eic.agency'],
    allowedClients: null,
    homePath: '/dashboard',
    logo: { dark: '/logo-white.svg', mark: null },
    favicon: '/favicon.svg?v=eic-logo-20260626',
    authBackground: null,
    colors: { primary: '#0B4A31', accent: '#EB541E', dark: '#0f172a', light: '#F9FAFB' },
    loginHeadline: 'Client Portal',
    loginSubcopy: 'Access your custom marketing analytics dashboard',
    supportEmail: null,
    exportCompanyName: 'EIC Agency',
    internalFeatures: true,
  },
  'scott-social': {
    id: 'scott-social',
    agencyName: 'Scott Social',
    productName: 'Scott Social Analytics',
    hostnames: ['analytics.scottsocialmarketing.com'],
    allowedClients: SCOTT_SOCIAL_CLIENTS,
    homePath: '/dashboard/aurit',
    // Brand kit (Scott Social Brand Deck + Icon/Patterns folders) has the "S" icon but no
    // full "Scott Social" lockup file, so the UI shows icon + text wordmark.
    logo: { dark: null, mark: '/tenants/scott-social/mark.png' },
    favicon: '/tenants/scott-social/favicon.png',
    authBackground: '/tenants/scott-social/login-bg.jpg',
    // Brand guidelines: Midnight Matrix, Digital Peach, Lumi.
    colors: { primary: '#000524', accent: '#EE6F40', dark: '#000524', light: '#FCFDF6' },
    loginHeadline: 'Client Analytics',
    loginSubcopy: 'Sign in to view your campaign performance.',
    supportEmail: null,
    exportCompanyName: 'Scott Social',
    internalFeatures: false,
  },
};

export function parseTenantId(value: string | null | undefined): TenantId | null {
  const id = (value ?? '').trim();
  return id === 'eic' || id === 'scott-social' ? id : null;
}

export type TenantResolution =
  | { ok: true; tenant: TenantConfig }
  | { ok: false; reason: string };

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
}

/**
 * Resolve the tenant for a deployment (and optionally a request host).
 * - configured unset → 'eic'; configured but unknown → fail closed.
 * - host owned by a different tenant → fail closed.
 * - any other host (localhost, *.vercel.app previews) → the configured tenant.
 */
export function resolveTenant(input: { configured: string | null | undefined; host?: string | null }): TenantResolution {
  const raw = (input.configured ?? '').trim();
  const id = raw === '' ? 'eic' : parseTenantId(raw);
  if (!id) return { ok: false, reason: `Unknown tenant "${raw}"` };
  const tenant = TENANTS[id];

  const host = normalizeHost(input.host);
  if (host) {
    const owner = (Object.values(TENANTS) as TenantConfig[]).find(t => t.hostnames.includes(host));
    if (owner && owner.id !== tenant.id) {
      return { ok: false, reason: `Host ${host} belongs to tenant ${owner.id}, deployment is ${tenant.id}` };
    }
  }
  return { ok: true, tenant };
}

/** The deployment's tenant from its env, ignoring the host (static, safe for rendering). */
export function getDeploymentTenant(): TenantConfig {
  const resolved = resolveTenant({ configured: process.env.NEXT_PUBLIC_TENANT_ID });
  // An invalid NEXT_PUBLIC_TENANT_ID must never fall back to EIC branding on a
  // partner deployment; the proxy blocks every request in that case, and this
  // throws so nothing renders by accident.
  if (!resolved.ok) throw new Error(resolved.reason);
  return resolved.tenant;
}

export function isClientAllowedForTenant(tenant: TenantConfig, clientId: string): boolean {
  return tenant.allowedClients === null || tenant.allowedClients.includes(clientId);
}

/** Client IDs a user may see on this tenant: tenant cap ∩ profile access. */
export function allowedClientsFor(
  tenant: TenantConfig,
  profile: { role: string; client_access: string[] | null },
  allClientIds: readonly string[],
): string[] {
  const tenantClients = allClientIds.filter(id => isClientAllowedForTenant(tenant, id));
  if (profile.role === 'super_admin' || profile.role === 'agency') return tenantClients;
  const granted = new Set(profile.client_access ?? []);
  return tenantClients.filter(id => granted.has(id));
}

// ─── Route policy for partner (non-internal) tenants ─────────────────────────

const PARTNER_PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/reset-password']);

/**
 * Whether a partner tenant may serve this path at all (checked before auth).
 * Everything that is not the auth flow or one of the tenant's client dashboards
 * is refused, including EIC marketing pages, agency tools, PDFs and chat APIs.
 */
export function isPathAllowedForPartner(tenant: TenantConfig, pathname: string): boolean {
  if (tenant.internalFeatures) return true;
  if (PARTNER_PUBLIC_PATHS.has(pathname) || pathname.startsWith('/auth/')) return true;
  if (pathname === '/dashboard') return true;
  return (tenant.allowedClients ?? []).some(clientId => {
    const base = `/dashboard/${clientId}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}
