import { timingSafeEqual } from 'node:crypto';
import { runTransform } from '@/lib/eic-n8n-transforms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.N8N_TRANSFORM_BRIDGE_TOKEN;
  if (!expected) return false;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body?.action;
    const result = runTransform(action, body?.payload);
    const responseBody = action === 'ga4-request'
      ? result
      : Array.isArray(result)
        ? { items: result }
        : { item: result };
    return Response.json(responseBody, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transform failed';
    return Response.json({ error: message }, { status: 400 });
  }
}
