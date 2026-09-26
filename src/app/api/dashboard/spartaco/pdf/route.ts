import chromium from '@sparticuz/chromium';
import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
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
const PDF_NETWORK_IDLE_WAIT_MS = 3_000;

async function inspectPdfPage(page: Page, targetUrl: URL): Promise<PdfPageState> {
  const wrapupSlug = targetUrl.pathname.match(/^\/dashboard\/spartaco\/wrapups\/([^/]+)$/)?.[1] ?? null;

  return page.evaluate((expectedSlug) => {
    const text = document.body?.innerText ?? '';
    if (text.includes('Data Overload')) return 'dashboard-error';
    if (text.includes('Log in to Vercel')) return 'vercel-login';
    if (expectedSlug && !document.querySelector(`[data-pdf-ready="${CSS.escape(expectedSlug)}"]`)) {
      return 'missing-wrapup';
    }
    return 'ready';
  }, wrapupSlug);
}

async function loadPdfPage(page: Page, targetUrl: URL) {
  let state: PdfPageState = 'missing-wrapup';
  const deadline = Date.now() + PDF_PAGE_LOAD_BUDGET_MS;

  for (let attempt = 0; attempt < 2; attempt += 1) {
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

    const remainingForNetworkIdle = deadline - Date.now();
    if (remainingForNetworkIdle > 0) {
      await page.waitForNetworkIdle({
        idleTime: 500,
        timeout: Math.min(PDF_NETWORK_IDLE_WAIT_MS, remainingForNetworkIdle),
      }).catch(() => undefined);
    }

    state = await inspectPdfPage(page, targetUrl);
    if (state === 'ready') return;
    if (state !== 'dashboard-error') break;
  }

  throw new Error(`Dashboard is not ready for PDF export: ${state}`);
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
    const cookieHeader = request.headers.get('cookie') ?? '';

    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }

    await loadPdfPage(page, targetUrl);
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
