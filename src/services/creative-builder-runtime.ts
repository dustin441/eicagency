import {Pool} from 'pg';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {creativeBuilderServerConfig} from './creative-builder-server-config.ts';
import {createCreativeBuilderPgTransport} from './creative-builder-pg-transport.ts';
import {createCreativeBuilderRepository,type TrustedCreativeBuilderRpcTransport,type VerifiedCreativeBuilderContext} from './creative-builder-repository.ts';
import {createCreativeBuilderWorker} from './creative-builder-worker.ts';
import {createCreativeBuilderServer,type CreativeBuilderCommitFence} from './creative-builder-server.ts';
import {createProductionCreativeBuilderAi} from './creative-builder-ai.ts';
import {scanCreativeBuilderLandingPage} from './creative-builder-page-scan.ts';
import {createCreativeBuilderSourceStorage,type CreativeBuilderImageCanonicalResolver,type CreativeBuilderPrivateObjectProvider} from './creative-builder-source-storage.ts';
import {createStudioPgTransport} from './creative-studio-pg-transport.ts';
import {studioServerConfig} from './creative-studio-server-config.ts';
import {createBuilderStudioHandoffService,type CanonicalBuilderHandoff} from './creative-builder-studio-handoff.ts';
import {createBuilderStudioTransferStore,createIdempotentStudioHandoffStore} from './creative-builder-studio-persistence.ts';
import type {LandingPageReceipt} from '../lib/creative-studio/strategy.ts';

const Resolution=z.object({sourceUrl:z.string().url(),target:z.object({objectKey:z.string(),jobId:z.string().uuid(),fencingGeneration:z.number().int().positive()}).strict(),finalized:z.object({assetId:z.string().uuid(),receipt:z.object({sha256:z.string(),mimeType:z.literal('image/webp'),width:z.number(),height:z.number(),sizeBytes:z.number()}).strict()}).strict().optional()}).strict();
const Located=z.object({objectKey:z.string(),sha256:z.string(),mimeType:z.literal('image/webp'),width:z.number(),height:z.number(),sizeBytes:z.number()}).strict();
async function rpc(transport:TrustedCreativeBuilderRpcTransport,name:Parameters<TrustedCreativeBuilderRpcTransport['invoke']>[1],args:never){const response=await transport.invoke('creative_builder',name,args);if(response.error)throw new Error('Creative Builder persistence unavailable');return response.data;}

export function createCreativeBuilderRuntime(env:Record<string,string|undefined>,context:VerifiedCreativeBuilderContext){
 const config=creativeBuilderServerConfig(env);
 const studioConfig=studioServerConfig(env);
 const repositoryPool=new Pool(config.repository),workerPool=new Pool(config.worker),studioRepositoryPool=new Pool(studioConfig.repository);
 const repositoryTransport=createCreativeBuilderPgTransport(repositoryPool,context,'repository');
 const workerTransport=createCreativeBuilderPgTransport(workerPool,context,'worker');
 const repository=createCreativeBuilderRepository(context,repositoryTransport,workerTransport);
 const worker=createCreativeBuilderWorker(workerTransport);
 const supabase=createSupabaseClient(config.storageUrl,config.storageKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const objects:CreativeBuilderPrivateObjectProvider={
  async putCreateOnly(bucket,key,bytes,options){const {error}=await supabase.storage.from(bucket).upload(key,bytes,{contentType:options.contentType,cacheControl:'0',upsert:false});if(!error)return 'created';if((error as {statusCode?:string|number}).statusCode===409||/exist|duplicate/i.test(error.message))return 'exists';throw new Error('storage unavailable');},
  async get(bucket,key){const {data,error}=await supabase.storage.from(bucket).download(key);if(error||!data)return null;return {bytes:new Uint8Array(await data.arrayBuffer()),contentType:data.type||'image/webp'};},
  async remove(bucket,key){const existing=await this.get(bucket,key);if(!existing)return 'not-found';const {error}=await supabase.storage.from(bucket).remove([key]);if(error)throw new Error('storage unavailable');return 'removed';},
 };
 const persistentAi=createProductionCreativeBuilderAi(repository.canonicalLoader);
 function resolver(f?:CreativeBuilderCommitFence):CreativeBuilderImageCanonicalResolver{return {
  context,
  async resolveCandidate(input){if(!f||input.purpose!=='import')throw new Error('candidate unavailable');return Resolution.parse(await rpc(workerTransport,'resolve_import_candidate',{p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_expected_revision:f.expectedProjectRevision,p_scan:input.scanId,p_candidate_id:input.candidateId} as never));},
  async finalizePreview(){throw new Error('preview finalization unavailable');},
  async finalizeImport(input){if(!f)throw new Error('import unavailable');await worker.transition(f,'committing');const result=z.object({asset_id:z.string().uuid()}).passthrough().parse(await rpc(workerTransport,'import_asset_receipt',{p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_expected_revision:f.expectedProjectRevision,p_scan:input.scanId,p_candidate_id:input.candidateId,p_object_key:input.target.objectKey,p_sha256:input.receipt.sha256,p_mime:input.receipt.mimeType,p_width:input.receipt.width,p_height:input.receipt.height,p_bytes:input.receipt.sizeBytes} as never));return {assetId:result.asset_id,receipt:input.receipt};},
  async resolvePreview(input){return Located.parse(await rpc(workerTransport,'resolve_private_image',{p_project:input.projectId,p_scan:input.scanId,p_candidate_id:input.candidateId,p_asset:null} as never));},
  async resolveAsset(input){return Located.parse(await rpc(workerTransport,'resolve_private_image',{p_project:input.projectId,p_scan:null,p_candidate_id:null,p_asset:input.assetId} as never));},
  async resolveExpiredImport(){return null;},
 };}
 const sources={
  async preparePreviews(input:{fence:CreativeBuilderCommitFence;receipt:LandingPageReceipt}){
   const previews:unknown[]=[];
   for(const candidate of input.receipt.assets){
    if(previews.length>=8)break;
    const target={objectKey:`eicagency/${context.ownerId}/${input.fence.projectId}/${input.fence.jobId}/${input.fence.fencingGeneration}/previews/${candidate.id}.webp`,jobId:input.fence.jobId,fencingGeneration:input.fence.fencingGeneration};
    await rpc(workerTransport,'register_preview_upload',{p_job:input.fence.jobId,p_token:input.fence.leaseToken,p_generation:input.fence.fencingGeneration,p_project:input.fence.projectId,p_expected_revision:input.fence.expectedProjectRevision,p_scan:input.receipt.id,p_candidate_id:candidate.id,p_object_key:target.objectKey} as never);
    const canonical:CreativeBuilderImageCanonicalResolver={context,
     async resolveCandidate(value){if(value.purpose!=='preview'||value.scanId!==input.receipt.id||value.candidateId!==candidate.id)throw new Error('candidate unavailable');return {sourceUrl:candidate.sourceUrl,target};},
     async finalizePreview(value){return value.receipt;},
     async finalizeImport(){throw new Error('import unavailable');},async resolvePreview(){throw new Error('preview unavailable');},async resolveAsset(){throw new Error('asset unavailable');},async resolveExpiredImport(){return null;},
    };
    try{
     const receipt=await createCreativeBuilderSourceStorage(context,{objects,canonical}).createCandidatePreview({projectId:input.fence.projectId,scanId:input.receipt.id,candidateId:candidate.id});
     previews.push({candidate_id:candidate.id,object_key:target.objectKey,sha256:receipt.sha256,mime_type:receipt.mimeType,width:receipt.width,height:receipt.height,size_bytes:receipt.sizeBytes});
    }catch{/* A broken or blocked page image must not prevent the source-backed plan. */}
   }
   return previews;
  },
  async import(input:{fence:CreativeBuilderCommitFence;scanId:string;candidateId:string}){return createCreativeBuilderSourceStorage(context,{objects,canonical:resolver(input.fence)}).importSourceAsset({projectId:input.fence.projectId,scanId:input.scanId,candidateId:input.candidateId});},
 };
 const ai={
  async analyze(input:{projectId:string;scanId:string;planRevisionId:string;claimIds:string[];receipt:LandingPageReceipt}){const ephemeral=createProductionCreativeBuilderAi({loadForAnalysis:async()=>input.receipt,loadForGeneration:repository.canonicalLoader.loadForGeneration,loadForRevision:repository.canonicalLoader.loadForRevision});const result=await ephemeral.analyze(input);return {assumptions:result.assumptions,channels:result.channels,assistantMessage:'Created the initial source-grounded plan.'};},
  generate: persistentAi.generate,
  revise: persistentAi.revise,
 };
 const readStorage=createCreativeBuilderSourceStorage(context,{objects,canonical:resolver()});
 const handoff=createBuilderStudioHandoffService({
  loader:{async load(input){const canonical=await repository.canonicalLoader.loadForHandoff(input);const assetReceipts=[];for(const asset of canonical.assetReceipts){const image=await readStorage.readSourceAsset({projectId:input.projectId,assetId:asset.id});assetReceipts.push({...asset,bytes:new Uint8Array(image.bytes)});}return {...canonical,assetReceipts} as CanonicalBuilderHandoff;}},
  transfers:createBuilderStudioTransferStore(workerTransport),
  studio:createIdempotentStudioHandoffStore(createStudioPgTransport(studioRepositoryPool,context)),
 });
 const server=createCreativeBuilderServer({repository,worker,ai,sources,handoff,scan:(url,scanId)=>scanCreativeBuilderLandingPage(url,{receiptId:scanId})});
 return Object.freeze({server,readImage:async(input:{projectId:string;scanId?:string;candidateId?:string;assetId?:string})=>input.assetId?readStorage.readSourceAsset({projectId:input.projectId,assetId:input.assetId}):readStorage.readCandidatePreview({projectId:input.projectId,scanId:input.scanId!,candidateId:input.candidateId!}),close:async()=>{await Promise.allSettled([repositoryPool.end(),workerPool.end(),studioRepositoryPool.end()]);}});
}
