import type { Page } from 'puppeteer-core';

export function profileCanExportPrepass(profile: unknown, error?: unknown): boolean {
  if (error || !profile || typeof profile !== 'object') return false;
  const { role, client_access } = profile as { role?: unknown; client_access?: unknown };
  return role === 'super_admin' || role === 'agency' ||
    (role === 'client' && Array.isArray(client_access) && client_access.includes('prepass'));
}

export function safePrepassAtaPdfUrl(path: string, origin: string): URL | null {
  try {
    if (!path.startsWith('/dashboard/ata-event') || /[\\#]/.test(path)) return null;
    const rawPath = path.split('?')[0];
    if (rawPath.includes('%') || rawPath.includes('..')) return null;
    const url = new URL(path, origin);
    if (url.origin !== origin || url.pathname !== '/dashboard/ata-event') return null;
    url.search = '';
    url.searchParams.set('pdf', '1');
    return url;
  } catch {
    return null;
  }
}

export function assertPrepassAtaPdfNavigation(status: number | undefined, finalUrl: string, expected: URL) {
  if (!status || status < 200 || status >= 300) throw new Error('PDF navigation failed HTTP validation');
  const actual = new URL(finalUrl);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.search !== expected.search) {
    throw new Error('PDF navigation redirected away from the ATA event report');
  }
}

/** Executed in the browser, deliberately self-contained for Puppeteer serialization. */
export function inspectPrepassAtaPdfDocument(expectedPath: string): 'ready' | 'error' | 'incomplete' {
  const text = document.body?.innerText ?? '';
  if (/Data Overload|Log in to Vercel|Application error:|This page could not be found/.test(text)) return 'error';
  if (document.querySelector('input[type="password"], [data-nextjs-error]')) return 'error';
  const marker = document.querySelector('[data-prepass-ata-pdf-ready]');
  if (marker?.getAttribute('data-prepass-ata-pdf-ready') !== expectedPath || !marker.querySelector('h1')) return 'incomplete';
  return 'ready';
}

export async function loadPrepassAtaPdfPage(page: Page, target: URL, deadline: number) {
  const remaining = () => Math.max(1, deadline - Date.now());
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.emulateMediaType('print');
  const response = await page.goto(target.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: Math.min(20_000, remaining()),
  });
  assertPrepassAtaPdfNavigation(response?.status(), page.url(), target);

  while (Date.now() < deadline) {
    const state = await page.evaluate(inspectPrepassAtaPdfDocument, target.pathname);
    if (state === 'error') throw new Error('Dashboard error during PDF export');
    if (state === 'ready') {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: Math.min(2_000, remaining()) }).catch(() => undefined);
      const fonts = await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: remaining() });
      await fonts.dispose();
      const layout = await page.waitForFunction(() => {
        const root = document.querySelector('[data-prepass-ata-pdf-ready]');
        if (!root) return false;
        const charts = Array.from(root.querySelectorAll('.recharts-responsive-container'));
        if (charts.some(chart => !chart.querySelector('svg.recharts-surface'))) return false;
        const signature = JSON.stringify([
          root.getBoundingClientRect().height,
          ...charts.map(chart => [chart.getBoundingClientRect().width, chart.getBoundingClientRect().height]),
        ]);
        const state = window as unknown as { __prepassAtaPrintLayout?: { signature: string; since: number } };
        if (state.__prepassAtaPrintLayout?.signature !== signature) {
          state.__prepassAtaPrintLayout = { signature, since: performance.now() };
          return false;
        }
        return performance.now() - state.__prepassAtaPrintLayout.since >= 300;
      }, { timeout: remaining(), polling: 100 });
      await layout.dispose();
      assertPrepassAtaPdfNavigation(response?.status(), page.url(), target);
      if (await page.evaluate(inspectPrepassAtaPdfDocument, target.pathname) !== 'ready') {
        throw new Error('ATA event report became incomplete');
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('ATA event dashboard readiness deadline exceeded');
}
