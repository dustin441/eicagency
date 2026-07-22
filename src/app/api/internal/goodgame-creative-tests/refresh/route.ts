import { timingSafeEqual } from 'node:crypto';
import {
  fetchGoodGameCreativeAnalysis,
  goodgameParamsFromSearch,
} from '@/services/goodgame-analytics';
import { refreshGoodGameCreativeTestEvaluations } from '@/services/goodgame-creative-learning';

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
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const analysis = await fetchGoodGameCreativeAnalysis(goodgameParamsFromSearch({}));
    const accountCostPerPurchase = analysis.summary.sales > 0
      ? analysis.summary.spend / analysis.summary.sales
      : null;
    const result = await refreshGoodGameCreativeTestEvaluations(accountCostPerPurchase);
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Creative test refresh failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
