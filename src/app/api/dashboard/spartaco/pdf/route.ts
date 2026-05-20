import chromium from '@sparticuz/chromium';
import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer-core';
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

    await page.goto(targetUrl.toString(), {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 45_000,
    });
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
