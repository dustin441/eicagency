import 'server-only';
import { z } from 'zod';
import { buildDurolineSnapshot, GHL_LOCATION, GHL_PIPELINE, MMC_FUNNEL, MMC_ORGANIZATION } from '../lib/duroline-pipeline-core';
import { createSpartacoSupabaseClient } from '../lib/spartaco-supabase-server';
import type { DurolinePipelineSnapshot } from '../lib/duroline-pipeline-types';

const MMC = 'https://api.mapmycustomers.me';
const GHL = 'https://services.leadconnectorhq.com';
const MAX_PAGES = 200;
const DEADLINE_MS = 240_000;
const id = z.string().trim().min(1);
const numericId = z.number().int().positive().safe();
const totalSchema = z.number().int().nonnegative().safe();
const date = z.string().datetime({ offset: true }).nullish().transform(v => v ?? null);
const stageSchema = z.object({
  id: numericId, name: id, hidden: z.boolean(), type: z.enum(['default', 'won', 'lost']),
  displayOrder: z.number().finite(), funnel: z.object({ id: z.literal(MMC_FUNNEL) }),
});
const dealSchema = z.object({
  id: numericId, name: z.string(), funnel: z.object({ id: z.literal(MMC_FUNNEL) }),
  stage: z.object({ id: numericId, name: id, type: id }),
  amount: z.number().finite().nullable(), createdAt: date, updatedAt: date,
  daysInStage: z.number().finite().nonnegative().nullish(),
  user: z.object({ fullName: z.string().nullish(), username: z.string().nullish() }).nullish(),
  customFields: z.array(z.object({
    customField: z.object({ id: numericId, displayName: id }), value: z.array(z.unknown()),
  })),
  importId: z.string().nullish(),
  contact: z.object({ importId: z.string().nullish() }).nullish(),
  lastCompletedActivity: z.object({ completedAt: date }).nullish(),
});
const opportunitySchema = z.object({
  id, name: z.string(), contactId: id.nullish(), locationId: z.literal(GHL_LOCATION),
  pipelineId: z.literal(GHL_PIPELINE), pipelineStageId: id,
  status: z.enum(['open', 'won', 'lost', 'abandoned']), createdAt: date, updatedAt: date,
});
const pipelineSchema = z.object({
  id, locationId: id.optional(), stages: z.array(z.object({ id, name: id })).min(1),
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Pipeline sync configuration unavailable');
  return value;
}
function unique<T>(rows: T[], key: (row: T) => string | number): void {
  if (new Set(rows.map(key)).size !== rows.length) throw new Error('Duplicate source identifiers');
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  // Never propagate schema issues containing source values to logs/HTTP responses.
  if (!result.success) throw new Error('Invalid pipeline source contract');
  return result.data;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Complete read-only source collection. No source URLs or scopes are caller-controlled. */
export async function collectDurolinePipelineSnapshot(): Promise<DurolinePipelineSnapshot> {
  const clientId = requiredEnv('DUROLINE_MMC_CLIENT_ID');
  const clientSecret = requiredEnv('DUROLINE_MMC_CLIENT_SECRET');
  const highlevelToken = requiredEnv('DUROLINE_HIGHLEVEL_TOKEN');
  const deadline = Date.now() + DEADLINE_MS;
  let lastRequest = 0;
  async function request(url: URL, init: RequestInit = {}): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, 150 - (Date.now() - lastRequest)));
      if (Date.now() >= deadline) throw new Error('Pipeline collection deadline exceeded');
      lastRequest = Date.now();
      try {
        const response = await fetch(url, {
          ...init, cache: 'no-store', redirect: 'error',
          signal: AbortSignal.timeout(Math.min(15_000, deadline - Date.now())),
        });
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await response.body?.cancel();
          await sleep(Math.min(5_000, Math.max(500 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new Error('Pipeline source request rejected'); }
        return await response.json();
      } catch {
        // Only explicit 429/5xx responses are retried. Invalid JSON, redirects,
        // authorization failures and timeouts abort the entire snapshot.
        throw new Error('Pipeline source request failed');
      }
    }
    throw new Error('Pipeline source retries exhausted');
  }
  const token = parse(z.object({ accessToken: id }), await request(new URL('/oauth/token/', MMC), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  })).accessToken;
  const mmcHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const ghlHeaders = { Authorization: `Bearer ${highlevelToken}`, Version: '2021-07-28', Accept: 'application/json' };
  const stagePage = parse(z.object({ total: totalSchema, count: totalSchema, data: z.array(stageSchema) }),
    await request(new URL(`/organizations/${MMC_ORGANIZATION}/funnels/${MMC_FUNNEL}/stages`, MMC), { headers: mmcHeaders }));
  if (stagePage.count !== stagePage.data.length || stagePage.total !== stagePage.count || !stagePage.count) throw new Error('Incomplete MMC stages');
  unique(stagePage.data, x => x.id);
  const stages = new Map(stagePage.data.map(x => [x.id, x]));
  const deals: z.output<typeof dealSchema>[] = [];
  let mmcTotal: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`/organizations/${MMC_ORGANIZATION}/deals`, MMC);
    url.search = new URLSearchParams({
      $filters: JSON.stringify({ funnelId: { $eq: MMC_FUNNEL }, includeCustomFields: true }),
      $limit: '20', $offset: String(deals.length), $order: 'id',
    }).toString();
    const result = parse(z.object({ total: totalSchema, count: totalSchema, data: z.array(dealSchema).max(20) }), await request(url, { headers: mmcHeaders }));
    mmcTotal ??= result.total;
    if (mmcTotal !== result.total || result.count !== result.data.length) throw new Error('Unstable MMC pagination');
    deals.push(...result.data);
    unique(deals, x => x.id);
    if (deals.length > mmcTotal) throw new Error('MMC total exceeded');
    if (deals.length === mmcTotal) break;
    if (!result.count) throw new Error('Incomplete MMC pagination');
  }
  if (deals.length !== mmcTotal) throw new Error('MMC page limit exceeded');
  for (const deal of deals) {
    const stage = stages.get(deal.stage.id);
    if (!stage || stage.name !== deal.stage.name || stage.type !== deal.stage.type) throw new Error('Invalid MMC stage membership');
  }
  const pipelinesUrl = new URL('/opportunities/pipelines', GHL);
  pipelinesUrl.searchParams.set('locationId', GHL_LOCATION);
  const pipelines = parse(z.object({ pipelines: z.array(pipelineSchema) }), await request(pipelinesUrl, { headers: ghlHeaders })).pipelines;
  const selected = pipelines.filter(x => x.id === GHL_PIPELINE);
  if (selected.length !== 1 || (selected[0].locationId && selected[0].locationId !== GHL_LOCATION)) throw new Error('Invalid HighLevel pipeline scope');
  unique(selected[0].stages, x => x.id);
  const ghlStages = new Map(selected[0].stages.map(x => [x.id, x.name]));
  const opportunities: z.output<typeof opportunitySchema>[] = [];
  let ghlTotal: number | undefined;
  let cursor: { startAfter: number; startAfterId: string } | undefined;
  const cursors = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('/opportunities/search', GHL);
    url.search = new URLSearchParams({ location_id: GHL_LOCATION, pipeline_id: GHL_PIPELINE, limit: '100', status: 'all',
      ...(cursor ? { startAfter: String(cursor.startAfter), startAfterId: cursor.startAfterId } : {}),
    }).toString();
    const result = parse(z.object({ opportunities: z.array(opportunitySchema).max(100), meta: z.object({
      total: totalSchema, startAfter: z.number().finite().nonnegative().nullish(), startAfterId: id.nullish(),
    }) }), await request(url, { headers: ghlHeaders }));
    ghlTotal ??= result.meta.total;
    if (ghlTotal !== result.meta.total) throw new Error('Unstable HighLevel pagination');
    for (const opportunity of result.opportunities) if (!ghlStages.has(opportunity.pipelineStageId)) throw new Error('Invalid HighLevel stage membership');
    opportunities.push(...result.opportunities);
    unique(opportunities, x => x.id);
    if (opportunities.length > ghlTotal) throw new Error('HighLevel total exceeded');
    if (opportunities.length === ghlTotal) break;
    const { startAfter, startAfterId } = result.meta;
    if (!result.opportunities.length || startAfter == null || !startAfterId) throw new Error('Incomplete HighLevel cursor');
    const key = JSON.stringify([startAfter, startAfterId]);
    if (cursors.has(key)) throw new Error('Repeated HighLevel cursor');
    cursors.add(key);
    cursor = { startAfter, startAfterId };
  }
  if (opportunities.length !== ghlTotal) throw new Error('HighLevel page limit exceeded');
  const byOpportunity = new Map(opportunities.map(x => [x.id, x]));
  const warnings = new Set<string>();
  function customId(deal: z.output<typeof dealSchema>, fieldId: number, label: string): string | null {
    const fields = deal.customFields.filter(x => x.customField.id === fieldId || x.customField.displayName === label);
    if (fields.length > 1) throw new Error('Conflicting MMC custom identifiers');
    if (!fields.length || !fields[0].value.length) return null;
    const field = fields[0];
    if (field.customField.id !== fieldId || field.customField.displayName !== label || field.value.length !== 1) throw new Error('Invalid MMC custom identifier contract');
    return parse(id, field.value[0]);
  }
  const snapshot = buildDurolineSnapshot({
    capturedAt: new Date().toISOString(), entryStage: 'Qualified',
    stageDefinitions: stagePage.data.map(x => ({ id: x.id, name: x.name, type: x.type, hidden: x.hidden, order: x.displayOrder })),
    leads: opportunities.map(x => ({ id: x.id, contactId: x.contactId ?? null, name: x.name, stage: ghlStages.get(x.pipelineStageId)!, status: x.status, createdAt: x.createdAt, updatedAt: x.updatedAt })),
    deals: deals.map(x => {
      const stage = stages.get(x.stage.id)!;
      let opportunityId = customId(x, 8177, 'HighLevel Opportunity ID');
      let contactId = customId(x, 8178, 'HighLevel Contact ID');
      if (!opportunityId || !contactId) warnings.add('Some MMC records lack explicit HighLevel custom identifiers; unmatched records remain visible. No name or email matching is used.');
      // Audited workflow Q4rjQTwnTBDSqCwb uses highlevelId as importBase for BOTH
      // prefixes. It prefers opportunity ID but can fall back to contact/email/phone.
      // Therefore accept fallback only when the suffix is a current scoped opportunity.
      const dealSuffix = /^ghl-deal-([A-Za-z0-9]+)$/.exec(x.importId ?? '')?.[1];
      if (!opportunityId && dealSuffix && byOpportunity.has(dealSuffix)) opportunityId = dealSuffix;
      const contactSuffix = /^ghl-contact-([A-Za-z0-9]+)$/.exec(x.contact?.importId ?? '')?.[1];
      if (!contactId && contactSuffix) contactId = byOpportunity.get(contactSuffix)?.contactId ?? null;
      return {
        id: x.id, name: x.name, stage: stage.name, stageId: stage.id, stageType: stage.type, hiddenStage: stage.hidden,
        owner: x.user?.fullName?.trim() || x.user?.username?.trim() || null, amount: x.amount,
        createdAt: x.createdAt, updatedAt: x.updatedAt, daysInStage: x.daysInStage ?? null,
        lastActivityAt: x.lastCompletedActivity?.completedAt ?? null,
        highlevelOpportunityId: opportunityId, highlevelContactId: contactId,
      };
    }),
  });
  // Replace the core's categorical handoff wording with the audited default caveat.
  snapshot.warnings = snapshot.warnings.filter(x => !x.startsWith('The handoff integration creates MMC deals'));
  warnings.add('Qualified is the audited workflow default entry stage, not proof of salesperson contact. Stage-map overrides may select a different stage or funnel.');
  warnings.add('All scoped source records are retained; test records may be included.');
  warnings.add('Import-ID fallbacks are accepted only for exact audited prefixes whose suffix identifies a current scoped HighLevel opportunity; arbitrary UUID import IDs are not join keys.');
  if (snapshot.deals.some(x => x.stageType === 'won' && (x.amount === null || x.amount === 0))) warnings.add('Won deals with zero or missing amounts do not prove zero revenue; CRM value completeness requires review.');
  snapshot.warnings.push(...warnings);
  return snapshot;
}

/** One atomic append only AFTER both sources have passed completeness checks. */
export async function refreshDurolinePipelineSnapshot() {
  const snapshot = await collectDurolinePipelineSnapshot();
  const { data, error } = await createSpartacoSupabaseClient().from('duroline_pipeline_snapshots')
    .insert({ captured_at: snapshot.capturedAt, payload: snapshot }).select('id')
    .abortSignal(AbortSignal.timeout(30_000)).single();
  if (error || !data || !['string', 'number'].includes(typeof data.id)) throw new Error('Pipeline snapshot persistence failed');
  return { snapshotId: String(data.id), capturedAt: snapshot.capturedAt, leadCount: snapshot.leads.length, dealCount: snapshot.deals.length, warningCount: snapshot.warnings.length };
}
