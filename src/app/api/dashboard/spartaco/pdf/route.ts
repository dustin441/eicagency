import chromium from '@sparticuz/chromium';
import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { getSpartacoWrapup } from '@/services/spartaco-product-wrapups';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Profile = {
  role: 'super_admin' | 'agency' | 'client';
  client_access: string[] | null;
};

async function hasSpartacoAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401 };

  const { data } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;
  if (!profile || profile.role === 'super_admin' || profile.role === 'agency') {
    return { ok: true, status: 200 };
  }

  return {
    ok: Boolean(profile.client_access?.includes('spartaco')),
    status: 403,
  };
}

function getSafeDashboardUrl(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '/dashboard/spartaco/leads';
  if (path !== '/dashboard/spartaco' && !path.startsWith('/dashboard/spartaco/')) {
    return null;
  }

  const targetUrl = new URL(path, request.nextUrl.origin);
  if (targetUrl.origin !== request.nextUrl.origin) return null;
  if (targetUrl.pathname !== '/dashboard/spartaco' && !targetUrl.pathname.startsWith('/dashboard/spartaco/')) {
    return null;
  }

  targetUrl.searchParams.set('pdf', '1');
  return targetUrl;
}

function filenameForPath(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'dashboard';
  const today = new Date().toISOString().slice(0, 10);
  return `spartaco-${segment}-${today}.pdf`;
}

async function launchBrowser(): Promise<Browser> {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    (await chromium.executablePath());

  const args = await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' });

  return puppeteer.launch({
    args,
    defaultViewport: { width: 1440, height: 1800, deviceScaleFactor: 1 },
    executablePath,
    headless: 'shell',
  });
}

type PdfPageState = 'ready' | 'dashboard-error' | 'vercel-login' | 'missing-wrapup';

const PDF_PAGE_LOAD_BUDGET_MS = 35_000;
const PDF_NAVIGATION_ATTEMPT_MS = 20_000;
const PDF_READY_WAIT_MS = 8_000;
const PDF_NETWORK_IDLE_WAIT_MS = 2_000;
const PDF_PRODUCTION_ORIGIN = 'https://analytics.eic.agency';

async function inspectPdfPage(page: Page, targetUrl: URL): Promise<PdfPageState> {
  const wrapupSlug = targetUrl.pathname.match(/^\/dashboard\/spartaco\/wrapups\/([^/]+)$/)?.[1] ?? null;
  const wrapup = wrapupSlug ? getSpartacoWrapup(decodeURIComponent(wrapupSlug)) : null;

  return page.evaluate(({ expectedSlug, expectedTitle }) => {
    const text = document.body?.innerText ?? '';
    if (text.includes('Data Overload')) return 'dashboard-error';
    if (text.includes('Log in to Vercel')) return 'vercel-login';
    const hasMarker = expectedSlug
      ? Boolean(document.querySelector(`[data-pdf-ready="${CSS.escape(expectedSlug)}"]`))
      : false;
    const hasExpectedTitle = expectedTitle
      ? Array.from(document.querySelectorAll('h1')).some((heading) => heading.textContent?.trim() === expectedTitle)
      : false;
    if (expectedSlug && !hasMarker && !hasExpectedTitle) {
      return 'missing-wrapup';
    }
    return 'ready';
  }, { expectedSlug: wrapupSlug, expectedTitle: wrapup?.campaignGroupName ?? null });
}

async function waitForRecognizablePdfPage(page: Page, targetUrl: URL, deadline: number) {
  const wrapupSlug = targetUrl.pathname.match(/^\/dashboard\/spartaco\/wrapups\/([^/]+)$/)?.[1] ?? null;
  const wrapup = wrapupSlug ? getSpartacoWrapup(decodeURIComponent(wrapupSlug)) : null;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;

  await page.waitForFunction(({ expectedSlug, expectedTitle }) => {
    const text = document.body?.innerText ?? '';
    if (text.includes('Data Overload') || text.includes('Log in to Vercel')) return true;
    if (!expectedSlug) return Boolean(text.trim());
    const hasMarker = Boolean(document.querySelector(`[data-pdf-ready="${CSS.escape(expectedSlug)}"]`));
    const hasExpectedTitle = expectedTitle
      ? Array.from(document.querySelectorAll('h1')).some((heading) => heading.textContent?.trim() === expectedTitle)
      : false;
    return hasMarker || hasExpectedTitle;
  }, {
    timeout: Math.min(PDF_READY_WAIT_MS, remaining),
  }, {
    expectedSlug: wrapupSlug,
    expectedTitle: wrapup?.campaignGroupName ?? null,
  }).catch(() => undefined);
}

async function loadPdfPage(page: Page, targetUrl: URL, deadline: number, maxAttempts: number) {
  let state: PdfPageState = 'missing-wrapup';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remainingForNavigation = deadline - Date.now();
    if (remainingForNavigation <= 0) break;

    try {
      const navigationOptions = {
        waitUntil: 'domcontentloaded' as const,
        timeout: Math.min(PDF_NAVIGATION_ATTEMPT_MS, remainingForNavigation),
      };
      if (attempt === 0) {
        await page.goto(targetUrl.toString(), navigationOptions);
      } else {
        await page.reload(navigationOptions);
      }
    } catch {
      break;
    }

    await waitForRecognizablePdfPage(page, targetUrl, deadline);
    state = await inspectPdfPage(page, targetUrl);
    if (state === 'ready') {
      const remainingForNetworkIdle = deadline - Date.now();
      if (remainingForNetworkIdle > 0) {
        await page.waitForNetworkIdle({
          idleTime: 500,
          timeout: Math.min(PDF_NETWORK_IDLE_WAIT_MS, remainingForNetworkIdle),
        }).catch(() => undefined);
      }
      return;
    }
    if (state !== 'dashboard-error') break;
  }

  throw new Error(`Dashboard is not ready for PDF export: ${state}`);
}

function isSupabaseAuthCookie(name: string) {
  return /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/i.test(name);
}

async function setPageCookies(page: Page, request: NextRequest, targetUrl: URL) {
  const cookies = request.cookies
    .getAll()
    .filter(({ name }) => targetUrl.origin === request.nextUrl.origin || isSupabaseAuthCookie(name))
    .map(({ name, value }) => ({
      name,
      value,
      url: targetUrl.origin,
    }));
  if (cookies.length > 0) await page.setCookie(...cookies);
}

export async function GET(request: NextRequest) {
  const access = await hasSpartacoAccess();
  if (!access.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: access.status });
  }

  const targetUrl = getSafeDashboardUrl(request);
  if (!targetUrl) {
    return NextResponse.json({ error: 'Invalid dashboard path' }, { status: 400 });
  }

  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const deadline = Date.now() + PDF_PAGE_LOAD_BUDGET_MS;
    const isPreview = process.env.VERCEL_ENV === 'preview';
    const isWrapupTarget = /^\/dashboard\/spartaco\/wrapups\/[^/]+$/.test(targetUrl.pathname);
    await setPageCookies(page, request, targetUrl);

    try {
      await loadPdfPage(page, targetUrl, deadline, isPreview ? 1 : 2);
    } catch (error) {
      if (!isPreview || !isWrapupTarget) throw error;
      const productionUrl = new URL(`${targetUrl.pathname}${targetUrl.search}`, PDF_PRODUCTION_ORIGIN);
      await setPageCookies(page, request, productionUrl);
      await loadPdfPage(page, productionUrl, deadline, 1);
    }
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '12mm',
        right: '10mm',
        bottom: '12mm',
        left: '10mm',
      },
    });

    return new NextResponse(new Blob([pdf as BlobPart], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filenameForPath(targetUrl.pathname)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Spartaco PDF export failed', error);
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
