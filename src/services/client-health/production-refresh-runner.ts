import 'server-only';

import { randomUUID } from 'node:crypto';

import { createEicSupabaseClient } from '../../lib/spartaco-supabase-server.ts';
import { createAtomicRefreshProductionAdapter } from './atomic-refresh-production.ts';
import { normalizeActiveConfigRevision } from './config-revision.ts';
import { phoenixDateFromInstant } from './date-windows.ts';
import { createProductionClientHealthRefreshPlanner } from './production-refresh-planner.ts';
import {
  runClientHealthRefresh,
  type OrderedRefreshClock,
  type RefreshLifecyclePort,
  type RefreshRunResult,
} from './run-refresh.ts';

export const PRODUCTION_REFRESH_LIMITS = Object.freeze({
  concurrency: 4,
  deadlineMs: 120_000,
  leaseDurationMs: 600_000,
});

export type ProductionRefreshReceipt = {
  refreshRunId: string;
  evidenceHash: string;
  snapshotCount: number;
  snapshotDate: string;
};

export function lastCompletePhoenixDate(now: Date = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Current time is invalid');
  return phoenixDateFromInstant(new Date(now.getTime() - 86_400_000));
}

export function createOrderedCanonicalClock(now: () => Date = () => new Date()): OrderedRefreshClock {
  let previous = Number.NEGATIVE_INFINITY;
  return {
    nextTimestamp(): string {
      const candidate = now().getTime();
      if (!Number.isFinite(candidate)) throw new Error('Refresh clock returned an invalid time');
      previous = Math.max(candidate, previous + 1);
      return new Date(previous).toISOString();
    },
  };
}

async function withDeadline<T>(deadlineMs: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function runProductionClientHealthRefresh(snapshotDate: string): Promise<ProductionRefreshReceipt> {
  const db = createEicSupabaseClient();
  const atomic = createAtomicRefreshProductionAdapter(db);
  const lifecycle = atomic as RefreshLifecyclePort;
  const planner = createProductionClientHealthRefreshPlanner();
  const active = normalizeActiveConfigRevision(await withDeadline(
    PRODUCTION_REFRESH_LIMITS.deadlineMs,
    (signal) => lifecycle.getActiveConfigRevision({ signal }),
  ));
  const materialized = await planner.materializePlan(active, snapshotDate);
  const result: RefreshRunResult = await runClientHealthRefresh({
    invocationId: randomUUID(),
    leaseDurationMs: PRODUCTION_REFRESH_LIMITS.leaseDurationMs,
    snapshotDate,
    calculationVersion: materialized.calculationVersion,
    sourceContractVersion: materialized.sourceContractVersion,
    concurrency: PRODUCTION_REFRESH_LIMITS.concurrency,
    deadlineMs: PRODUCTION_REFRESH_LIMITS.deadlineMs,
    configRevision: materialized.configRevision,
    clients: materialized.clients,
  }, {
    lifecycle,
    persistence: atomic,
    planner,
    clock: createOrderedCanonicalClock(),
  });
  return {
    refreshRunId: result.refreshRunId,
    evidenceHash: result.evidenceHash,
    snapshotCount: result.receipts.length,
    snapshotDate,
  };
}