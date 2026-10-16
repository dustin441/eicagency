import { z } from 'zod';
import {
  ChannelRecommendationSchema,
  CreativeAssumptionsSchema,
  CreativeStrategySchema,
  GeneratedConceptSchema,
  LandingPageReceiptSchema,
  PublicCreativeProjectSchema,
  PublicCandidateSchema,
  ServerConfirmationReceiptSchema,
  type CreativeStrategy,
  type PublicCreativeProject,
} from '../lib/creative-studio/strategy.ts';

const Id = z.string().uuid();
const Time = z.string().datetime({ offset: true });
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Handle = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const JsonObject = z.record(z.string(), z.unknown());
const Context = z.object({ tenantId: z.literal('eicagency'), ownerId: Id }).strict();
export type VerifiedCreativeBuilderContext = Readonly<z.infer<typeof Context>>;

export type CreativeBuilderRpcArguments = {
  create_project: { p_normalized_url: string };
  list_projects: { p_limit: number; p_after_created_at: string | null; p_after_id: string | null };
  read_project: { p_project: string };
  read_project_canonical: { p_project: string };
  edit_plan: { p_project: string; p_expected_plan: string; p_expected_revision: number; p_scan: string; p_assumptions: unknown; p_channels: unknown; p_assumptions_hash: string };
  confirm_plan: { p_project: string; p_expected_plan: string; p_expected_revision: number };
  reserve_job: { p_project: string; p_expected_revision: number; p_operation: BuilderOperation; p_idempotency_key: string; p_reserved_units: number; p_reserved_bytes: number; p_target_kind: BuilderTarget | null; p_target_id: string | null };
  select_concept: { p_project: string; p_expected_revision: number; p_expected_concept_set: string | null; p_expected_concept_revision: string | null; p_concept_handle: string; p_ordered_asset_ids: string[] };
  link_studio_output: { p_project: string; p_expected_revision: number; p_expected_selection: string; p_studio_project: string; p_studio_version: string };
  transition_job: { p_job: string; p_token: string; p_generation: number; p_project: string; p_operation: BuilderOperation; p_expected_revision: number; p_state: 'scanning' | 'model_started' | 'committing'; p_model_timeout_seconds: number | null };
  renew_job: { p_job: string; p_token: string; p_generation: number; p_project: string; p_operation: BuilderOperation; p_expected_revision: number; p_seconds: number };
  commit_analysis: { p_job: string; p_token: string; p_generation: number; p_project: string; p_expected_revision: number; p_receipt: unknown; p_receipt_sha256: string; p_assumptions: unknown; p_channels: unknown; p_assumptions_hash: string; p_previews: unknown };
  commit_concepts: { p_job: string; p_token: string; p_generation: number; p_project: string; p_expected_revision: number; p_confirmed_plan: string; p_portfolio: unknown };
  commit_revision: { p_job: string; p_token: string; p_generation: number; p_project: string; p_expected_project_revision: number; p_target: BuilderTarget; p_expected_target: string; p_concept_handle: string | null; p_payload: unknown; p_user_message: string; p_assistant_message: string };
  import_asset_receipt: { p_job: string; p_token: string; p_generation: number; p_project: string; p_expected_revision: number; p_scan: string; p_candidate_id: string; p_object_key: string; p_sha256: string; p_mime: string; p_width: number; p_height: number; p_bytes: number };
  fail_job: { p_job: string; p_token: string; p_generation: number; p_project: string; p_operation: BuilderOperation; p_expected_revision: number; p_error_code: 'scan_failed' | 'provider_failed' | 'invalid_result' | 'storage_failed' | 'commit_failed' | 'cancelled' };
  recover_job: { p_job: string; p_project: string; p_operation: BuilderOperation; p_expected_revision: number };
};

export interface TrustedCreativeBuilderRpcTransport {
  readonly context: VerifiedCreativeBuilderContext;
  invoke<K extends keyof CreativeBuilderRpcArguments>(schema: 'creative_builder', name: K, args: CreativeBuilderRpcArguments[K]): Promise<{ data: unknown; error: { code?: string } | null }>;
}

export type BuilderOperation = 'analysis' | 'generation' | 'revision' | 'source_import' | 'cleanup';
export type BuilderTarget = 'plan' | 'portfolio' | 'concept';
export type CreativeBuilderRepositoryErrorCode = 'invalid' | 'denied' | 'conflict' | 'limit' | 'unavailable' | 'invalid-response';
export class CreativeBuilderRepositoryError extends Error {
  readonly code: CreativeBuilderRepositoryErrorCode;
  constructor(code: CreativeBuilderRepositoryErrorCode) {
    super(`Creative Builder repository: ${code}`);
    this.name = 'CreativeBuilderRepositoryError';
    this.code = code;
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown, code: CreativeBuilderRepositoryErrorCode = 'invalid-response'): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new CreativeBuilderRepositoryError(code);
  return result.data;
}

const ProjectRow = z.object({
  id: Id,
  normalized_url: z.string().url().max(2048),
  latest_scan_id: Id.nullable(),
  latest_plan_revision_id: Id.nullable(),
  latest_concept_set_id: Id.nullable(),
  latest_selection_id: Id.nullable(),
  linked_studio_project_id: Id.nullable(),
  linked_studio_version_id: Id.nullable(),
  revision: z.number().int().min(0).max(1000),
  created_at: Time,
  updated_at: Time,
}).strict();
const ListRow = ProjectRow.omit({ revision: true }).extend({ revision: z.number().int().min(0).max(1000) }).strict();
const ScanRow = z.object({ id: Id, project_revision: z.number().int().positive(), receipt_sha256: Hash, created_at: Time, receipt: LandingPageReceiptSchema.optional(), candidates: z.array(PublicCandidateSchema).max(24).optional() }).strict().superRefine((value, ctx) => {
  if ((value.receipt === undefined) === (value.candidates === undefined)) ctx.addIssue({ code: 'custom', message: 'Expected exactly one scan projection' });
});
const PlanRow = z.object({ id: Id, project_id: Id, parent_id: Id.nullable(), scan_id: Id, project_revision: z.number().int().positive(), assumptions: CreativeAssumptionsSchema, channels: z.array(ChannelRecommendationSchema).max(5), assumptions_hash: Hash, confirmation_receipts: z.array(ServerConfirmationReceiptSchema).max(9), created_at: Time }).strict();
const ConceptSetRow = z.object({ id: Id, project_id: Id, parent_id: Id.nullable(), plan_revision_id: Id, project_revision: z.number().int().positive(), portfolio: z.array(z.object({ handle: Handle, content: GeneratedConceptSchema }).strict()).length(6), content_hash: Hash, created_at: Time }).strict();
const ConceptRevisionRow = z.object({ id: Id, project_id: Id, concept_set_id: Id, concept_handle: Handle, parent_id: Id.nullable(), revision: z.number().int().min(1).max(100), content: GeneratedConceptSchema, content_hash: Hash, created_at: Time }).strict();
const SelectionRow = z.object({ id: Id, project_id: Id, concept_set_id: Id, concept_revision_id: Id, source_kind: z.enum(['portfolio', 'revision']), concept_handle: Handle, ordered_asset_ids: z.array(Id).max(8), content_hash: Hash, created_at: Time }).strict();
const MessageRow = z.object({ id: Id, project_id: Id, ordinal: z.number().int().min(1).max(200), target_kind: z.enum(['plan', 'portfolio', 'concept']), target_revision_id: Id, role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000), created_at: Time }).strict();
const SourceAssetRow = z.object({ id: Id, project_id: Id, scan_id: Id, candidate_id: Handle, sha256: Hash, mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']), width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192), size_bytes: z.number().int().positive().max(8_388_608), created_at: Time }).strict();
const PreviewRow = z.object({ id: Id, project_id: Id, scan_id: Id, candidate_id: Handle, sha256: Hash, mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']), width: z.number().int().positive().max(400), height: z.number().int().positive().max(400), size_bytes: z.number().int().positive().max(262_144), created_at: Time }).strict();
const JobRow = z.object({ id: Id, owner_id: Id, tenant_id: z.literal('eicagency'), project_id: Id, operation: z.enum(['analysis', 'generation', 'revision', 'source_import', 'cleanup']), idempotency_key: z.string().min(8).max(128), expected_project_revision: z.number().int().min(0), target_kind: z.enum(['plan', 'portfolio', 'concept']).nullable(), target_id: Id.nullable(), state: z.enum(['reserved', 'scanning', 'model_started', 'committing', 'completed', 'failed']), reserved_units: z.number().int().min(1).max(10), reserved_bytes: z.number().int().min(0).max(8_388_608), completed_units: z.number().int().min(0).max(10), fencing_generation: z.number().int().positive(), lease_expires_at: Time.nullable(), model_deadline: Time.nullable(), attempts: z.number().int().min(1).max(3), error_code: z.enum(['scan_failed', 'provider_failed', 'invalid_result', 'lease_expired', 'storage_failed', 'commit_failed', 'cancelled']).nullable(), created_at: Time, updated_at: Time }).strict();
const InternalRead = z.object({ project: ProjectRow, scans: z.array(ScanRow).max(20), plans: z.array(PlanRow).max(100), concept_sets: z.array(ConceptSetRow).max(50), concept_revisions: z.array(ConceptRevisionRow).max(5000), selections: z.array(SelectionRow).max(30), messages: z.array(MessageRow).max(200), source_assets: z.array(SourceAssetRow).max(50), candidate_previews: z.array(PreviewRow).max(160), jobs: z.array(JobRow).max(1000) }).strict();

const Cursor = z.object({ createdAt: Time, id: Id }).strict();
export type CreativeBuilderCursor = z.infer<typeof Cursor>;
const PageInput = z.object({ limit: z.number().int().min(1).max(100).default(50), cursor: Cursor.nullable().default(null) }).strict();
const HttpUrl = z.string().url().min(8).max(2048).superRefine((value, ctx) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) ctx.addIssue({ code: 'custom', message: 'Invalid landing URL' });
});
const CreateInput = z.object({ normalizedUrl: HttpUrl }).strict();
const EditInput = z.object({ projectId: Id, expectedPlanRevisionId: Id, expectedProjectRevision: z.number().int().min(0).max(1000), scanId: Id, assumptions: CreativeAssumptionsSchema, channels: z.array(ChannelRecommendationSchema).max(5), assumptionsHash: Hash }).strict();
const ConfirmInput = z.object({ projectId: Id, expectedPlanRevisionId: Id, expectedProjectRevision: z.number().int().min(0).max(1000) }).strict();
const ReservationInput = z.object({ projectId: Id, expectedProjectRevision: z.number().int().min(0).max(1000), operation: z.enum(['analysis', 'generation', 'revision', 'source_import', 'cleanup']), idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/), reservedUnits: z.number().int().min(1).max(10).default(1), reservedBytes: z.number().int().min(0).max(8_388_608).default(0), targetKind: z.enum(['plan', 'portfolio', 'concept']).nullable().default(null), targetId: Id.nullable().default(null) }).strict().superRefine((value, ctx) => {
  const targeted = value.operation === 'generation' || value.operation === 'revision';
  if (targeted !== (value.targetKind !== null && value.targetId !== null)) ctx.addIssue({ code: 'custom', message: 'Invalid job target' });
  if (value.operation === 'generation' && value.targetKind !== 'plan') ctx.addIssue({ code: 'custom', message: 'Generation requires a plan target' });
  if (value.operation !== 'source_import' && value.reservedBytes !== 0) ctx.addIssue({ code: 'custom', message: 'Only imports reserve bytes' });
});
const ProjectReceipt = z.object({ project_id: Id, revision: z.literal(0) }).strict();
const PlanReceipt = z.object({ plan_revision_id: Id, revision: z.number().int().positive(), confirmed: z.literal(false).optional(), confirmation_receipts: z.array(ServerConfirmationReceiptSchema).optional() }).strict();
const ReservationReceipt = z.object({ job_id: Id, state: z.enum(['reserved', 'scanning', 'model_started', 'committing', 'completed', 'failed']), lease_token: Id.nullable(), fencing_generation: z.number().int().positive(), attempts: z.number().int().min(1).max(3), idempotent: z.boolean().optional(), result: JsonObject.nullable().optional() }).strict();
const RevisionMessage = z.string().trim().min(1).max(2000);
const RevisionLoadInput = z.discriminatedUnion('target', [
  z.object({ projectId: Id, target: z.literal('plan'), expectedPlanRevisionId: Id, newPlanRevisionId: Id, claimIds: z.array(Handle).length(8), message: RevisionMessage }).strict(),
  z.object({ projectId: Id, target: z.literal('portfolio'), expectedConceptSetId: Id, newPortfolioId: Id, conceptIds: z.array(Handle).length(6), message: RevisionMessage }).strict(),
  z.object({ projectId: Id, target: z.literal('concept'), expectedConceptRevisionId: Id, conceptId: Handle, message: RevisionMessage }).strict(),
]);
type RevisionLoad = z.input<typeof RevisionLoadInput>;

function instant(value: string): number {
  const milliseconds = Date.parse(value);
  const fractionalMicros = Number((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
  return milliseconds * 1_000 + fractionalMicros;
}
const publicTime = (value: string) => new Date(value).toISOString();

export function createCreativeBuilderRepository(context: VerifiedCreativeBuilderContext, transport: TrustedCreativeBuilderRpcTransport, canonicalTransport: TrustedCreativeBuilderRpcTransport = transport) {
  if (typeof window !== 'undefined') throw new CreativeBuilderRepositoryError('denied');
  const actor = Object.freeze(parse(Context, context, 'denied'));
  function authorize(boundTransport: TrustedCreativeBuilderRpcTransport = transport) {
    const bound = parse(Context, boundTransport.context, 'denied');
    if (bound.ownerId !== actor.ownerId || bound.tenantId !== actor.tenantId) throw new CreativeBuilderRepositoryError('denied');
  }
  authorize();
  authorize(canonicalTransport);

  async function rpcOn<K extends keyof CreativeBuilderRpcArguments>(boundTransport: TrustedCreativeBuilderRpcTransport, name: K, args: CreativeBuilderRpcArguments[K]) {
    authorize(boundTransport);
    let response;
    try { response = await boundTransport.invoke('creative_builder', name, args); }
    catch { throw new CreativeBuilderRepositoryError('unavailable'); }
    if (!response || typeof response !== 'object' || !('data' in response) || !('error' in response)) throw new CreativeBuilderRepositoryError('invalid-response');
    if (response.error !== null) {
      const code = response.error?.code;
      throw new CreativeBuilderRepositoryError(code === '22023' ? 'invalid' : code === '42501' ? 'denied' : code === '40001' || code === '55000' ? 'conflict' : code === '54000' ? 'limit' : 'unavailable');
    }
    return response.data;
  }
  const rpc = <K extends keyof CreativeBuilderRpcArguments>(name: K, args: CreativeBuilderRpcArguments[K]) => rpcOn(transport, name, args);

  function validateInternal(value: unknown, projectId: string) {
    const data = parse(InternalRead, value);
    if (data.project.id !== projectId) throw new CreativeBuilderRepositoryError('invalid-response');
    const collections = [data.plans, data.concept_sets, data.concept_revisions, data.selections, data.messages, data.source_assets, data.candidate_previews, data.jobs];
    if (collections.some(rows => rows.some(row => row.project_id !== projectId))) throw new CreativeBuilderRepositoryError('invalid-response');
    if (data.jobs.some(job => job.owner_id !== actor.ownerId || job.tenant_id !== actor.tenantId)) throw new CreativeBuilderRepositoryError('denied');
    const ordered = <T extends { id: string; project_revision: number }>(rows: T[]) => rows.every((row, index) => index === 0 ? row.project_revision > 0 : row.project_revision > rows[index - 1].project_revision);
    if (!ordered(data.plans) || !ordered(data.concept_sets)) throw new CreativeBuilderRepositoryError('invalid-response');
    if (data.project.latest_scan_id !== (data.scans.at(-1)?.id ?? null) || data.project.latest_plan_revision_id !== (data.plans.at(-1)?.id ?? null) || data.project.latest_concept_set_id !== null && data.project.latest_concept_set_id !== data.concept_sets.at(-1)?.id || data.project.latest_selection_id !== null && data.project.latest_selection_id !== data.selections.at(-1)?.id) throw new CreativeBuilderRepositoryError('invalid-response');
    data.plans.forEach((plan, index) => {
      if (plan.parent_id !== (data.plans[index - 1]?.id ?? null) || !data.scans.some(scan => scan.id === plan.scan_id) || plan.confirmation_receipts.some(receipt => receipt.planRevisionId !== plan.id || receipt.confirmedBy !== actor.ownerId || receipt.contentSha256 !== plan.assumptions_hash)) throw new CreativeBuilderRepositoryError('invalid-response');
    });
    for (const set of data.concept_sets) {
      const parent = set.parent_id === null ? undefined : data.concept_sets.find(item => item.id === set.parent_id);
      if (set.plan_revision_id !== data.plans.find(plan => plan.project_revision <= set.project_revision && plan.id === set.plan_revision_id)?.id || (set.parent_id !== null && (!parent || parent.plan_revision_id !== set.plan_revision_id))) throw new CreativeBuilderRepositoryError('invalid-response');
      const handles = set.portfolio.map(item => item.handle);
      if (new Set(handles).size !== handles.length || set.portfolio.some(item => item.content.id !== item.handle)) throw new CreativeBuilderRepositoryError('invalid-response');
    }
    for (const revision of data.concept_revisions) {
      const set = data.concept_sets.find(item => item.id === revision.concept_set_id);
      const parent = revision.parent_id === null ? undefined : data.concept_revisions.find(item => item.id === revision.parent_id);
      const validParentSet = parent && (parent.concept_set_id === revision.concept_set_id || set?.parent_id === parent.concept_set_id);
      if (!set || revision.content.id !== revision.concept_handle || (revision.parent_id === null ? set.parent_id !== null || revision.revision !== 1 : !parent || !validParentSet || parent.concept_handle !== revision.concept_handle || parent.revision + 1 !== revision.revision)) throw new CreativeBuilderRepositoryError('invalid-response');
    }
    for (const selection of data.selections) {
      const revision = data.concept_revisions.find(item => item.id === selection.concept_revision_id);
      const revisionsForHandle = data.concept_revisions.filter(item => item.concept_set_id === selection.concept_set_id && item.concept_handle === selection.concept_handle).sort((left, right) => left.revision - right.revision);
      const sourceMatches = selection.source_kind === 'portfolio' ? revision?.id === revisionsForHandle[0]?.id : revision?.id === revisionsForHandle.at(-1)?.id && revisionsForHandle.length > 1;
      if (!revision || !sourceMatches || revision.concept_set_id !== selection.concept_set_id || revision.concept_handle !== selection.concept_handle || selection.ordered_asset_ids.some(assetId => !data.source_assets.some(asset => asset.id === assetId))) throw new CreativeBuilderRepositoryError('invalid-response');
    }
    return data;
  }

  async function readInternal(projectId: string) {
    const id = parse(Id, projectId, 'invalid');
    return validateInternal(await rpc('read_project', { p_project: id }), id);
  }

  async function readCanonicalInternal(projectId: string) {
    const id = parse(Id, projectId, 'invalid');
    return validateInternal(await rpcOn(canonicalTransport, 'read_project_canonical', { p_project: id }), id);
  }

  function toStrategy(data: z.infer<typeof InternalRead>): CreativeStrategy {
    const plan = data.plans.at(-1);
    const scan = plan && data.scans.find(item => item.id === plan.scan_id);
    if (!plan || !scan || !scan.receipt) throw new CreativeBuilderRepositoryError('invalid-response');
    const conversation = data.messages.map(message => ({ id: message.id, role: message.role, createdAt: publicTime(message.created_at), message: message.content, target: message.target_kind === 'plan' ? 'assumptions' as const : message.target_kind, ...(message.target_kind === 'concept' ? { conceptId: data.concept_revisions.find(row => row.id === message.target_revision_id)?.concept_handle } : {}) }));
    const common = { version: 1 as const, projectId: data.project.id, planRevisionId: plan.id, receipt: scan.receipt, assumptions: plan.assumptions, channels: plan.channels, confirmationReceipts: plan.confirmation_receipts, conversation };
    const planConfirmation = plan.confirmation_receipts.find(receipt => receipt.scope === 'plan');
    if (!planConfirmation) return parse(CreativeStrategySchema, { ...common, phase: 'draft' });
    const set = data.project.latest_concept_set_id ? data.concept_sets.find(item => item.id === data.project.latest_concept_set_id) : undefined;
    if (!set) return parse(CreativeStrategySchema, { ...common, phase: 'confirmed', confirmationReceiptId: planConfirmation.id });
    if (set.plan_revision_id !== plan.id) throw new CreativeBuilderRepositoryError('invalid-response');
    const portfolioRoots = set.portfolio.map(item => data.concept_revisions.filter(row => row.concept_set_id === set.id && row.concept_handle === item.handle).sort((left, right) => left.revision - right.revision)[0]);
    if (portfolioRoots.some(row => !row) || portfolioRoots.some((row, index) => JSON.stringify(row!.content) !== JSON.stringify(set.portfolio[index].content))) throw new CreativeBuilderRepositoryError('invalid-response');
    const portfolio = { id: set.id, planRevisionId: plan.id, confirmationReceiptId: planConfirmation.id, concepts: portfolioRoots.map(row => row!.content) };
    const conceptRevisions = data.concept_revisions.filter(row => row.concept_set_id === set.id && row.parent_id !== null && data.concept_revisions.some(parent => parent.id === row.parent_id && parent.concept_set_id === set.id)).map(row => ({ id: row.id, parentRevisionId: row.parent_id!, concept: row.content, createdAt: publicTime(row.created_at) }));
    const selections = data.selections.filter(row => row.concept_set_id === set.id).map(row => row.source_kind === 'portfolio'
      ? { id: row.id, source: 'portfolio' as const, conceptId: row.concept_handle, conceptSetId: row.concept_set_id, assetIds: row.ordered_asset_ids, contentSha256: row.content_hash, createdAt: publicTime(row.created_at), createdBy: actor.ownerId }
      : { id: row.id, source: 'revision' as const, conceptId: row.concept_handle, conceptRevisionId: row.concept_revision_id, assetIds: row.ordered_asset_ids, contentSha256: row.content_hash, createdAt: publicTime(row.created_at), createdBy: actor.ownerId });
    return parse(CreativeStrategySchema, { ...common, phase: 'generated', confirmationReceiptId: planConfirmation.id, portfolio, conceptRevisions, selections, ...(data.project.latest_selection_id ? { currentSelectionId: data.project.latest_selection_id } : {}) });
  }

  function publicProject(data: z.infer<typeof InternalRead>): PublicCreativeProject {
    const plan = data.plans.find(item => item.id === data.project.latest_plan_revision_id);
    const scan = plan && data.scans.find(item => item.id === plan.scan_id && item.id === data.project.latest_scan_id);
    if (!plan || !scan) throw new CreativeBuilderRepositoryError('invalid-response');
    const candidates = scan.candidates ?? scan.receipt?.assets.map(candidate => ({ id: candidate.id, pageId: candidate.pageId, kind: candidate.kind, alt: candidate.alt, ...(candidate.width === undefined ? {} : { width: candidate.width }), ...(candidate.height === undefined ? {} : { height: candidate.height }) }));
    if (!candidates) throw new CreativeBuilderRepositoryError('invalid-response');
    const conversation = data.messages.map(message => ({ id: message.id, role: message.role, createdAt: publicTime(message.created_at), message: message.content, target: message.target_kind === 'plan' ? 'assumptions' as const : message.target_kind, ...(message.target_kind === 'concept' ? { conceptId: data.concept_revisions.find(row => row.id === message.target_revision_id)?.concept_handle } : {}) }));
    const planConfirmation = plan.confirmation_receipts.find(receipt => receipt.scope === 'plan');
    const set = planConfirmation && data.project.latest_concept_set_id ? data.concept_sets.find(item => item.id === data.project.latest_concept_set_id) : undefined;
    const phase = !planConfirmation ? 'draft' as const : !set ? 'confirmed' as const : 'generated' as const;
    let concepts: Array<{revisionId: string; source: 'portfolio' | 'revision'; concept: z.infer<typeof GeneratedConceptSchema>}> | undefined;
    if (set) {
      if (set.plan_revision_id !== plan.id) throw new CreativeBuilderRepositoryError('invalid-response');
      const rowsByPortfolio = set.portfolio.map(item => data.concept_revisions.filter(row => row.concept_set_id === set.id && row.concept_handle === item.handle).sort((left, right) => left.revision - right.revision));
      if (rowsByPortfolio.some(rows => rows.length < 1) || rowsByPortfolio.some((rows, index) => JSON.stringify(rows[0].content) !== JSON.stringify(set.portfolio[index].content))) throw new CreativeBuilderRepositoryError('invalid-response');
      concepts = rowsByPortfolio.map(rows => { const latest = rows.at(-1)!; return {revisionId: latest.id, source: rows.length === 1 ? 'portfolio' as const : 'revision' as const, concept: latest.content}; });
    }
    const selection = data.project.latest_selection_id ? data.selections.find(item => item.id === data.project.latest_selection_id) : undefined;
    if (data.project.latest_selection_id && !selection) throw new CreativeBuilderRepositoryError('invalid-response');
    const currentSelection = selection ? selection.source_kind === 'portfolio'
      ? { id: selection.id, source: 'portfolio' as const, conceptId: selection.concept_handle, conceptSetId: selection.concept_set_id, assetIds: selection.ordered_asset_ids, createdAt: publicTime(selection.created_at) }
      : { id: selection.id, source: 'revision' as const, conceptId: selection.concept_handle, conceptRevisionId: selection.concept_revision_id, assetIds: selection.ordered_asset_ids, createdAt: publicTime(selection.created_at) }
      : undefined;
    return parse(PublicCreativeProjectSchema, {
      version: 1,
      projectId: data.project.id,
      projectRevision: data.project.revision,
      phase,
      landingUrl: data.project.normalized_url,
      scanId: scan.id,
      planRevisionId: plan.id,
      assumptions: plan.assumptions,
      channels: plan.channels,
      candidates,
      conversation,
      ...(phase === 'generated' ? { conceptSetId: set!.id, concepts: concepts!, ...(currentSelection ? { currentSelection } : {}) } : {}),
    });
  }

  async function read(projectId: string) { return publicProject(await readInternal(projectId)); }

  async function listPage(input: z.input<typeof PageInput> = {}) {
    const { limit, cursor } = parse(PageInput, input, 'invalid');
    const rows = parse(z.array(ListRow).max(limit), await rpc('list_projects', { p_limit: limit, p_after_created_at: cursor?.createdAt ?? null, p_after_id: cursor?.id ?? null }));
    let previous = cursor;
    const seen = new Set<string>();
    for (const row of rows) {
      const current = { createdAt: row.created_at, id: row.id };
      if (seen.has(row.id) || previous && (instant(current.createdAt) < instant(previous.createdAt) || instant(current.createdAt) === instant(previous.createdAt) && current.id <= previous.id)) throw new CreativeBuilderRepositoryError('invalid-response');
      seen.add(row.id); previous = current;
    }
    const last = rows.at(-1);
    return { projects: rows.map(row => ({ id: row.id, landingUrl: row.normalized_url, revision: row.revision, phase: row.latest_concept_set_id ? 'generated' as const : row.latest_plan_revision_id ? 'draft' as const : 'created' as const, createdAt: row.created_at, updatedAt: row.updated_at })), nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null, exhausted: rows.length < limit };
  }

  async function listAll(input: { pageSize?: number; maxProjects?: number } = {}) {
    const value = parse(z.object({ pageSize: z.number().int().min(1).max(100).default(50), maxProjects: z.number().int().min(1).max(1000).default(100) }).strict(), input, 'invalid');
    const projects: Awaited<ReturnType<typeof listPage>>['projects'] = [];
    let cursor: CreativeBuilderCursor | null = null;
    do {
      const page = await listPage({ limit: Math.min(value.pageSize, value.maxProjects - projects.length), cursor });
      projects.push(...page.projects);
      if (page.exhausted) return projects;
      if (!page.nextCursor || projects.length >= value.maxProjects) throw new CreativeBuilderRepositoryError('limit');
      cursor = page.nextCursor;
    } while (projects.length < value.maxProjects);
    throw new CreativeBuilderRepositoryError('limit');
  }

  async function reconcile(projectId: string, predicate: (data: z.infer<typeof InternalRead>) => boolean) {
    const canonical = await readInternal(projectId);
    if (!predicate(canonical)) throw new CreativeBuilderRepositoryError('unavailable');
    return canonical;
  }

  return Object.freeze({
    read,
    list: listPage,
    listAll,
    async create(input: z.input<typeof CreateInput>) {
      const value = parse(CreateInput, input, 'invalid');
      const receipt = parse(ProjectReceipt, await rpc('create_project', { p_normalized_url: value.normalizedUrl }));
      return Object.freeze({ projectId: receipt.project_id, revision: receipt.revision });
    },
    async editPlan(input: z.input<typeof EditInput>) {
      const value = parse(EditInput, input, 'invalid');
      const args: CreativeBuilderRpcArguments['edit_plan'] = { p_project: value.projectId, p_expected_plan: value.expectedPlanRevisionId, p_expected_revision: value.expectedProjectRevision, p_scan: value.scanId, p_assumptions: structuredClone(value.assumptions), p_channels: structuredClone(value.channels), p_assumptions_hash: value.assumptionsHash };
      let receipt: z.infer<typeof PlanReceipt> | undefined;
      try { receipt = parse(PlanReceipt, await rpc('edit_plan', args)); }
      catch (error) { if (!(error instanceof CreativeBuilderRepositoryError) || error.code !== 'unavailable') throw error; }
      const canonical = await reconcile(value.projectId, data => data.project.revision === value.expectedProjectRevision + 1 && data.plans.at(-1)?.parent_id === value.expectedPlanRevisionId && (!receipt || data.plans.at(-1)?.id === receipt.plan_revision_id));
      return publicProject(canonical);
    },
    async confirmPlan(input: z.input<typeof ConfirmInput>) {
      const value = parse(ConfirmInput, input, 'invalid');
      let receipt: z.infer<typeof PlanReceipt> | undefined;
      try { receipt = parse(PlanReceipt, await rpc('confirm_plan', { p_project: value.projectId, p_expected_plan: value.expectedPlanRevisionId, p_expected_revision: value.expectedProjectRevision })); }
      catch (error) { if (!(error instanceof CreativeBuilderRepositoryError) || error.code !== 'unavailable') throw error; }
      const canonical = await reconcile(value.projectId, data => data.project.revision === value.expectedProjectRevision + 1 && data.plans.at(-1)?.parent_id === value.expectedPlanRevisionId && data.plans.at(-1)!.confirmation_receipts.some(item => item.scope === 'plan') && (!receipt || data.plans.at(-1)?.id === receipt.plan_revision_id));
      return publicProject(canonical);
    },
    async reserveJob(input: z.input<typeof ReservationInput>) {
      const value = parse(ReservationInput, input, 'invalid');
      const receipt = parse(ReservationReceipt, await rpc('reserve_job', { p_project: value.projectId, p_expected_revision: value.expectedProjectRevision, p_operation: value.operation, p_idempotency_key: value.idempotencyKey, p_reserved_units: value.reservedUnits, p_reserved_bytes: value.reservedBytes, p_target_kind: value.targetKind, p_target_id: value.targetId }));
      if (!receipt.lease_token && !['completed', 'failed'].includes(receipt.state)) throw new CreativeBuilderRepositoryError('invalid-response');
      // This server-only lease capability must never be serialized in a public DTO.
      return Object.freeze({ jobId: receipt.job_id, state: receipt.state, leaseToken: receipt.lease_token, fencingGeneration: receipt.fencing_generation, attempts: receipt.attempts, idempotent: receipt.idempotent ?? false, result: receipt.result ?? null });
    },
    canonicalLoader: Object.freeze({
      async loadForAnalysis(input: Readonly<{ projectId: string; scanId: string }>) {
        const value = parse(z.object({ projectId: Id, scanId: Id }).strict(), input, 'invalid');
        const data = await readCanonicalInternal(value.projectId);
        const scan = data.scans.find(item => item.id === value.scanId);
        if (!scan?.receipt) throw new CreativeBuilderRepositoryError('invalid-response');
        return structuredClone(scan.receipt);
      },
      async loadForGeneration(input: Readonly<{ projectId: string; expectedPlanRevisionId: string }>) {
        const value = parse(z.object({ projectId: Id, expectedPlanRevisionId: Id }).strict(), input, 'invalid');
        const data = await readCanonicalInternal(value.projectId);
        const strategy = toStrategy(data);
        if (strategy.planRevisionId !== value.expectedPlanRevisionId || strategy.phase === 'draft') throw new CreativeBuilderRepositoryError('conflict');
        return { strategy: structuredClone(strategy), planContentSha256: data.plans.at(-1)!.assumptions_hash };
      },
      async loadForRevision(input: Readonly<RevisionLoad>) {
        const value = parse(RevisionLoadInput, input, 'invalid');
        const data = await readCanonicalInternal(value.projectId);
        const strategy = toStrategy(data);
        const plan = data.plans.at(-1)!;
        if (value.target === 'plan' && value.expectedPlanRevisionId !== plan.id) throw new CreativeBuilderRepositoryError('conflict');
        if (value.target === 'portfolio' && value.expectedConceptSetId !== data.project.latest_concept_set_id) throw new CreativeBuilderRepositoryError('conflict');
        let targetConceptRevision: { revisionId: string; concept: unknown } | undefined;
        if (value.target === 'concept') {
          const expected = value.expectedConceptRevisionId;
          const handle = value.conceptId;
          const row = data.concept_revisions.find(item => item.id === expected && item.concept_handle === handle && item.concept_set_id === data.project.latest_concept_set_id);
          if (!row || data.concept_revisions.some(item => item.concept_set_id === row.concept_set_id && item.concept_handle === handle && item.revision > row.revision)) throw new CreativeBuilderRepositoryError('conflict');
          targetConceptRevision = { revisionId: row.id, concept: structuredClone(row.content) };
        }
        return { strategy: structuredClone(strategy), planContentSha256: plan.assumptions_hash, ...(targetConceptRevision ? { targetConceptRevision } : {}) };
      },
    }),
  });
}
