import {z} from 'zod';
import type {TrustedCreativeBuilderRpcTransport,BuilderOperation,BuilderTarget} from './creative-builder-repository.ts';
import {CreativeBuilderRepositoryError} from './creative-builder-repository.ts';
import type {CreativeBuilderCommitFence,CreativeBuilderWorker} from './creative-builder-server.ts';

const Receipt=z.object({}).passthrough();
function map(error:{code?:string}|null){if(!error)return;throw new CreativeBuilderRepositoryError(error.code==='22023'?'invalid':error.code==='42501'?'denied':error.code==='40001'||error.code==='55000'?'conflict':error.code==='54000'?'limit':'unavailable');}
export function createCreativeBuilderWorker(transport:TrustedCreativeBuilderRpcTransport):CreativeBuilderWorker{
  async function call(name:Parameters<TrustedCreativeBuilderRpcTransport['invoke']>[1],args:never){let response;try{response=await transport.invoke('creative_builder',name,args);}catch{throw new CreativeBuilderRepositoryError('unavailable');}map(response.error);return Receipt.parse(response.data??{});}
  const base=(f:CreativeBuilderCommitFence)=>({p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_operation:f.operation as BuilderOperation,p_expected_revision:f.expectedProjectRevision});
  const worker:CreativeBuilderWorker={
    async transition(f,state,modelTimeoutSeconds){await call('transition_job',{...base(f),p_state:state,p_model_timeout_seconds:modelTimeoutSeconds??null} as never);},
    async commitAnalysis(f,input){await call('commit_analysis',{p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_expected_revision:f.expectedProjectRevision,p_scan:input.scanId,p_receipt:input.receipt,p_assumptions:input.assumptions,p_channels:input.channels,p_previews:input.previews} as never);},
    async commitConcepts(f,input){await call('commit_concepts',{p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_expected_revision:f.expectedProjectRevision,p_confirmed_plan:input.confirmedPlanId,p_portfolio:input.portfolio} as never);},
    async commitRevision(f,input){await call('commit_revision',{p_job:f.jobId,p_token:f.leaseToken,p_generation:f.fencingGeneration,p_project:f.projectId,p_expected_project_revision:f.expectedProjectRevision,p_target:input.target as BuilderTarget,p_expected_target:input.expectedTargetId,p_concept_handle:input.conceptId,p_payload:input.payload,p_user_message:input.userMessage,p_assistant_message:input.assistantMessage} as never);},
    async fail(f,code){await call('fail_job',{...base(f),p_error_code:code} as never);},
  };
  return Object.freeze(worker);
}
