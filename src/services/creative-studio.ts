import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DirectionSchema, STYLES } from '../lib/creative-studio/directions.ts';
import { BriefSchema, SceneSchema, RatioSchema, canApprove, validateSceneClaims, conceptPackCompatible } from '../lib/creative-studio/model.ts';
import { PLACEMENTS, getPack, getVersionPack, placementFor, type Placement } from '../lib/creative-studio/model.ts';
import { sourcesForConcept, SOURCE_WARNINGS } from '../lib/creative-studio/sources.ts';
import { loadRenderAssets, renderSceneHtml } from '../lib/creative-studio/render.ts';
import type { Project, Ratio, Scene, StudioState, Version, RenderJob } from '../lib/creative-studio/model.ts';

export type StudioIdentity = { userId: string; role: 'agency' | 'super_admin' | 'client' };
const Id = z.string().uuid();
const Identity = z.object({ userId: Id, role: z.enum(['agency', 'super_admin', 'client']) }).strict();
export const StudioInputSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create-direction'), brief: BriefSchema, direction: DirectionSchema }).strict(),
  z.object({ op: z.literal('save-direction'), projectId: Id, expectedDirectionId: Id.nullable(), direction: DirectionSchema }).strict(),
  z.object({ op: z.literal('create'), brief: BriefSchema, scene: SceneSchema }).strict(),
  z.object({ op: z.literal('revise'), projectId: Id, expectedVersionId: Id.nullable(), brief: BriefSchema, scene: SceneSchema }).strict(),
  z.object({ op: z.literal('render'), projectId: Id, versionId: Id, ratio: RatioSchema }).strict(),
  z.object({ op: z.literal('review'), projectId: Id, versionId: Id, ratio: RatioSchema, approved: z.boolean() }).strict(),
  z.object({ op: z.literal('approve'), projectId: Id, versionId: Id }).strict(),
]);
export class StudioError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'StudioError'; this.status = status; }
}
export function assertLocalReviewEnabled() {
  if (process.env.CREATIVE_STUDIO_LOCAL_REVIEW !== '1' || process.env.NODE_ENV === 'production' || process.env.VERCEL !== undefined) {
    throw new StudioError('Creative Studio local review is disabled.', 404);
  }
}
// Single-process LOCAL store only: the process-wide queue covers all instances and
// holds the lock across rendering. Not suitable for multi-process/serverless use.
const queues = new Map<string, Promise<unknown>>();
async function locked<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}
async function atomicWrite(filename: string, data: string | Buffer) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  try { await writeFile(temp, data, { mode: 0o600, flag: 'wx' }); await rename(temp, filename); }
  finally { await rm(temp, { force: true }); }
}
function within(root: string, target: string) { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }
export function createStudioService({ dataDir, render }: {
  dataDir: string;
  render: (scene: Scene, ratio: Ratio, savedHtml?: string, savedPlacement?: Placement) => Promise<{ png: Buffer; issues: string[]; qaPassed: boolean }>;
}) {
  if (!dataDir || !path.isAbsolute(dataDir)) throw new StudioError('An absolute external local data directory is required.', 503);
  async function directory() {
    assertLocalReviewEnabled();
    const repository = await realpath(process.cwd());
    if (within(repository, path.resolve(dataDir))) throw new StudioError('Local data must be outside the repository.', 503);
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const resolved = await realpath(dataDir);
    if (within(repository, resolved)) throw new StudioError('Local data must be outside the repository.', 503);
    return resolved;
  }
  async function transaction<T>(identity: StudioIdentity, work: (state: StudioState, dir: string, save: () => Promise<void>) => Promise<T>) {
    Identity.parse(identity);
    const dir = await directory();
    return locked(dir, async () => {
      assertLocalReviewEnabled();
      const filename = path.join(dir, `${identity.userId}.json`);
      let state: StudioState = { mode: 'local-review', projects: [] };
      try { state = JSON.parse(await readFile(filename, 'utf8')) as StudioState; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (state.mode !== 'local-review' || !Array.isArray(state.projects) || state.projects.some(p => p.ownerId !== identity.userId || p.tenantId !== 'eicagency')) throw new StudioError('Invalid local store.', 500);
      const save = () => atomicWrite(filename, JSON.stringify(state, null, 2));
      // Re-run interrupted, nonpaid Chromium work on first owner access after restart.
      for (const project of state.projects) for (const version of project.versions) {
        BriefSchema.parse(version.brief); // Validate without changing immutable legacy briefs.
        if(version !== project.versions.at(-1)) continue;
        for (const job of version.jobs.filter(j => j.status === 'running')) await run(project, version, job.ratio, dir, save, job);
      }
      return work(state, dir, save);
    });
  }
  function projectFor(state: StudioState, projectId: string) {
    Id.parse(projectId);
    const project = state.projects.find(p => p.id === projectId);
    if (!project) throw new StudioError('Project not found.', 404);
    return project;
  }
  function versionFor(project: Project, versionId: string) {
    Id.parse(versionId);
    const version = project.versions.find(v => v.id === versionId);
    if (!version) throw new StudioError('Version not found.', 404);
    return version;
  }
  function assetName(project: Project, version: Version, ratio: Ratio) {
    Id.parse(project.id); Id.parse(version.id); RatioSchema.parse(ratio);
    return `${project.ownerId}-${project.id}-${version.id}-${ratio.replace(':', 'x')}.${placementFor(version,ratio).extension}`;
  }
  async function run(project: Project, version: Version, ratio: Ratio, dir: string, save: () => Promise<void>, interrupted?: RenderJob) {
    if(!getVersionPack(version).placements.includes(ratio)) throw new StudioError('Placement is outside the selected pack.');
    if ((version.brief.stage !== 'Action' && !['founder-note','editable-note-v2','benefit-comparison-v2'].includes(version.scene.template)) || validateSceneClaims(version.scene).length) throw new StudioError('This concept requires validated Action creative; Founder Note also supports other planning stages.');
    if (!interrupted && version.exports[ratio]?.status === 'complete') return;
    const job: RenderJob = interrupted ?? { id: randomUUID(), versionId: version.id, ratio, status: 'running', provider: 'chromium', costUsd: 0, startedAt: new Date().toISOString() };
    if (!interrupted) version.jobs.push(job);
    version.approval = null;
    delete version.reviews[ratio];
    await save(); // durable intent BEFORE renderer invocation
    try {
      const savedHtml = await readFile(path.join(dir, assetName(project, version, ratio).replace(/\.(?:png|jpg)$/, '.html')), 'utf8');
      const result = await render(structuredClone(version.scene), ratio, savedHtml, structuredClone(placementFor(version,ratio)));
      if (!Buffer.isBuffer(result.png) || !result.png.length) throw new Error('Renderer returned no encoded image.');
      const p=placementFor(version,ratio);
      if(result.png.length>p.maxBytes) throw new Error('Asset exceeds placement byte limit.');
      const filename = assetName(project, version, ratio);
      await atomicWrite(path.join(dir, filename), result.png);
      version.exports[ratio] = { status: 'complete', qaPassed: result.qaPassed, issues: result.issues, filename, createdAt: new Date().toISOString(),mimeType:p.mimeType,extension:p.extension,sizeBytes:result.png.length,width:p.width,height:p.height };
      job.status = 'complete';
    } catch {
      // Do not persist filesystem paths, provider details or secrets from exceptions.
      job.status = 'failed'; job.error = 'Local render failed. Retry the render.';
      version.exports[ratio] = { status: 'failed', qaPassed: false, issues: [job.error], createdAt: new Date().toISOString() };
    }
    job.finishedAt = new Date().toISOString(); project.updatedAt = job.finishedAt;
    await save();
  }
  function newVersion(brief: z.infer<typeof BriefSchema>, scene: Scene, parentId: string | null): Version {
    if (!conceptPackCompatible(scene,brief)) throw new StudioError('Selected concept requires the Meta feed concepts pack (square and portrait only).');
    if (brief.stage !== 'Action' && !['founder-note','editable-note-v2','benefit-comparison-v2'].includes(scene.template)) throw new StudioError('This concept supports Action only. Founder Note also supports other planning stages.');
    const issues = validateSceneClaims(scene);
    if (issues.length) throw new StudioError(issues.join(' '));
    if(['one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'].includes(scene.template)) brief = {...brief,sourceIds:brief.sourceIds.map(id=>['launch-tracker','one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'].includes(id)?scene.template as 'one-client-math'|'agency-owner-text-thread'|'founder-note'|'same-client-two-replies'|'build-or-partner-note':id)};
    const placementIds=[...getPack(brief).placements];
    const placementSnapshot=Object.fromEntries(placementIds.map(r=>[r,structuredClone(PLACEMENTS[r])]));
    return { placementIds, placementSnapshot, sourceSnapshot: { sources: structuredClone(sourcesForConcept(scene.template)), warnings: [...SOURCE_WARNINGS] }, id: randomUUID(), parentId, createdAt: new Date().toISOString(), brief, scene, exports: {}, reviews: {}, approval: null, jobs: [] };
  }
  return {
    async list(identity: StudioIdentity): Promise<StudioState> { return transaction(identity, async state => structuredClone(state)); },
    async execute(identity: StudioIdentity, input: unknown): Promise<Project> {
      const command = StudioInputSchema.parse(input);
      return transaction(identity, async (state, dir, save) => {
        let project: Project;
        if (command.op === 'create-direction') {
          const now = new Date().toISOString();
          project = { id: randomUUID(), tenantId: 'eicagency', ownerId: identity.userId, createdAt: now, updatedAt: now, planningBrief: command.brief, versions: [], directions: [{id:randomUUID(),revision:1,createdAt:now,createdBy:identity.userId,brief:command.direction,styleSnapshot:structuredClone(STYLES.find(s=>s.id===command.direction.styleId)!)}] };
          state.projects.push(project);
        } else if (command.op === 'create') {
          const version = newVersion(command.brief, command.scene, null);
          project = { id: randomUUID(), tenantId: 'eicagency', ownerId: identity.userId, createdAt: version.createdAt, updatedAt: version.createdAt, versions: [version] };
          state.projects.push(project);
        } else {
          project = projectFor(state, command.projectId);
          if (command.op === 'save-direction') {
            if ((project.directions?.at(-1)?.id ?? null) !== command.expectedDirectionId) throw new StudioError('Direction changed. Reload before saving.', 409);
            const style = STYLES.find(s => s.id === command.direction.styleId)!;
            project.directions ??= [];
            project.directions.push({ id: randomUUID(), revision: project.directions.length + 1, createdAt: new Date().toISOString(), createdBy: identity.userId, brief: command.direction, styleSnapshot: structuredClone(style) });
            project.updatedAt = new Date().toISOString();
            await save();
            return structuredClone(project);
          }
          const latest = project.versions.at(-1);
          const requested = command.op === 'revise' ? command.expectedVersionId : command.versionId;
          if (requested !== (latest?.id ?? null)) throw new StudioError('Version changed. Reload before editing or approving.', 409);
          if (command.op === 'revise') project.versions.push(newVersion(command.brief, command.scene, latest?.id ?? null));
          else if (!latest) throw new StudioError('Compose artwork before exporting or approving.', 409);
          else if (command.op === 'render') await run(project, latest, command.ratio, dir, save);
          else if (command.op === 'review') {
            if(!getVersionPack(latest).placements.includes(command.ratio)) throw new StudioError('Placement is outside the selected pack.');
            const exported = latest.exports[command.ratio];
            if (command.approved && (exported?.status !== 'complete' || !exported.qaPassed)) throw new StudioError('Render and pass QA before human review.', 409);
            latest.reviews[command.ratio] = command.approved;
            latest.approval = null;
          } else {
            if (!canApprove(latest.exports, latest.reviews, getVersionPack(latest).placements) || latest.jobs.some(j => j.status === 'running')) throw new StudioError('Every placement requires a QA-passing export and explicit human review.', 409);
            // LOCAL DESIGN REVIEW ONLY. Never release/launch authorization.
            latest.approval = { userId: identity.userId, at: new Date().toISOString() };
          }
        }
        if (command.op === 'create' || command.op === 'revise') {
          const version = project.versions.at(-1)!;
          const assets = await loadRenderAssets();
          for (const ratio of getVersionPack(version).placements) {
            const html = renderSceneHtml(version.scene, ratio, assets);
            await atomicWrite(path.join(dir, assetName(project, version, ratio).replace(/\.(?:png|jpg)$/, '.html')), html);
          }
        }
        project.updatedAt = new Date().toISOString();
        await save();
        return structuredClone(project);
      });
    },
    async readPreview(identity: StudioIdentity, projectId: string, versionId: string, ratio: Ratio): Promise<string> {
      Id.parse(projectId); Id.parse(versionId); RatioSchema.parse(ratio);
      return transaction(identity, async (state, dir) => {
        const project = projectFor(state, projectId); const version = versionFor(project, versionId);
        try { return await readFile(path.join(dir, assetName(project, version, ratio).replace(/\.(?:png|jpg)$/, '.html')), 'utf8'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new StudioError('Saved render recipe is missing. Save a new version before rendering.', 409); throw error; }
      });
    },
    async readPlacement(identity: StudioIdentity, projectId:string,versionId:string,ratio:Ratio):Promise<Placement> {
      RatioSchema.parse(ratio);
      return transaction(identity,async state=>structuredClone(placementFor(versionFor(projectFor(state,projectId),versionId),ratio)));
    },
    async readAsset(identity: StudioIdentity, projectId: string, versionId: string, ratio: Ratio): Promise<Buffer> {
      Id.parse(projectId); Id.parse(versionId); RatioSchema.parse(ratio);
      return transaction(identity, async (state, dir) => {
        const project = projectFor(state, projectId); const version = versionFor(project, versionId);
        if (version.exports[ratio]?.status !== 'complete') throw new StudioError('Export not found.', 404);
        try { return await readFile(path.join(dir, assetName(project, version, ratio))); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new StudioError('Export not found.', 404); throw error; }
      });
    },
  };
}
