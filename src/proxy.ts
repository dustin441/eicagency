import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

const MARKETING_HOSTS = new Set(['eic.agency', 'www.eic.agency']);
const ANALYTICS_HOSTS = new Set(['analytics.eic.agency']);

const ANALYTICS_PATH_PREFIXES = [
  '/api/chat',
  '/api/dashboard',
  '/api/debug-prepass',
  '/auth',
  '/dashboard',
];

const ANALYTICS_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
]);

const INTERNAL_N8N_TRANSFORM_PATH = '/api/internal/eic-n8n-transform';

function normalizeHost(host: string | null) {
  return (host ?? '').split(':')[0]?.toLowerCase() ?? '';
}

function isAnalyticsPath(pathname: string) {
  return ANALYTICS_PATHS.has(pathname) || ANALYTICS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isMarketingPath(pathname: string) {
  return pathname === '/'
    || pathname === '/resources'
    || pathname.startsWith('/resources/')
    || pathname === '/eic-schedule-demo'
    || pathname === '/thankyou-schedule'
    || pathname === '/privacy'
    || pathname === '/data-deletion';
}

function redirectToHost(request: NextRequest, host: string) {
  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.hostname = host;
  url.port = '';
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get('host'));
  const { pathname } = request.nextUrl;

  // Machine-to-machine n8n calls authenticate inside the route with a
  // dedicated bearer token, so they must not enter the browser session flow.
  if (pathname === INTERNAL_N8N_TRANSFORM_PATH) {
    return NextResponse.next();
  }

  if (MARKETING_HOSTS.has(host) && isAnalyticsPath(pathname)) {
    return redirectToHost(request, 'analytics.eic.agency');
  }

  if (ANALYTICS_HOSTS.has(host) && isMarketingPath(pathname)) {
    return redirectToHost(request, 'eic.agency');
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
