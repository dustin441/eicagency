import type { Page } from 'puppeteer-core';

export function profileCanExportSpartaco(profile: unknown, error?: unknown): boolean {
  if (error || !profile || typeof profile !== 'object') return false;
  const { role, client_access } = profile as { role?: unknown; client_access?: unknown };
  return role === 'super_admin' || role === 'agency' ||
    (role === 'client' && Array.isArray(client_access) && client_access.includes('spartaco'));
}

export function safeSpartacoPdfUrl(path: string, origin: string): URL | null {
  try {
    // Reject encoded path separators, traversal, backslashes and protocol-relative URLs.
    if (!path.startsWith('/dashboard/spartaco') || /[\\#]/.test(path)) return null;
    const rawPath = path.split('?')[0];
    if (rawPath.includes('%') || rawPath.includes('..')) return null;
    const url = new URL(path, origin);
    if (url.origin !== origin) return null;
    if (url.pathname === '/dashboard/spartaco') url.pathname += '/leads';
    if (!/^\/dashboard\/spartaco\/(?:leads|all|ecommerce|products|creatives|wrapups(?:\/[a-z0-9-]+)?|brand-health(?:\/[a-zA-Z0-9-]+)?)$/.test(url.pathname)) return null;
    url.searchParams.set('pdf', '1');
    return url;
  } catch { return null; }
}

export function assertPdfNavigation(status: number | undefined, finalUrl: string, expected: URL) {
  if (!status || status < 200 || status >= 300) throw new Error('PDF navigation failed HTTP validation');
  const actual = new URL(finalUrl);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.search !== expected.search) {
    throw new Error('PDF navigation redirected away from requested report');
  }
}

/** Executed in the browser, deliberately self-contained for Puppeteer serialization. */
export function inspectSpartacoPdfDocument(expectedPath: string): 'ready' | 'error' | 'incomplete' {
  const text = document.body?.innerText ?? '';
  if (/Data Overload|Log in to Vercel|Application error:|This page could not be found/.test(text)) return 'error';
  if (document.querySelector('input[type="password"], [data-nextjs-error]')) return 'error';
  const marker = document.querySelector('[data-spartaco-pdf-ready]');
  if (marker?.getAttribute('data-spartaco-pdf-ready') !== expectedPath || !marker.querySelector('h1')) return 'incomplete';
  return 'ready';
}

export async function loadSpartacoPdfPage(page: Page, target: URL, deadline: number) {
  const remaining = () => Math.max(1, deadline - Date.now());
  // Responsive charts must measure the final print layout, not the screen layout.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.emulateMediaType('print');
  const response = await page.goto(target.toString(), {
    waitUntil: 'domcontentloaded', timeout: Math.min(20_000, remaining()),
  });
  assertPdfNavigation(response?.status(), page.url(), target);
  while (Date.now() < deadline) {
    const state = await page.evaluate(inspectSpartacoPdfDocument, target.pathname);
    if (state === 'error') throw new Error('Dashboard error during PDF export');
    if (state === 'ready') {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: Math.min(2_000, remaining()) }).catch(() => undefined);
      const fonts = await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: remaining() });
      await fonts.dispose();
      // Match the dashboard: creative availability is not report readiness.
      // Give lazy images a bounded chance to load, preserving existing src/alt
      // and UI fallbacks. Missing or stalled CDN images must not block metrics.
      await page.evaluate(() => {
        for (const image of document.images) image.loading = 'eager';
      });
      try {
        const images = await page.waitForFunction(() => Array.from(document.images)
          .filter(image => image.getClientRects().length > 0)
          .every(image => image.complete), { timeout: Math.min(2_000, remaining()) });
        await images.dispose();
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
      }
      // Wait for responsive chart measurements and image/font layout to stabilize.
      const layout = await page.waitForFunction(() => {
        const root = document.querySelector('[data-spartaco-pdf-ready]');
        if (!root) return false;
        const charts = Array.from(root.querySelectorAll('.recharts-responsive-container'));
        if (charts.some(chart => !chart.querySelector('svg.recharts-surface'))) return false;
        const signature = JSON.stringify([root.getBoundingClientRect().height,
          ...charts.map(chart => [chart.getBoundingClientRect().width, chart.getBoundingClientRect().height])]);
        const state = window as unknown as { __spartacoPrintLayout?: { signature: string; since: number } };
        if (state.__spartacoPrintLayout?.signature !== signature) {
          state.__spartacoPrintLayout = { signature, since: performance.now() };
          return false;
        }
        return performance.now() - state.__spartacoPrintLayout.since >= 300;
      }, { timeout: remaining(), polling: 100 });
      await layout.dispose();
      assertPdfNavigation(response?.status(), page.url(), target);
      if (await page.evaluate(inspectSpartacoPdfDocument, target.pathname) !== 'ready') throw new Error('Report became incomplete');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Dashboard readiness deadline exceeded');
}
