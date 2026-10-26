import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {
  assertPrepassAtaPdfNavigation,
  loadPrepassAtaPdfPage,
  profileCanExportPrepass,
  safePrepassAtaPdfUrl,
} from '../src/lib/prepass-ata-pdf.ts';

const root = new URL('../', import.meta.url);
const origin = 'http://localhost:3221';

test('PrePass PDF authorization fails closed', () => {
  for (const role of ['agency', 'super_admin']) assert.equal(profileCanExportPrepass({ role }), true);
  assert.equal(profileCanExportPrepass({ role: 'client', client_access: ['prepass'] }), true);
  for (const profile of [null, {}, { role: 'client' }, { role: 'client', client_access: 'prepass' }, { role: 'client', client_access: ['nsi'] }, { role: 'unknown', client_access: ['prepass'] }]) {
    assert.equal(profileCanExportPrepass(profile), false);
  }
  assert.equal(profileCanExportPrepass({ role: 'agency' }, new Error('lookup failed')), false);
});

test('only the ATA event dashboard can be exported through the PrePass route', () => {
  const url = safePrepassAtaPdfUrl('/dashboard/ata-event', origin);
  assert.ok(url);
  assert.equal(url.pathname, '/dashboard/ata-event');
  assert.equal(url.search, '?pdf=1');
  for (const path of [
    '/dashboard',
    '/dashboard/ata-event/other',
    '//evil.test/dashboard/ata-event',
    '/dashboard/ata-event/../nsi',
    '/dashboard/ata-event/%2e%2e/nsi',
    '/dashboard/ata-event\\evil',
  ]) assert.equal(safePrepassAtaPdfUrl(path, origin), null, path);
});

test('redirects, errors, and changed URLs cannot become PDFs', () => {
  const expected = new URL('/dashboard/ata-event?pdf=1', origin);
  for (const status of [undefined, 302, 401, 403, 404, 500]) {
    assert.throws(() => assertPrepassAtaPdfNavigation(status, expected.href, expected));
  }
  for (const path of ['/login', '/dashboard/nsi', '/dashboard/ata-event?pdf=1&changed=1']) {
    assert.throws(() => assertPrepassAtaPdfNavigation(200, new URL(path, origin).href, expected));
  }
  assert.doesNotThrow(() => assertPrepassAtaPdfNavigation(200, expected.href, expected));
});

test('ATA page and endpoint expose the shared download and readiness contracts', async () => {
  const client = await readFile(new URL('src/components/AtaEventDashboardClient.tsx', root), 'utf8');
  const route = await readFile(new URL('src/app/api/dashboard/prepass/pdf/route.ts', root), 'utf8');
  const css = await readFile(new URL('src/app/globals.css', root), 'utf8');
  const nextConfig = await readFile(new URL('next.config.ts', root), 'utf8');
  assert.match(client, /DashboardPdfDownloadButton client="prepass"/);
  assert.match(client, /data-prepass-ata-pdf-ready="\/dashboard\/ata-event"/);
  assert.match(client, /What “screens” means:/);
  assert.match(client, /placement footprint, not unique people reached, ad plays, or impressions/);
  assert.match(route, /profileCanExportPrepass/);
  assert.match(route, /maxDuration = 120/);
  assert.match(route, /content-disposition[\s\S]*prepass-ata-event-/);
  assert.match(css, /\[data-prepass-ata-pdf-ready\]/);
  assert.match(nextConfig, /'\/api\/dashboard\/prepass\/pdf': \['node_modules\/@sparticuz\/chromium\/bin\/\*\*'\]/);
});

test('real Chromium waits for a complete ATA report and creates a valid PDF', async () => {
  const path = '/dashboard/ata-event';
  const server = createServer((req, res) => {
    const url = new URL(req.url!, origin);
    const mode = url.searchParams.get('mode');
    if (mode === 'redirect') {
      res.writeHead(302, { location: '/login' });
      res.end();
      return;
    }
    res.writeHead(mode === '404' ? 404 : 200, { 'content-type': 'text/html' });
    const report = `<main data-prepass-ata-pdf-ready="${mode === 'wrong' ? '/dashboard/nsi' : path}"><h1>ATA Event Performance</h1><div class="recharts-responsive-container"><svg class="recharts-surface" width="600" height="240"></svg></div></main>`;
    res.end(mode === 'login' || url.pathname === '/login'
      ? '<h1>Sign in</h1><input type="password">'
      : mode === 'partial'
        ? '<h1>ATA Event Performance</h1>Loading...'
        : mode === 'error'
          ? `${report}<p>Application error:</p>`
          : mode === 'delayed'
            ? `<div id="root">Loading</div><script>setTimeout(() => document.getElementById('root').innerHTML = ${JSON.stringify(report)}, 250)</script>`
            : report);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath(),
      args: process.env.PUPPETEER_EXECUTABLE_PATH ? ['--no-sandbox', '--disable-dev-shm-usage'] : chromium.args,
      headless: 'shell',
    });
    for (const mode of ['redirect', '404', 'login', 'partial', 'wrong', 'error']) {
      const page = await browser.newPage();
      const target = new URL(`http://127.0.0.1:${address.port}${path}?mode=${mode}&pdf=1`);
      await assert.rejects(loadPrepassAtaPdfPage(page, target, Date.now() + 1200), mode);
      await page.close();
    }
    const page = await browser.newPage();
    await loadPrepassAtaPdfPage(page, new URL(`http://127.0.0.1:${address.port}${path}?mode=delayed&pdf=1`), Date.now() + 5000);
    assert.equal(await page.evaluate(() => matchMedia('print').matches), true);
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1000);
    const dir = process.env.PDF_QA_ARTIFACT_DIR || '/tmp/prepass-ata-pdf-review-artifacts';
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/behavioral-fixture.pdf`, pdf);
    await page.close();
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
