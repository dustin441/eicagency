import 'server-only';
import { z } from 'zod';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import type { DurolinePipelineSnapshot } from '@/lib/duroline-pipeline-types';

const nullableDate = z.string().datetime({ offset: true }).nullable();
const matchStatus = z.enum(['matched', 'unmatched', 'ambiguous']);
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: z.string().datetime({ offset: true }),
  ghlLocationId: z.literal('KU4RlCj1mDVF6eNxwqcZ'), ghlPipelineId: z.literal('DAtuQG1i9iWE5JGvK0a5'),
  mmcOrganizationId: z.literal(75), mmcFunnelId: z.literal(14159165),
  leads: z.array(z.object({
    id: z.string(), contactId: z.string().nullable(), name: z.string(),
    stage: z.string(), status: z.string(), createdAt: nullableDate, updatedAt: nullableDate,
    quality: z.boolean(), mmcDealIds: z.array(z.number()), matchStatus,
  })),
  deals: z.array(z.object({
    id: z.number(), name: z.string(), stage: z.string(), stageId: z.number(),
    stageType: z.string(), hiddenStage: z.boolean(), owner: z.string().nullable(),
    amount: z.number().finite().nullable(), createdAt: nullableDate, updatedAt: nullableDate,
    daysInStage: z.number().nonnegative().nullable(), lastActivityAt: nullableDate,
    highlevelOpportunityId: z.string().nullable(), highlevelContactId: z.string().nullable(),
    matchStatus,
    salesState: z.enum(['awaiting_contact', 'contacted', 'negotiating', 'won', 'lost', 'legacy_qualified', 'other']),
  })),
  qualityStages: z.array(z.string()),
  stageDefinitions: z.array(z.object({ id: z.number(), name: z.string(), hidden: z.boolean(), type: z.string(), order: z.number() })),
  warnings: z.array(z.string()), entryStage: z.string().nullable(),
});

export type DurolineSnapshotResult =
  | { status: 'ready'; snapshot: DurolinePipelineSnapshot; capturedAt: string }
  | { status: 'missing' | 'error' };

/** Reads one complete current-state snapshot, never substitutes synthetic empty data. */
export async function fetchDurolinePipelineSnapshot(): Promise<DurolineSnapshotResult> {
  try {
    const { data, error } = await createSpartacoSupabaseClient()
      .from('duroline_pipeline_snapshots')
      .select('id,captured_at,payload')
      .order('captured_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: 'error' };
    if (!data) return { status: 'missing' };
    const parsed = snapshotSchema.safeParse(data.payload);
    if (!parsed.success || !z.string().datetime({ offset: true }).safeParse(data.captured_at).success) {
      return { status: 'error' };
    }
    return { status: 'ready', snapshot: parsed.data, capturedAt: data.captured_at };
  } catch {
    // Deliberately omit upstream errors and payloads: these can contain lead PII.
    return { status: 'error' };
  }
}
