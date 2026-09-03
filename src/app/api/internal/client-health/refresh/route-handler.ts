import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { assertDateOnly } from '../../../../../services/client-health/date-windows.ts';
import {
  lastCompletePhoenixDate,
  runProductionClientHealthRefresh,
  type ProductionRefreshReceipt,
} from '../../../../../services/client-health/production-refresh-runner.ts';

type HandlerDependencies = {
  getSecret?: () => string | undefined;
  now?: () => Date;
  runRefresh?: (snapshotDate: string) => Promise<ProductionRefreshReceipt>;
};

const noStore = { 'Cache-Control': 'no-store' };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authorized(request: Request, expected: string | undefined): boolean {
  if (!expected || expected !== expected.trim() || expected.length === 0) return false;
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  const supplied = match?.[1] ?? '';
  return timingSafeEqual(digest(expected), digest(supplied));
}

async function parseSnapshotDate(request: Request, now: () => Date): Promise<string> {
  const text = await request.text();
  let value: unknown = {};
  if (text.trim() !== '') value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body');
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'snapshotDate') || keys.length > 1) throw new Error('Invalid body');
  if (!Object.prototype.hasOwnProperty.call(body, 'snapshotDate')) return lastCompletePhoenixDate(now());
  if (typeof body.snapshotDate !== 'string') throw new Error('Invalid snapshotDate');
  assertDateOnly(body.snapshotDate, 'snapshotDate');
  return body.snapshotDate;
}

export function createClientHealthRefreshPostHandler(dependencies: HandlerDependencies = {}) {
  const getSecret = dependencies.getSecret ?? (() => process.env.CLIENT_HEALTH_REFRESH_TOKEN);
  const now = dependencies.now ?? (() => new Date());
  const runRefresh = dependencies.runRefresh ?? runProductionClientHealthRefresh;
  return async function POST(request: Request): Promise<Response> {
    if (!authorized(request, getSecret())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
    }
    let snapshotDate: string;
    try {
      snapshotDate = await parseSnapshotDate(request, now);
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
    }
    try {
      const receipt = await runRefresh(snapshotDate);
      return Response.json({ ok: true, ...receipt }, { headers: noStore });
    } catch {
      return Response.json({ error: 'Client health refresh failed' }, { status: 500, headers: noStore });
    }
  };
}