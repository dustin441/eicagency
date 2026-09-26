import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detailPagePath = new URL('../src/app/dashboard/spartaco/wrapups/[slug]/page.tsx', import.meta.url);
const pdfRoutePath = new URL('../src/app/api/dashboard/spartaco/pdf/route.ts', import.meta.url);
const wrapupServicePath = new URL('../src/services/spartaco-product-wrapups.ts', import.meta.url);

const detailPageSource = await readFile(detailPagePath, 'utf8');
const pdfRouteSource = await readFile(pdfRoutePath, 'utf8');
const wrapupServiceSource = await readFile(wrapupServicePath, 'utf8');

const inventoryBlock = wrapupServiceSource.slice(
  wrapupServiceSource.indexOf('export const SPARTACO_WRAPUPS'),
  wrapupServiceSource.indexOf('\n];', wrapupServiceSource.indexOf('export const SPARTACO_WRAPUPS')) + 3,
);
const wrapups = [...inventoryBlock.matchAll(
  /slug:\s*'([^']+)'(?:(?!\n\s*\},).)*?campaignGroupName:\s*'([^']+)'/gs,
)].map((match) => ({ slug: match[1], campaignGroupName: match[2] }));

test('every configured campaign wrap-up has a unique page backed by its own campaign config', () => {
  assert.equal(wrapups.length, 23, 'Expected the complete campaign wrap-up inventory');
  assert.equal(new Set(wrapups.map((wrapup) => wrapup.slug)).size, wrapups.length);
  assert.ok(wrapups.every((wrapup) => wrapup.campaignGroupName.length > 0));
  assert.match(
    wrapupServiceSource,
    /SPARTACO_WRAPUPS\.find\(\(wrapup\) => wrapup\.slug === slug\)/,
    'Detail data must be selected by the current campaign slug',
  );
});

test('campaign wrap-up detail page reuses the existing PDF download component beside exports', () => {
  assert.match(
    detailPageSource,
    /import DashboardPdfDownloadButton from ['"]@\/components\/DashboardPdfDownloadButton['"];/,
  );
  assert.match(
    detailPageSource,
    /<DashboardPdfDownloadButton\s+client="spartaco"[\s\S]*?<DashboardXlsxDownloadButton/,
    'PDF download must use the shared component in the existing wrap-up export controls',
  );
});

test('existing Spartaco PDF endpoint accepts nested wrap-up paths and names files by campaign slug', () => {
  assert.match(pdfRouteSource, /path\.startsWith\(['"]\/dashboard\/spartaco\/['"]\)/);
  assert.match(pdfRouteSource, /pathname\.split\(['"]\/['"]\)\.filter\(Boolean\)\.at\(-1\)/);

  for (const wrapup of wrapups) {
    const path = `/dashboard/spartaco/wrapups/${wrapup.slug}`;
    assert.ok(path.startsWith('/dashboard/spartaco/'));
    assert.equal(path.split('/').filter(Boolean).at(-1), wrapup.slug);
  }
});
