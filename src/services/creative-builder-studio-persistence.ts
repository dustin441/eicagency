import {z} from 'zod';
import type {TrustedCreativeBuilderRpcTransport} from './creative-builder-repository.ts';
import type {TrustedStudioRpcTransport} from './creative-studio-repository.ts';
import {AmbiguousHandoffWriteError,BuilderStudioHandoffError,type DurableBuilderStudioTransferStore,type IdempotentStudioHandoffStore,type StudioHandoffRecord,type TransferRecord} from './creative-builder-studio-handoff.ts';

const Id=z.string().uuid(),Hash=z.string().regex(/^[a-f0-9]{64}$/);
const Transfer=z.object({handoff_key:Hash,artifact_sha256:Hash,builder_project_id:Id,selection_id:Id,selection_content_sha256:Hash,studio_project_id:Id.nullable(),studio_version_id:Id.nullable()}).strict();
const Studio=z.object({handoff_key:Hash,artifact_sha256:Hash,project_id:Id,version_id:Id}).strict();
const transfer=(value:unknown):TransferRecord=>{const row=Transfer.parse(value);return {handoffKey:row.handoff_key,artifactSha256:row.artifact_sha256,builderProjectId:row.builder_project_id,selectionId:row.selection_id,selectionContentSha256:row.selection_content_sha256,studioProjectId:row.studio_project_id,studioVersionId:row.studio_version_id};};
const studio=(value:unknown):StudioHandoffRecord=>{const row=Studio.parse(value);return {handoffKey:row.handoff_key,artifactSha256:row.artifact_sha256,projectId:row.project_id,versionId:row.version_id};};
function failed(error:{code?:string}|null):never{if(!error?.code)throw new AmbiguousHandoffWriteError();throw new BuilderStudioHandoffError(error.code==='40001'||error.code==='55000'?'conflict':error.code==='22023'?'invalid':'unavailable');}

export function createBuilderStudioTransferStore(transport:TrustedCreativeBuilderRpcTransport):DurableBuilderStudioTransferStore {
 const invoke=async(name:'reserve_studio_handoff'|'read_studio_handoff'|'link_studio_handoff',args:never)=>{let response;try{response=await transport.invoke('creative_builder',name,args);}catch{throw new AmbiguousHandoffWriteError();}if(response.error)failed(response.error);return response.data;};
 return Object.freeze({
  async reserve(input:Parameters<DurableBuilderStudioTransferStore['reserve']>[0]){return transfer(await invoke('reserve_studio_handoff',{p_project:input.builderProjectId,p_expected_revision:input.expectedProjectRevision,p_selection:input.selectionId,p_handoff_key:input.handoffKey,p_artifact_sha256:input.artifactSha256,p_selection_sha256:input.selectionContentSha256} as never));},
  async read(handoffKey:string){const value=await invoke('read_studio_handoff',{p_handoff_key:handoffKey} as never);return value===null?null:transfer(value);},
  async link(input:Parameters<DurableBuilderStudioTransferStore['link']>[0]){await invoke('link_studio_handoff',{p_handoff_key:input.handoffKey,p_artifact_sha256:input.artifactSha256,p_studio_project:input.studioProjectId,p_studio_version:input.studioVersionId} as never);},
 });
}

export function createIdempotentStudioHandoffStore(transport:TrustedStudioRpcTransport):IdempotentStudioHandoffStore {
 const invoke=async(name:'create_handoff_artwork'|'read_handoff_artwork',args:never)=>{let response;try{response=await transport.invoke('creative_studio',name,args);}catch{throw new AmbiguousHandoffWriteError();}if(response.error)failed(response.error);return response.data;};
 return Object.freeze({
  async createByHandoffKey(input:Parameters<IdempotentStudioHandoffStore['createByHandoffKey']>[0]){const a=input.artwork;return studio(await invoke('create_handoff_artwork',{p_handoff_key:input.handoffKey,p_artifact_sha256:input.artifactSha256,p_brief:a.brief,p_scene:a.scene,p_sources:a.sourceSnapshot,p_recipes:a.recipes} as never));},
  async readByHandoffKey(handoffKey:string){const value=await invoke('read_handoff_artwork',{p_handoff_key:handoffKey} as never);return value===null?null:studio(value);},
 });
}