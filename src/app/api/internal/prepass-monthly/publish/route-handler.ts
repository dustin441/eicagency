import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import {
  publishPrepassMonthlyPublication,
  reportMonthWindow,
  type MonthlyPublicationReceipt,
} from '../../../../../services/prepass-monthly-publication.ts';

type Dependencies = {
  getSecret?: () => string | undefined;
  now?: () => Date;
  publish?: (monthStart: string, correctionReason?: string) => Promise<MonthlyPublicationReceipt>;
};

const noStore = { 'Cache-Control': 'no-store' };
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

function authorized(request: Request, expected: string | undefined): boolean {
  if (!expected || expected !== expected.trim()) return false;
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  return timingSafeEqual(digest(expected), digest(match?.[1] ?? ''));
}

async function parseBody(request: Request, now: Date): Promise<{ monthStart: string; correctionReason?: string }> {
  const raw = await request.text();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['monthStart', 'correctionReason'].includes(key))) throw new Error('Invalid body');
  if (typeof body.monthStart !== 'string') throw new Error('Invalid monthStart');
  reportMonthWindow(body.monthStart, now);
  if (body.correctionReason === undefined) return { monthStart: body.monthStart };
  if (typeof body.correctionReason !== 'string') throw new Error('Invalid correctionReason');
  const correctionReason = body.correctionReason.trim();
  if (!correctionReason || correctionReason.length > 1000 || correctionReason.includes('\0')) throw new Error('Invalid correctionReason');
  return { monthStart: body.monthStart, correctionReason };
}

export function createPrepassMonthlyPublishPostHandler(dependencies: Dependencies = {}) {
  const getSecret = dependencies.getSecret ?? (() => process.env.N8N_TRANSFORM_BRIDGE_TOKEN);
  const now = dependencies.now ?? (() => new Date());
  const publish = dependencies.publish ?? publishPrepassMonthlyPublication;
  return async function POST(request: Request): Promise<Response> {
    if (!authorized(request, getSecret())) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
    let input: { monthStart: string; correctionReason?: string };
    try {
      input = await parseBody(request, now());
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
    }
    try {
      const receipt = await publish(input.monthStart, input.correctionReason);
      return Response.json({ ok: true, ...receipt }, { headers: noStore });
    } catch {
      console.error('PrePass monthly publication failed');
      return Response.json({ error: 'Monthly publication failed' }, { status: 500, headers: noStore });
    }
  };
}
