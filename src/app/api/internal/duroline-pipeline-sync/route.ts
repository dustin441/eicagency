import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { refreshDurolinePipelineSnapshot } from '@/services/duroline-pipeline-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

function response(body: object, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Dedicated service credential only. No session auth, caller-selected targets or payload. */
export async function POST(request: Request) {
  const secret = process.env.DUROLINE_PIPELINE_SYNC_SECRET?.trim();
  if (!secret) return response({ error: 'Sync unavailable' }, 503);
  const authorization = request.headers.get('authorization') ?? '';
  const supplied = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] ?? '';
  // Fixed-length digests avoid length-dependent comparison and oversized buffers.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(secret)) || !supplied) {
    return response({ error: 'Unauthorized' }, 401);
  }
  if (new URL(request.url).search) {
    return response({ error: 'Parameters and request bodies are not accepted' }, 400);
  }
  // Node/edge adapters can expose a non-null stream for a zero-byte POST.
  // Inspect bytes, not stream presence; reject payloads without buffering them.
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (let chunks = 0; ; chunks++) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength || chunks >= 8) {
          return response({ error: 'Parameters and request bodies are not accepted' }, 400);
        }
      }
    } catch {
      return response({ error: 'Invalid request' }, 400);
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  try {
    return response(await refreshDurolinePipelineSnapshot(), 200);
  } catch {
    // Do not expose upstream bodies, database details, identifiers, or credentials.
    return response({ error: 'Pipeline sync failed' }, 502);
  }
}
