import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SceneSchema,RatioSchema } from '../lib/creative-studio/model.ts';
import { renderPng } from '../lib/creative-studio/render.ts';
import { createStudioPrivateStorage,type StudioPrivateObjectTransport } from './creative-studio-private-storage.ts';
import type { StudioWorkerTransport } from './creative-studio-worker-pg-transport.ts';
const Id=z.string().uuid();
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
const Placement=z.object({width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),insetX:z.number().nonnegative(),insetY:z.number().nonnegative(),name:z.string(),family:z.enum(['meta','google-image','logo','banner']),mimeType:z.literal('image/png'),extension:z.literal('png'),maxBytes:z.number().int().positive()}).strict();
const Recipe=z.object({html:z.string().min(1).max(16777216),sha256:Hash,placement:Placement}).strict();
const Job=z.object({id:Id,version_id:Id,placement_id:RatioSchema,recipe_sha256:Hash,status:z.literal('running'),attempts:z.number().int().min(1).max(3),lease_token:Id,lease_expires_at:z.string().datetime({offset:true}),error_code:z.null(),created_at:z.string()}).strict();
/** One bounded job per invocation. No timers, production defaults, HTTP entrypoint or provider calls. */
export function createStudioRenderWorker(db:StudioWorkerTransport,objects:StudioPrivateObjectTransport){
 const storage=createStudioPrivateStorage(db.context,objects);
 return Object.freeze({async run(projectId:string){
  Id.parse(projectId);
  const raw=await db.claim(projectId);if(raw===null)return null;
  const job=Job.parse(raw);
  let result;
  try{
   const dto=z.object({project:z.object({id:Id,owner_id:Id,tenant_id:z.literal('eicagency')}),versions:z.array(z.object({id:Id,project_id:Id,scene:SceneSchema,recipes:z.record(z.string(),z.unknown())}))}).parse(await db.read(projectId));
   if(dto.project.id!==projectId||dto.project.owner_id!==db.context.ownerId)throw new Error('Worker scope mismatch');
   const version=dto.versions.find(v=>v.id===job.version_id&&v.project_id===projectId);if(!version)throw new Error('Worker version mismatch');
   const recipe=Recipe.parse(version.recipes[job.placement_id]);
   if(recipe.sha256!==job.recipe_sha256||createHash('sha256').update(recipe.html,'utf8').digest('hex')!==recipe.sha256)throw new Error('Worker recipe integrity');
   const remaining=Date.parse(job.lease_expires_at)-Date.now()-10000;
   if(remaining<1000)throw new Error('Worker lease too short');
   const rendered=await renderPng(version.scene,job.placement_id,recipe.html,recipe.placement,Math.min(30000,remaining));
   if(rendered.mimeType!=='image/png'||rendered.extension!=='png'||rendered.sizeBytes>recipe.placement.maxBytes)throw new Error('Worker PNG required');
   const metadata={sha256:createHash('sha256').update(rendered.png).digest('hex'),sizeBytes:rendered.png.length,width:rendered.width,height:rendered.height,mimeType:'image/png' as const};
   const locator={ownerId:db.context.ownerId,projectId,versionId:job.version_id,placementId:job.placement_id,jobId:job.id,leaseToken:job.lease_token};
   await storage.upload(locator,rendered.png,metadata);
   await storage.download(locator,metadata);
   result={...metadata,qaPassed:rendered.qaPassed};
  }catch(error){
   // Bounded server-only diagnostics; never log recipes, credentials, or object data.
   const reason = error instanceof Error ? error.message.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/g, '[redacted-url]').slice(0, 400) : 'Unknown rendering error';
   console.error('[Creative Builder] Render failed:', reason);
   // Failure finalization errors (especially stale leases) must remain visible.
   try{await db.finish(job.id,job.lease_token,null);}catch(finishError){throw new AggregateError([error,finishError],'Worker failure finalization failed');}
   throw error;
  }
  // Never turn an ambiguous successful-finish response into a retry or false success.
  const assetId=await db.finish(job.id,job.lease_token,result);
  return {assetId,jobId:job.id,...result};
 }});
}
