import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detailPagePath = new URL('../src/app/dashboard/spartaco/wrapups/[slug]/page.tsx', import.meta.url);
const pdfRoutePath = new URL('../src/app/api/dashboard/spartaco/pdf/route.ts', import.meta.url);
const wrapupServicePath = new URL('../src/services/spartaco-product-wrapups.ts', import.meta.url);

const detailPageSource = await readFile(detailPagePath, 'utf8');
const pdfRouteSource = await readFile(pdfRoutePath, 'utf8');
const wrapupServiceSource = await readFile(wrapupServicePath, 'utf8');

const wrapupFetcherSource = wrapupServiceSource.slice(
  wrapupServiceSource.indexOf('export async function fetchSpartacoProductWrapup'),
);

const inventoryBlock = wrapupServiceSource.slice(
  wrapupServiceSource.indexOf('export const SPARTACO_WRAPUPS'),
  wrapupServiceSource.indexOf('\n];', wrapupServiceSource.indexOf('export const SPARTACO_WRAPUPS')) + 3,
);
const wrapups = [...inventoryBlock.matchAll(
  /slug:\s*'([^']+)'(?:(?!\n\s*\},)[\s\S])*?campaignGroupName:\s*'([^']+)'/g,
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

test('wrap-up loading avoids the previous 13-request top-level burst', () => {
  assert.doesNotMatch(
    wrapupFetcherSource,
    /const \[beforeData, duringData, afterData, fullWindowData,[\s\S]*?= await Promise\.all/,
    'Do not start every wrap-up data source in one unbounded Promise.all',
  );
  const landingPageFetches = wrapupFetcherSource.match(/fetchLandingPageGa4Rows\(/g) ?? [];
  assert.ok(
    landingPageFetches.length >= 4,
    'Before, during, after, and full-window GA4 queries need independent row limits',
  );
});

test('PDF export waits for the requested wrap-up and never prints an error or login page', () => {
  assert.match(
    detailPageSource,
    /data-pdf-ready=\{data\.config\.slug\}/,
    'The rendered wrap-up must expose a campaign-specific readiness marker',
  );
  assert.match(pdfRouteSource, /Data Overload/);
  assert.match(pdfRouteSource, /Log in to Vercel/);
  assert.match(pdfRouteSource, /page\.reload\(/, 'Transient dashboard failures must be retried');

  assert.match(pdfRouteSource, /page\.setCookie\(/, 'Forward auth cookies through the browser cookie jar');
  assert.match(pdfRouteSource, /process\.env\.VERCEL_ENV === 'preview'/, 'Preview must use the production render fallback');
  assert.match(pdfRouteSource, /https:\/\/analytics\.eic\.agency/, 'Preview fallback must use the canonical production origin');
  assert.match(pdfRouteSource, /const isWrapupTarget = \/\^\\\/dashboard\\\/spartaco\\\/wrapups\\\/\[\^\/\]\+\$\//, 'Production fallback must be restricted to an exact one-segment wrap-up route');
  assert.match(pdfRouteSource, /!isPreview \|\| !isWrapupTarget/, 'Non-wrap-up routes must never use the production fallback');
  assert.match(pdfRouteSource, /getSpartacoWrapup/, 'Fallback validation must verify the exact campaign title');
  assert.match(pdfRouteSource, /targetUrl\.pathname\.startsWith/, 'Validate the normalized PDF target path');

  const loadBudgetMatch = pdfRouteSource.match(/const PDF_PAGE_LOAD_BUDGET_MS = ([\d_]+);/);
  assert.ok(loadBudgetMatch, 'PDF page loading must have an explicit total time budget');
  assert.ok(Number(loadBudgetMatch[1].replaceAll('_', '')) <= 35_000, 'Page loading must reserve time inside maxDuration for rendering and cleanup');
  assert.match(pdfRouteSource, /deadline - Date\.now\(\)/, 'Every retry must share the same absolute deadline');

  const validationIndex = pdfRouteSource.indexOf('Data Overload');
  const printIndex = pdfRouteSource.indexOf('await page.pdf');
  assert.ok(validationIndex >= 0 && validationIndex < printIndex, 'Page validation must happen before PDF generation');
});
