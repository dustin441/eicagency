import { createHash } from 'node:crypto';
import { z } from 'zod';
import { StudioError, StudioInputSchema, type StudioIdentity, type createStudioService } from './creative-studio.ts';
import { createStudioRepository, StudioRepositoryError, type TrustedStudioRpcTransport, type VerifiedStudioContext, type StudioCursor } from './creative-studio-repository.ts';
import { StudioStorageError, type createStudioPrivateStorage } from './creative-studio-private-storage.ts';
import { PLACEMENTS, getPack, getVersionPack, conceptPackCompatible, validateSceneClaims, canApprove, type Project } from '../lib/creative-studio/model.ts';
import { loadRenderAssets, renderSceneHtml } from '../lib/creative-studio/render.ts';
import { sourcesForConcept, SOURCE_WARNINGS } from '../lib/creative-studio/sources.ts';

/** Not registered in the API factory. Context must come from verified server authorization. */
export function createHostedStudioService(options: {
  context: VerifiedStudioContext;
  transport: TrustedStudioRpcTransport;
  privateStorage: Pick<ReturnType<typeof createStudioPrivateStorage>, 'download'>;
  runRender: (projectId: string) => Promise<unknown>;
}): ReturnType<typeof createStudioService> {
  const actor = Object.freeze({...options.context});
  const repo = createStudioRepository(actor, options.transport);
  async function guarded<T>(identity: StudioIdentity, work: () => Promise<T>): Promise<T> {
    if (!z.object({userId:z.string().uuid(),role:z.enum(['agency','super_admin','client'])}).strict().safeParse(identity).success || identity.userId !== actor.ownerId) throw new StudioError('Studio access denied.',403);
    try { return await work(); }
    catch (e) {
      if(e instanceof StudioError) throw e;
      if(e instanceof z.ZodError) throw new StudioError('Invalid Studio input.',400);
      if(e instanceof StudioRepositoryError) throw new StudioError('Studio request could not complete.',({invalid:400,denied:403,conflict:409,unavailable:503,'invalid-response':502,unsupported:501})[e.code]);
      if(e instanceof StudioStorageError) throw new StudioError('Private export unavailable.',e.code==='denied'?403:502);
      throw new StudioError('Studio temporarily unavailable.',503);
    }
  }
  return {
    list(identity) { return guarded(identity,async()=>{
      const projects: Project[]=[]; const seen=new Set<string>(); let cursor:StudioCursor|null=null;
      for(let page=0;page<100;page++) {
        const result=await repo.list({limit:100,cursor});
        for(const p of result.projects) { if(seen.has(p.id)) throw new StudioError('Studio pagination changed. Retry.',409); seen.add(p.id); projects.push(await repo.read(p.id)); }
        if(result.exhausted) return {mode:'hosted-private-beta' as const,projects};
        cursor=result.nextCursor;
        if(!cursor) throw new StudioError('Incomplete Studio page.',502);
      }
      throw new StudioError('Studio project limit exceeded; no partial list returned.',503);
    }); },
    execute(identity,input) { return guarded(identity,async()=>{
      const c=StudioInputSchema.parse(input);
      if(c.op==='create-direction') return repo.create({brief:c.brief,direction:c.direction});
      if(c.op==='save-direction') return repo.save({projectId:c.projectId,expectedDirectionId:c.expectedDirectionId,direction:c.direction});
      if(c.op==='revise') {
        const project=await repo.read(c.projectId);
        if(c.expectedVersionId!==(project.versions.at(-1)?.id??null)) throw new StudioError('Version changed. Reload before editing or approving.',409);
      }
      if(c.op==='create'||c.op==='revise') {
        let brief=c.brief; const scene=c.scene;
        if(!conceptPackCompatible(scene,brief)) throw new StudioError('Selected concept requires the Meta feed concepts pack.');
        if(brief.stage!=='Action' && !['founder-note','editable-note-v2','benefit-comparison-v2'].includes(scene.template)) throw new StudioError('This concept supports Action only.');
        const issues=validateSceneClaims(scene);if(issues.length) throw new StudioError(issues.join(' '));
        const concepts=['one-client-math','agency-owner-text-thread','founder-note','same-client-two-replies','build-or-partner-note'];
        if(concepts.includes(scene.template)) brief={...brief,sourceIds:brief.sourceIds.map(id=>['launch-tracker',...concepts].includes(id)?scene.template as typeof id:id)};
        const assets=await loadRenderAssets();
        const recipes=Object.fromEntries(getPack(brief).placements.map(r=>{const html=renderSceneHtml(scene,r,assets);return [r,{html,sha256:createHash('sha256').update(html,'utf8').digest('hex'),placement:structuredClone(PLACEMENTS[r])}];}));
        const artwork={brief,scene,sourceSnapshot:{sources:[...structuredClone(sourcesForConcept(scene.template))],warnings:[...SOURCE_WARNINGS]},recipes};
        return c.op==='create' ? repo.createVersion(artwork) : repo.saveVersion({...artwork,projectId:c.projectId,expectedVersionId:c.expectedVersionId});
      }
      const project=await repo.read(c.projectId); const latest=project.versions.at(-1);
      if(c.versionId!==(latest?.id??null)) throw new StudioError('Version changed. Reload before editing or approving.',409);
      if(!latest) throw new StudioError('Compose artwork first.',409);
      if(c.op==='approve') {
        if(!canApprove(latest.exports,latest.reviews,getVersionPack(latest).placements)||latest.jobs.some(j=>j.status==='queued'||j.status==='running')) throw new StudioError('Every placement requires QA and human review.',409);
        return repo.approve(c.projectId,c.versionId);
      }
      if(!getVersionPack(latest).placements.includes(c.ratio)) throw new StudioError('Placement is outside the selected pack.');
      if(c.op==='review') return repo.review(c.projectId,c.versionId,c.ratio,c.approved);
      if(latest.exports[c.ratio]?.status==='complete') return project;
      if((latest.brief.stage!=='Action'&&!['founder-note','editable-note-v2','benefit-comparison-v2'].includes(latest.scene.template))||validateSceneClaims(latest.scene).length) throw new StudioError('This concept is not renderable.');
      const receipt=await repo.enqueue({projectId:c.projectId,expectedVersionId:c.versionId,placement:c.ratio});
      await options.runRender(c.projectId);
      const canonical=await repo.read(c.projectId);
      const job=canonical.versions.find(v=>v.id===c.versionId)?.jobs.find(j=>j.id===receipt.jobId);
      if(!job||job.status==='queued'||job.status==='running') throw new StudioError('Render is still pending. Reload before retrying.',409);
      return canonical;
    }); },
    readPreview(identity,projectId,versionId,ratio) { return guarded(identity,async()=>(await repo.privatePlacement(projectId,versionId,ratio)).recipe.html); },
    readPlacement(identity,projectId,versionId,ratio) { return guarded(identity,async()=>structuredClone((await repo.privatePlacement(projectId,versionId,ratio)).recipe.placement)); },
    readAsset(identity,projectId,versionId,ratio) { return guarded(identity,async()=>{
      const {asset}=await repo.privatePlacement(projectId,versionId,ratio);
      if(!asset||!asset.qa_passed) throw new StudioError('Export not found.',404);
      if(asset.mime_type!=='image/png') throw new StudioError('This private export format is not enabled.',501);
      // Repository validated all seven exact key segments against the owner/project/job.
      const parts=asset.object_key.split('/');
      return options.privateStorage.download({ownerId:actor.ownerId,projectId,versionId,placementId:ratio,jobId:parts[5],leaseToken:parts[6]}, {sha256:asset.sha256,sizeBytes:asset.size_bytes,width:asset.width,height:asset.height,mimeType:asset.mime_type});
    }); },
  };
}
