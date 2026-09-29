import { z } from 'zod';
import { createHash } from 'node:crypto';
import { BriefSchema, SceneSchema, RatioSchema, type Brief, type Project, type Ratio, type Version } from '../lib/creative-studio/model.ts';
import { DirectionSchema, STYLES, STYLE_IDS, EVIDENCE_LANES, type Direction, type Style } from '../lib/creative-studio/directions.ts';

const Id = z.string().uuid();
const Time = z.string().datetime({ offset: true });
const Context = z.object({ tenantId: z.literal('eicagency'), ownerId: Id }).strict();
/** Only the trusted server auth/allowlist boundary may supply this; not request JSON or user_metadata. */
export type VerifiedStudioContext = Readonly<z.infer<typeof Context>>;
export type StudioRpcArguments = {
  create_artwork: Omit<StudioRpcArguments['save_version'], 'p_project' | 'p_expected'>;
  save_direction: { p_project: string | null; p_expected: string | null; p_planning_brief: Brief | null; p_direction: Direction; p_style_snapshot: Style };
  list_projects: { p_limit: number; p_after_created_at: string | null; p_after_id: string | null };
  read_project: { p_project: string };
  save_version: { p_project: string; p_expected: string | null; p_brief: Brief; p_scene: z.infer<typeof SceneSchema>; p_sources: z.infer<typeof Sources>; p_recipes: z.infer<typeof Recipes> };
  enqueue: { p_project: string; p_expected: string; p_placement: Ratio };
  review_asset: { p_project: string; p_expected: string; p_asset: string; p_approved: boolean };
  approve: { p_project: string; p_expected: string };
};
/** An injected server capability, NOT a generic browser/service-role Supabase client.
 * Implementation must bind verified context to short-lived SQL actor claims.
 * creative_studio is deliberately not exposed via ordinary PostgREST.
 */
export interface TrustedStudioRpcTransport {
  readonly context: VerifiedStudioContext;
  invoke<K extends keyof StudioRpcArguments>(schema: 'creative_studio', name: K, args: StudioRpcArguments[K]): Promise<{ data: unknown; error: { code?: string } | null }>;
}
export type RepositoryErrorCode = 'invalid' | 'denied' | 'conflict' | 'unavailable' | 'invalid-response' | 'unsupported';
export class StudioRepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  constructor(code: RepositoryErrorCode) { super(`Studio repository: ${code}`); this.name = 'StudioRepositoryError'; this.code = code; }
}
function parse<S extends z.ZodType>(schema: S, value: unknown, code: RepositoryErrorCode = 'invalid-response'): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new StudioRepositoryError(code);
  return result.data;
}
const StyleSnapshot = z.object({ id: z.enum(STYLE_IDS), name: z.string(), job: z.string(), requirements: z.string(), support: z.literal('planning-only'), references: z.array(z.object({ title: z.string(), url: z.string(), lane: z.enum(EVIDENCE_LANES), limitation: z.string() }).strict()) }).strict();
const Row = z.object({ id: Id, owner_id: Id, tenant_id: z.literal('eicagency'), planning_brief: BriefSchema.nullable(), latest_direction_id: Id.nullable(), updated_at: Time, latest_version_id: Id.nullable(), approved_version_id: Id.nullable(), approved_at: Time.nullable(), created_at: Time }).strict();
const DirectionRow = z.object({ id: Id, project_id: Id, parent_id: Id.nullable(), revision: z.number().int().positive(), created_by: Id, brief: DirectionSchema, style_snapshot: StyleSnapshot, created_at: Time }).strict();
const Sources = z.object({ sources: z.array(z.object({ id:z.string(), title:z.string(), url:z.string(), role:z.string(), note:z.string() }).strict()), warnings:z.array(z.string()) }).strict();
const Placement = z.object({width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),insetX:z.number().nonnegative(),insetY:z.number().nonnegative(),name:z.string(),family:z.enum(['meta','google-image','logo','banner']),mimeType:z.enum(['image/png','image/jpeg']),extension:z.enum(['png','jpg']),maxBytes:z.number().int().positive()}).strict();
const Recipe = z.object({html:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),placement:Placement}).strict().refine(r=>createHash('sha256').update(r.html,'utf8').digest('hex')===r.sha256);
const Recipes = z.record(z.string(),Recipe).refine(r=>Object.keys(r).length>0 && Object.keys(r).every(k=>RatioSchema.safeParse(k).success));
const VersionRow = z.object({id:Id,project_id:Id,parent_id:Id.nullable(),brief:BriefSchema,scene:SceneSchema,source_snapshot:Sources,recipes:Recipes,created_at:Time}).strict();
// read_project intentionally omits lease_token. Unknown keys (including tokens) fail closed.
const JobRow = z.object({id:Id,version_id:Id,placement_id:RatioSchema,recipe_sha256:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['queued','running','complete','failed']),attempts:z.number().int().min(0).max(3),lease_expires_at:Time.nullable(),error_code:z.enum(['render_failed','lease_expired','qa_failed']).nullable(),created_at:Time}).strict().refine(j=>(j.status==='running')===(j.lease_expires_at!==null));
const AssetRow = z.object({id:Id,job_id:Id,object_key:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),mime_type:z.enum(['image/png','image/jpeg']),size_bytes:z.number().int().positive().max(20971520),width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),qa_passed:z.boolean(),finalized_at:Time}).strict();
const ReviewRow = z.object({asset_id:Id,approved:z.boolean(),reviewed_at:Time}).strict();
const ArtworkSave = z.object({projectId:Id,expectedVersionId:Id.nullable(),brief:BriefSchema,scene:SceneSchema,sourceSnapshot:Sources,recipes:Recipes}).strict();
const ArtworkCreate = ArtworkSave.omit({projectId:true,expectedVersionId:true}).strict();
const ArtworkReceipt = z.object({project_id:Id,version_id:Id}).strict();
// Internal recipe HTML is never part of the public Project projection.
const InternalRead = z.object({ project: Row, directions: z.array(DirectionRow), versions: z.array(z.unknown()), jobs: z.array(z.unknown()), assets: z.array(z.unknown()), reviews: z.array(z.unknown()) }).strict();
const Receipt = z.object({ project_id: Id, direction_id: Id, revision: z.number().int().positive() }).strict();
const Cursor = z.object({ createdAt: Time, id: Id }).strict();
export type StudioCursor = z.infer<typeof Cursor>;
const PageInput = z.object({ limit: z.number().int().min(1).max(100).default(50), cursor: Cursor.nullable().default(null) }).strict();
const Create = z.object({ brief: BriefSchema, direction: DirectionSchema }).strict();
const Save = z.object({ projectId: Id, expectedDirectionId: Id.nullable(), direction: DirectionSchema }).strict();
export type StudioProjectSummary = { id: string; createdAt: string; updatedAt: string; latestDirectionId: string | null; hasArtwork: boolean };
export function createStudioRepository(context: VerifiedStudioContext, transport: TrustedStudioRpcTransport) {
  if (typeof window !== 'undefined') throw new StudioRepositoryError('denied');
  const actor = Object.freeze(parse(Context, context, 'denied'));
  function authorize() {
    const bound = parse(Context, transport.context, 'denied');
    if (bound.ownerId !== actor.ownerId || bound.tenantId !== actor.tenantId) throw new StudioRepositoryError('denied');
  }
  authorize();
  async function rpc<K extends keyof StudioRpcArguments>(name: K, args: StudioRpcArguments[K]) {
    authorize();
    let response;
    try { response = await transport.invoke('creative_studio', name, args); }
    catch { throw new StudioRepositoryError('unavailable'); }
    if (!response || typeof response !== 'object' || !('error' in response) || !('data' in response)) throw new StudioRepositoryError('invalid-response');
    if (response.error !== null) {
      const code = response.error?.code;
      throw new StudioRepositoryError(code === '40001' ? 'conflict' : code === '42501' ? 'denied' : code === '22023' ? 'invalid' : 'unavailable');
    }
    return response.data;
  }
  function owned(row: z.infer<typeof Row>) {
    if (row.owner_id !== actor.ownerId || row.tenant_id !== actor.tenantId) throw new StudioRepositoryError('denied');
  }
  async function readInternal(projectId: string) {
    const id = parse(Id, projectId, 'invalid');
    const raw = await rpc('read_project', { p_project: id });
    const dto = parse(InternalRead, raw);
    owned(dto.project);
    if (dto.project.id !== id) throw new StudioRepositoryError('invalid-response');
    const assets = parse(z.array(AssetRow), dto.assets);
    const reviews = parse(z.array(ReviewRow), dto.reviews);
    const rows = parse(z.array(VersionRow), dto.versions);
    const versionIds = new Set<string>();
    rows.forEach((v,i)=>{
      if(v.project_id!==id || v.parent_id!==(rows[i-1]?.id??null) || versionIds.has(v.id)) throw new StudioRepositoryError('invalid-response');
      versionIds.add(v.id);
    });
    if(dto.project.latest_version_id!==(rows.at(-1)?.id??null)) throw new StudioRepositoryError('invalid-response');
    const versions: Version[] = (structuredClone(dto.versions) as z.infer<typeof VersionRow>[]).map(v=>({id:v.id,parentId:v.parent_id,createdAt:v.created_at,brief:v.brief,scene:v.scene,sourceSnapshot:v.source_snapshot,placementIds:Object.keys(v.recipes) as Ratio[],placementSnapshot:Object.fromEntries(Object.entries(v.recipes).map(([k,r])=>[k,r.placement])),exports:{},reviews:{},approval:null,jobs:[]}));
    const jobIds = new Set<string>(), jobKeys = new Set<string>();
    for (const j of parse(z.array(JobRow), dto.jobs)) {
      const row = rows.find(v=>v.id===j.version_id);
      const key = `${j.version_id}:${j.placement_id}:${j.recipe_sha256}`;
      if (!row || row.recipes[j.placement_id]?.sha256!==j.recipe_sha256 || jobIds.has(j.id) || jobKeys.has(key)) throw new StudioRepositoryError('invalid-response');
      jobIds.add(j.id); jobKeys.add(key);
      versions.find(v=>v.id===j.version_id)!.jobs.push({id:j.id,versionId:j.version_id,ratio:j.placement_id,status:j.status,createdAt:j.created_at,...(j.error_code ? {error:'Render could not complete. Please retry.'} : {})});
    }
    const jobs = parse(z.array(JobRow), dto.jobs);
    const assetIds = new Set<string>(), assetJobs = new Set<string>(), keys = new Set<string>();
    for (const a of assets) {
      const j = jobs.find(j=>j.id===a.job_id);
      const placement = j && rows.find(v=>v.id===j.version_id)?.recipes[j.placement_id]?.placement;
      const parts = a.object_key.split('/');
      if (!j || j.status!=='complete' || j.attempts<1 || !placement || assetIds.has(a.id) || assetJobs.has(a.job_id) || keys.has(a.object_key)
        || parts.length!==7 || !Id.safeParse(parts[6]).success
        || parts.slice(0,6).join('/')!==['eicagency',actor.ownerId,id,j.version_id,j.placement_id,j.id].join('/')
        || a.width!==placement.width || a.height!==placement.height || a.mime_type!==placement.mimeType || a.size_bytes>placement.maxBytes
        || j.error_code!==(a.qa_passed?null:'qa_failed')) throw new StudioRepositoryError('invalid-response');
      assetIds.add(a.id); assetJobs.add(a.job_id); keys.add(a.object_key);
      const extension = a.mime_type==='image/png'?'png':'jpg';
      versions.find(v=>v.id===j.version_id)!.exports[j.placement_id] = {status:a.qa_passed?'complete':'failed',qaPassed:a.qa_passed,
        filename:`${a.id}.${extension}`,issues:a.qa_passed?[]:['Export failed quality checks.'],createdAt:a.finalized_at,
        mimeType:a.mime_type,extension,sizeBytes:a.size_bytes,width:a.width,height:a.height};
    }
    if (jobs.some(j=>j.status==='complete' && !assetJobs.has(j.id))) throw new StudioRepositoryError('invalid-response');
    const reviewed = new Set<string>();
    for (const r of reviews) {
      const a = assets.find(a=>a.id===r.asset_id);
      if (!a || reviewed.has(r.asset_id) || (r.approved && !a.qa_passed)) throw new StudioRepositoryError('invalid-response');
      reviewed.add(r.asset_id);
      const j = jobs.find(j=>j.id===a.job_id)!;
      versions.find(v=>v.id===j.version_id)!.reviews[j.placement_id] = r.approved;
    }
    const approved = dto.project.approved_version_id;
    if ((approved===null)!==(dto.project.approved_at===null)) throw new StudioRepositoryError('invalid-response');
    if (approved!==null) {
      const v = versions.at(-1);
      if (!v || v.id!==approved || !v.placementIds!.every(r=>v.exports[r]?.qaPassed===true && v.reviews[r]===true)) throw new StudioRepositoryError('invalid-response');
      // SQL approve() is owner-scoped by actor(); no reviewer identity is invented.
      v.approval = {userId:actor.ownerId,at:dto.project.approved_at!};
    }
    if ((!rows.length && !dto.directions.length) || (dto.directions.length>0 && !dto.project.planning_brief)) throw new StudioRepositoryError('invalid-response');
    const seen = new Set<string>();
    dto.directions.forEach((d, i) => {
      if (d.project_id !== id || d.created_by !== actor.ownerId || d.revision !== i + 1 || d.parent_id !== (dto.directions[i - 1]?.id ?? null) || seen.has(d.id) || d.brief.styleId !== d.style_snapshot.id) throw new StudioRepositoryError('invalid-response');
      seen.add(d.id);
    });
    if (dto.project.latest_direction_id !== (dto.directions.at(-1)?.id??null)) throw new StudioRepositoryError('invalid-response');
    // Validate stored snapshots without applying schema defaults/trim to immutable history.
    const stored = structuredClone(raw) as z.infer<typeof InternalRead>;
    const project: Project = { id, ownerId: actor.ownerId, tenantId: actor.tenantId, createdAt: dto.project.created_at, updatedAt: dto.project.updated_at, ...(stored.project.planning_brief===null?{}:{planningBrief:stored.project.planning_brief}), versions, directions: stored.directions.map(d => ({ id: d.id, revision: d.revision, createdBy: d.created_by, createdAt: d.created_at, brief: d.brief, styleSnapshot: d.style_snapshot })) };
    return { project, stored, rows, jobs, assets };
  }
  async function read(projectId: string): Promise<Project> { return (await readInternal(projectId)).project; }
  async function privatePlacement(projectId:string, versionId:string, placement:Ratio) {
    parse(Id,versionId,'invalid'); parse(RatioSchema,placement,'invalid');
    const data=await readInternal(projectId);
    const version=data.rows.find(v=>v.id===versionId);
    const recipe=version?.recipes[placement];
    if(!recipe) throw new StudioRepositoryError('invalid');
    const job=data.jobs.find(j=>j.version_id===versionId && j.placement_id===placement);
    const asset=job && data.assets.find(a=>a.job_id===job.id);
    return {recipe,asset,job};
  }
  async function write(args: StudioRpcArguments['save_direction']) {
    const receipt = parse(Receipt, await rpc('save_direction', args));
    if (args.p_project && receipt.project_id !== args.p_project) throw new StudioRepositoryError('invalid-response');
    const canonical = await read(receipt.project_id);
    if (!canonical.directions!.some(d => d.id === receipt.direction_id && d.revision === receipt.revision)) throw new StudioRepositoryError('invalid-response');
    return canonical;
  }
  return {
    read,
    // Trusted server only: never serialize this result in list/execute responses.
    privatePlacement,
    /** No automatic retry: reconcile the owner's list after an ambiguous commit. */
    async createVersion(input: z.input<typeof ArtworkCreate>) {
      parse(ArtworkCreate,input,'invalid');
      const c=structuredClone(input) as z.infer<typeof ArtworkCreate>;
      const receipt=parse(ArtworkReceipt,await rpc('create_artwork',{p_brief:c.brief,p_scene:c.scene,p_sources:c.sourceSnapshot,p_recipes:c.recipes}));
      const project=await read(receipt.project_id);
      if(!project.versions.some(v=>v.id===receipt.version_id)) throw new StudioRepositoryError('invalid-response');
      return project;
    },
    async review(projectId:string,versionId:string,placement:Ratio,approved:boolean) {
      parse(z.boolean(),approved,'invalid');
      const {asset}=await privatePlacement(projectId,versionId,placement);
      if(!asset || (approved && !asset.qa_passed)) throw new StudioRepositoryError('conflict');
      await rpc('review_asset',{p_project:projectId,p_expected:versionId,p_asset:asset.id,p_approved:approved});
      return read(projectId);
    },
    async approve(projectId:string,versionId:string) {
      parse(Id,projectId,'invalid');parse(Id,versionId,'invalid');
      await rpc('approve',{p_project:projectId,p_expected:versionId});
      return read(projectId);
    },
    /** Server-only input: persist already-built recipes, never regenerate historical HTML. */
    async saveVersion(input: z.input<typeof ArtworkSave>) {
      parse(ArtworkSave,input,'invalid');
      const c = structuredClone(input) as z.infer<typeof ArtworkSave>;
      await read(c.projectId);
      const versionId = parse(Id,await rpc('save_version',{p_project:c.projectId,p_expected:c.expectedVersionId,p_brief:c.brief,p_scene:c.scene,p_sources:c.sourceSnapshot,p_recipes:c.recipes}));
      const project = await read(c.projectId);
      if(!project.versions.some(v=>v.id===versionId)) throw new StudioRepositoryError('invalid-response');
      return project;
    },
    /** Idempotent queue receipt; read() projects canonical status without execution metadata. */
    async enqueue(input:{projectId:string;expectedVersionId:string;placement:Ratio}) {
      const c=parse(z.object({projectId:Id,expectedVersionId:Id,placement:RatioSchema}).strict(),input,'invalid');
      return {jobId:parse(Id,await rpc('enqueue',{p_project:c.projectId,p_expected:c.expectedVersionId,p_placement:c.placement}))};
    },
    async create(input: z.input<typeof Create>) {
      const c = parse(Create, input, 'invalid');
      return write({ p_project: null, p_expected: null, p_planning_brief: c.brief, p_direction: c.direction, p_style_snapshot: structuredClone(STYLES.find(s => s.id === c.direction.styleId)!) });
    },
    async save(input: z.input<typeof Save>) {
      const c = parse(Save, input, 'invalid');
      // Verify ownership and canonical history before appending a direction.
      await read(c.projectId);
      return write({ p_project: c.projectId, p_expected: c.expectedDirectionId, p_planning_brief: null, p_direction: c.direction, p_style_snapshot: structuredClone(STYLES.find(s => s.id === c.direction.styleId)!) });
    },
    /** Explicit bounded page. A full page always returns a cursor; fetch again until null. */
    async list(input: z.input<typeof PageInput> = {}): Promise<{ projects: StudioProjectSummary[]; nextCursor: StudioCursor | null; exhausted: boolean }> {
      const { limit, cursor } = parse(PageInput, input, 'invalid');
      const rows = parse(z.array(Row).max(limit), await rpc('list_projects', { p_limit: limit, p_after_created_at: cursor?.createdAt ?? null, p_after_id: cursor?.id ?? null }));
      const seen = new Set<string>();
      // PostgreSQL timestamptz retains microseconds; Date alone would lose cursor order.
      const instant = (value: string) => BigInt(Date.parse(value)) * BigInt(1000) + BigInt((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
      let previous = cursor;
      for (const row of rows) {
        owned(row);
        const current = { createdAt: row.created_at, id: row.id };
        if (seen.has(row.id) || (previous && (instant(current.createdAt) < instant(previous.createdAt) || (instant(current.createdAt) === instant(previous.createdAt) && current.id <= previous.id)))) throw new StudioRepositoryError('invalid-response');
        seen.add(row.id); previous = current;
      }
      const last = rows.at(-1);
      return { projects: rows.map(r => ({ id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, latestDirectionId: r.latest_direction_id, hasArtwork: r.latest_version_id !== null })), nextCursor: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null, exhausted: rows.length < limit };
    },
  };
}
