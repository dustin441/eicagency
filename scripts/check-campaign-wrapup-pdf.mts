import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { profileCanExportSpartaco, safeSpartacoPdfUrl, assertPdfNavigation, loadSpartacoPdfPage } from '../src/lib/spartaco-pdf.ts';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/services/spartaco-product-wrapups.ts', root), 'utf8');
const inventory = source.slice(source.indexOf('export const SPARTACO_WRAPUPS'), source.indexOf('\n];', source.indexOf('export const SPARTACO_WRAPUPS')));
const slugs = [...inventory.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
const origin = 'http://localhost:3219';
const expectedWrapupCount = 31;

test('profile authorization is fail closed including lookup errors and unknown roles', () => {
  for (const role of ['agency', 'super_admin']) assert.equal(profileCanExportSpartaco({ role }), true);
  assert.equal(profileCanExportSpartaco({ role: 'client', client_access: ['spartaco'] }), true);
  for (const profile of [null, {}, { role: 'client' }, { role: 'client', client_access: 'spartaco' }, { role: 'client', client_access: ['nsi'] }, { role: 'unknown', client_access: ['spartaco'] }]) assert.equal(profileCanExportSpartaco(profile), false);
  assert.equal(profileCanExportSpartaco({ role: 'agency' }, new Error('lookup failed')), false);
});

test(`all page families and all ${expectedWrapupCount} wrapups are supported; dangerous/foreign paths rejected`, () => {
  assert.equal(slugs.length, expectedWrapupCount);
  assert.equal(new Set(slugs).size, expectedWrapupCount);
  for (const path of ['leads', 'all', 'ecommerce', 'products', 'creatives', 'brand-health', 'brand-health/huskie', 'wrapups', ...slugs.map(s => `wrapups/${s}`)]) {
    const url = safeSpartacoPdfUrl(`/dashboard/spartaco/${path}?brand=Huskie&start=2026-01-01`, origin)!;
    assert.ok(url); assert.equal(url.searchParams.get('brand'), 'Huskie'); assert.equal(url.searchParams.get('pdf'), '1');
  }
  assert.equal(safeSpartacoPdfUrl('/dashboard/spartaco', origin)?.pathname, '/dashboard/spartaco/leads');
  for (const path of ['/dashboard/nsi', '//evil.test/dashboard/spartaco', '/dashboard/spartacoevil', '/dashboard/spartaco/../nsi', '/dashboard/spartaco/%2e%2e/nsi', '/dashboard/spartaco/unknown', '/dashboard/spartaco/wrapups/a/b', '/dashboard/spartaco/\\evil']) assert.equal(safeSpartacoPdfUrl(path, origin), null, path);
});

test('HTTP errors and redirects cannot become PDFs even with a forged marker', () => {
  const expected = new URL('/dashboard/spartaco/leads?pdf=1', origin);
  for (const status of [undefined, 302, 401, 403, 404, 500]) assert.throws(() => assertPdfNavigation(status, expected.href, expected));
  for (const path of ['/login', '/dashboard/nsi', '/dashboard/spartaco/leads?pdf=1&changed=1']) assert.throws(() => assertPdfNavigation(200, new URL(path, origin).href, expected));
  assert.throws(() => assertPdfNavigation(200, `https://analytics.eic.agency${expected.pathname}${expected.search}`, expected));
  assert.doesNotThrow(() => assertPdfNavigation(200, expected.href, expected));
});

test('every Spartaco data page mounts the shared hydrated report wrapper, not the layout', async () => {
  for (const route of ['all', 'leads', 'ecommerce', 'products', 'creatives', 'brand-health', 'brand-health/[brand]', 'wrapups', 'wrapups/[slug]']) {
    const page = await readFile(new URL(`src/app/dashboard/spartaco/${route}/page.tsx`, root), 'utf8');
    assert.match(page, /<SpartacoPdfReport>/, route);
    assert.match(page, /requireClientAccess\('spartaco'\)/, route);
  }
  const route = await readFile(new URL('src/app/api/dashboard/spartaco/pdf/route.ts', root), 'utf8');
  assert.doesNotMatch(route, /https:\/\/analytics\.eic\.agency/);
  const printCss = await readFile(new URL('src/app/globals.css', root), 'utf8');
  assert.match(printCss, /\[data-spartaco-pdf-ready\]\s*\{\s*zoom:\s*0\.995;/);
  assert.match(printCss, /\[data-spartaco-pdf-ready\] > :last-child\s*\{\s*padding-bottom:\s*0 !important;/);
});

test('real Chromium rejects login, 404, errors, partial/wrong reports and prints only a ready report', async () => {
  const path = '/dashboard/spartaco/leads';
  const server = createServer((req, res) => {
    const url = new URL(req.url!, origin); const mode = url.searchParams.get('mode');
    if (url.pathname === '/missing.png') { res.writeHead(404); res.end(); return; }
    if (url.pathname === '/slow.png') return; // Simulate an unavailable external creative CDN.
    if (mode === 'slow-image') { res.setHeader('content-type', 'text/html'); res.end(`<main data-spartaco-pdf-ready="${path}"><h1>Slow creative</h1><p>Report metrics stay available</p><img src="/slow.png" alt="Creative preview"></main>`); return; }
    if (mode === 'redirect') { res.writeHead(302, { location: '/login' }); res.end(); return; }
    res.writeHead(mode === '404' ? 404 : 200, { 'content-type': 'text/html' });
    if (mode === 'broken-image') { res.end(`<main data-spartaco-pdf-ready="${path}"><h1>Broken creative</h1><img src="/missing.png"></main>`); return; }
    const marker = `<main data-spartaco-pdf-ready="${mode === 'wrong' ? '/dashboard/spartaco/products' : path}"><h1>Spartaco fixture report</h1><p>Verified browser PDF behavior</p></main>`;
    res.end(mode === 'login' || url.pathname === '/login' ? '<h1>Sign in</h1><input type="password">' : mode === 'partial' ? '<h1>Spartaco fixture report</h1>Loading...' : mode === 'error' ? `${marker}<p>Data Overload</p>` : mode === 'delayed' ? `<div id="root">Loading</div><script>setTimeout(() => document.getElementById('root').innerHTML = ${JSON.stringify(marker)}, 250)</script>` : marker);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath(), args: process.env.PUPPETEER_EXECUTABLE_PATH ? ['--no-sandbox', '--disable-dev-shm-usage'] : chromium.args, headless: 'shell' });
    for (const mode of ['redirect', '404', 'login', 'partial', 'wrong', 'error']) {
      const page = await browser.newPage();
      const target = new URL(`http://127.0.0.1:${address.port}${path}?mode=${mode}&pdf=1`);
      await assert.rejects(loadSpartacoPdfPage(page, target, Date.now() + 1200), mode);
      await page.close();
    }
    for (const mode of ['broken-image', 'slow-image']) {
      const imagePage = await browser.newPage();
      await loadSpartacoPdfPage(imagePage, new URL(`http://127.0.0.1:${address.port}${path}?mode=${mode}&pdf=1`), Date.now() + 8000);
      const imagePdf = await imagePage.pdf({ format: 'A4', waitForFonts: false, timeout: 5000 });
      assert.equal(Buffer.from(imagePdf).subarray(0, 5).toString(), '%PDF-', mode);
      assert.equal(await imagePage.$eval('img', image => image.getAttribute('src')), mode === 'broken-image' ? '/missing.png' : '/slow.png');
      await imagePage.close();
    }
    const page = await browser.newPage();
    await loadSpartacoPdfPage(page, new URL(`http://127.0.0.1:${address.port}${path}?mode=delayed&pdf=1`), Date.now() + 5000);
    assert.equal(await page.evaluate(() => matchMedia('print').matches), true);
    const pdf = await page.pdf({ format: 'A4' });
    assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1000);
    const dir = process.env.PDF_QA_ARTIFACT_DIR || '/tmp/spartaco-pdf-review-artifacts';
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/behavioral-fixture.pdf`, pdf);
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
