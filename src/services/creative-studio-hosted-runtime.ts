import type {Pool} from 'pg';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {StudioError} from './creative-studio.ts';
import {createHostedStudioService} from './creative-studio-hosted.ts';
import {createStudioPgTransport} from './creative-studio-pg-transport.ts';
import {createStudioWorkerPgTransport} from './creative-studio-worker-pg-transport.ts';
import {createStudioRenderWorker} from './creative-studio-render-worker.ts';
import {createStudioPrivateStorage,type StudioPrivateObjectTransport} from './creative-studio-private-storage.ts';
import type {VerifiedStudioContext} from './creative-studio-repository.ts';
const Config=z.object({enabled:z.boolean(),context:z.object({tenantId:z.literal('eicagency'),ownerId:z.string().uuid()}).strict()}).strict();
/** Server-only composition. Authentication/allowlisting must run before this factory.
 * There are intentionally no credential reads or default connection targets. Request
 * and worker pools require distinct approved least-privilege database roles. Not routed
 * or enabled by this module; default-off release configuration remains mandatory.
 */
export function createHostedStudioRuntime(input:{enabled:boolean;context:VerifiedStudioContext},dependencies:{repositoryPool:Pick<Pool,'connect'>;workerPool:Pick<Pool,'connect'>;storageClient:Pick<SupabaseClient,'storage'>}){
 const parsed=Config.safeParse(input);
 if(typeof window!=='undefined'||!parsed.success||!parsed.data.enabled)throw new StudioError('Hosted Creative Studio is disabled.',503);
 if(dependencies.repositoryPool===dependencies.workerPool)throw new StudioError('Separate Studio database capabilities required.',503);
 const actor=Object.freeze(parsed.data.context);
 const objects:StudioPrivateObjectTransport={
  async upload(bucket,key,bytes,options){return {error:(await dependencies.storageClient.storage.from(bucket).upload(key,bytes,options)).error};},
  async download(bucket,key){const result=await dependencies.storageClient.storage.from(bucket).download(key);return{data:result.data,error:result.error};},
 };
 const privateStorage=createStudioPrivateStorage(actor,objects);
 const worker=createStudioRenderWorker(createStudioWorkerPgTransport(dependencies.workerPool,actor),objects);
 return createHostedStudioService({context:actor,transport:createStudioPgTransport(dependencies.repositoryPool,actor),privateStorage,runRender:projectId=>worker.run(projectId)});
}
