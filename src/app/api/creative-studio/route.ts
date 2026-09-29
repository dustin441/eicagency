import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { createStudioService, assertLocalReviewEnabled, StudioError } from '@/services/creative-studio';
import type { StudioIdentity } from '@/services/creative-studio';
import { hasStudioClientAccess } from '@/lib/creative-studio/hosted-access';
import { RatioSchema } from '@/lib/creative-studio/model';
import { renderPng } from '@/lib/creative-studio/render';
import { hostedStudioServer } from '@/services/creative-studio-server';
import { HostedStudioAccessError } from '@/lib/creative-studio/hosted-access';

export const runtime = 'nodejs';
// One awaited render per request; renderer deadline is capped at 30 seconds.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const AssetQuery = z.object({ projectId: z.string().uuid(), versionId: z.string().uuid(), ratio: RatioSchema, format: z.enum(['png', 'html']) }).strict();
async function context() {
  if (process.env.CREATIVE_STUDIO_HOSTED_ENABLED === 'true') return hostedStudioServer(process.env, createClient);
  assertLocalReviewEnabled();
  const dataDir = process.env.CREATIVE_STUDIO_DATA_DIR;
  if (!dataDir) throw new StudioError('Local data directory is not configured.', 503);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new StudioError('Authentication required.', 401);
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role, client_access').eq('id', user.id).single();
  if (profileError || !profile || !hasStudioClientAccess(profile)) throw new StudioError('EIC Agency access required.', 403);
  const identity: StudioIdentity = { userId: user.id, role: profile.role };
  return { identity, service: createStudioService({ dataDir, render: renderPng }) };
}
function failure(error: unknown) {
  const status = error instanceof StudioError || error instanceof HostedStudioAccessError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500;
  const message = error instanceof StudioError || error instanceof HostedStudioAccessError ? error.message : status === 400 ? 'Invalid Creative Studio request.' : 'Creative Studio request failed.';
  return Response.json({ error: message }, { status, headers });
}
export async function GET(request: Request) {
  try {
    const { identity, service } = await context();
    const query = new URL(request.url).searchParams;
    if (!query.size) return Response.json(await service.list(identity), { headers });
    if (new Set(query.keys()).size !== query.size) throw new StudioError('Duplicate query parameter.');
    const { projectId, versionId, ratio, format } = AssetQuery.parse(Object.fromEntries(query));
    if (format === 'png') {
      const png = await service.readAsset(identity, projectId, versionId, ratio);
      const placement=await service.readPlacement(identity,projectId,versionId,ratio);
      return new Response(new Uint8Array(png), { headers: { ...headers, 'Content-Type': placement.mimeType, 'Content-Disposition': `inline; filename="eic-local-review-${ratio.replace(':', 'x')}.${placement.extension}"` } });
    }
    const html = await service.readPreview(identity, projectId, versionId, ratio);
    return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; sandbox" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (process.env.CREATIVE_STUDIO_HOSTED_ENABLED !== 'true') assertLocalReviewEnabled();
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new StudioError('Same-origin request required.', 403);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new StudioError('JSON content type required.', 415);
    const limit = 20 * 1024;
    if (Number(request.headers.get('content-length')) > limit) throw new StudioError('Request body too large.', 413);
    const { identity, service } = await context();
    const reader = request.body?.getReader();
    if (!reader) throw new StudioError('Request body required.');
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw new StudioError('Request body too large.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return Response.json(await service.execute(identity, input), { headers });
  } catch (error) { return failure(error); }
}
