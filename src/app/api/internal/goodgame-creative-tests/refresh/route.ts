import { timingSafeEqual } from 'node:crypto';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { isGoodGameEcommerceCampaign } from '@/lib/goodgame-campaign-scope';
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

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function fetchTrailingAccountCostPerPurchase() {
  const db = createSpartacoSupabaseClient();
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);
  const pageSize = 1_000;
  let offset = 0;
  let spend = 0;
  let purchases = 0;

  while (true) {
    const { data, error } = await db
      .from('goodgame_meta_ads')
      .select('campaign_name,cost,purchases')
      .gte('date', isoDate(start))
      .lt('date', isoDate(today))
      .order('date', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (!isGoodGameEcommerceCampaign(row.campaign_name)) continue;
      spend += Number(row.cost ?? 0);
      purchases += Number(row.purchases ?? 0);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return purchases > 0 ? spend / purchases : null;
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accountCostPerPurchase = await fetchTrailingAccountCostPerPurchase();
    const result = await refreshGoodGameCreativeTestEvaluations(accountCostPerPurchase);
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Creative test refresh failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
