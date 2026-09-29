import chromium from '@sparticuz/chromium';
import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer-core';
import { createClient } from '@/utils/supabase/server';
import { loadSpartacoPdfPage, profileCanExportSpartaco, safeSpartacoPdfUrl } from '@/lib/spartaco-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

async function hasSpartacoAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, status: 401 };
  const { data, error } = await supabase.from('profiles').select('role, client_access').eq('id', user.id).single();
  return { ok: profileCanExportSpartaco(data, error), status: 403 };
}

function filenameForPath(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'dashboard';
  return `spartaco-${segment}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath();
  return puppeteer.launch({
    args: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH
      ? ['--no-sandbox', '--disable-dev-shm-usage']
      : await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: { width: 1440, height: 1800, deviceScaleFactor: 1 },
    executablePath,
    headless: 'shell',
  });
}

export async function GET(request: NextRequest) {
  const access = await hasSpartacoAccess();
  if (!access.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: access.status });
  const targetUrl = safeSpartacoPdfUrl(request.nextUrl.searchParams.get('path') ?? '/dashboard/spartaco/leads', request.nextUrl.origin);
  if (!targetUrl) return NextResponse.json({ error: 'Invalid dashboard path' }, { status: 400 });
  let browser: Browser | null = null;
  let stage = 'launch';
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // No cross-origin/production fallback: preview tests must render preview code.
    const cookies = request.cookies.getAll().map(({ name, value }) => ({ name, value, url: targetUrl.origin }));
    if (cookies.length) await page.setCookie(...cookies);
    stage = 'load';
    await loadSpartacoPdfPage(page, targetUrl, Date.now() + 35_000);

    stage = 'print';
    const pdf = await page.pdf({
      // loadSpartacoPdfPage already verifies loaded fonts and stable print layout.
      // Chromium's separate document.fonts.ready wait can remain pending on these reports.
      waitForFonts: false,
      format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, timeout: 40_000,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
    return new NextResponse(new Blob([pdf as BlobPart], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filenameForPath(targetUrl.pathname)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    // Do not log navigation URLs or cookie/session material.
    console.error('Spartaco PDF export failed', { stage, error: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
