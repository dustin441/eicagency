import chromium from '@sparticuz/chromium';
import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer-core';
import {
  loadPrepassAtaPdfPage,
  profileCanExportPrepass,
  safePrepassAtaPdfUrl,
} from '@/lib/prepass-ata-pdf';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function hasPrepassAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, status: 401 };
  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();
  return { ok: profileCanExportPrepass(data, error), status: 403 };
}

async function launchBrowser(): Promise<Browser> {
  const configuredExecutable = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH;
  const executablePath = configuredExecutable || await chromium.executablePath();
  return puppeteer.launch({
    args: configuredExecutable
      ? ['--no-sandbox', '--disable-dev-shm-usage']
      : await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: { width: 1440, height: 1800, deviceScaleFactor: 1 },
    executablePath,
    headless: 'shell',
    timeout: 20_000,
  });
}

async function closeBrowser(browser: Browser) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const closeFinished = browser.close().then(() => true, () => true);
  const closeTimedOut = new Promise<boolean>(resolve => {
    timeout = setTimeout(() => resolve(false), 3_000);
    timeout.unref();
  });
  const closed = await Promise.race([closeFinished, closeTimedOut]);
  if (timeout) clearTimeout(timeout);
  if (!closed) browser.process()?.kill('SIGKILL');
}

export async function GET(request: NextRequest) {
  const access = await hasPrepassAccess();
  if (!access.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: access.status });

  const targetUrl = safePrepassAtaPdfUrl(
    request.nextUrl.searchParams.get('path') ?? '/dashboard/ata-event',
    request.nextUrl.origin,
  );
  if (!targetUrl) return NextResponse.json({ error: 'Invalid dashboard path' }, { status: 400 });

  let browser: Browser | null = null;
  let stage = 'launch';
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const cookies = request.cookies.getAll().map(({ name, value }) => ({ name, value, url: targetUrl.origin }));
    if (cookies.length) await page.setCookie(...cookies);

    stage = 'load';
    await loadPrepassAtaPdfPage(page, targetUrl, Date.now() + 35_000);

    stage = 'print';
    const pdf = await page.pdf({
      waitForFonts: false,
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 40_000,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Blob([pdf as BlobPart], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="prepass-ata-event-${today}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('PrePass ATA PDF export failed', {
      stage,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 });
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
