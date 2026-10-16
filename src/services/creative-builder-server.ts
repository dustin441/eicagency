import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {
  ChannelRecommendationSchema,
  CreativeAssumptionsSchema,
  GeneratedConceptSchema,
  LandingPageReceiptSchema,
  PublicCreativeProjectSchema,
  type LandingPageReceipt,
} from '../lib/creative-studio/strategy.ts';
import type {BuilderOperation} from './creative-builder-repository.ts';
import type {StudioHandoffRecord} from './creative-builder-studio-handoff.ts';

const Id=z.string().uuid();
const Handle=z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const ProjectRevision=z.number().int().min(0).max(1000);
const Message=z.string().trim().min(1).max(2000);
const RequestKey=z.string().min(8).max(96).regex(/^[A-Za-z0-9:_-]+$/);
const MODEL_TIMEOUT_SECONDS=90;
const Url=z.string().url().min(8).max(2048).superRefine((value,ctx)=>{const parsed=new URL(value);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)ctx.addIssue({code:'custom',message:'Invalid URL'});});
const AssumptionPatch=z.object({recommendation:z.string().trim().min(1).max(500)}).strict();
const ClaimPatch=z.object({id:Handle,kind:z.enum(['general','price','percentage','guarantee','testimonial','comparison','result','operational']),text:z.string().trim().min(1).max(500)}).strict();
const ChannelPatch=z.object({channel:z.enum(['meta','google-display','google-performance-max','linkedin']),recommended:z.boolean(),placements:z.array(z.string().trim().min(1).max(80)).max(8)}).strict();
const PlanPatch=z.object({
  advertisedSubject:AssumptionPatch.optional(),offer:AssumptionPatch.optional(),audience:AssumptionPatch.optional(),awareness:AssumptionPatch.optional(),
  funnelStage:AssumptionPatch.optional(),objective:AssumptionPatch.optional(),message:AssumptionPatch.optional(),cta:AssumptionPatch.optional(),
  claims:z.array(ClaimPatch).max(8).refine(claims=>new Set(claims.map(claim=>claim.id)).size===claims.length).optional(),channels:z.array(ChannelPatch).max(5).optional(),
}).strict().refine(value=>Object.keys(value).length>0);
const ExpectedBase={projectId:Id,expectedProjectRevision:ProjectRevision};
const Input=z.union([
  z.object({operation:z.literal('list'),limit:z.number().int().min(1).max(100).optional(),cursor:z.object({createdAt:z.string().datetime({offset:true}),id:Id}).strict().nullable().optional()}).strict(),
  z.object({operation:z.literal('read'),projectId:Id}).strict(),
  z.object({operation:z.literal('create-and-analyze'),url:Url}).strict(),
  z.object({operation:z.literal('edit-plan'),...ExpectedBase,expectedPlanRevisionId:Id,patch:PlanPatch}).strict(),
  z.object({operation:z.literal('confirm-plan'),...ExpectedBase,expectedPlanRevisionId:Id,confirmedClaimIds:z.array(Handle).max(8).refine(ids=>new Set(ids).size===ids.length)}).strict(),
  z.object({operation:z.literal('generate-concepts'),...ExpectedBase,expectedPlanRevisionId:Id}).strict(),
  z.object({operation:z.literal('select-concept'),...ExpectedBase,expectedConceptSetId:Id,conceptId:Handle,orderedAssetIds:z.array(Id).max(8)}).strict(),
  z.object({operation:z.literal('select-concept'),...ExpectedBase,expectedConceptRevisionId:Id,conceptId:Handle,orderedAssetIds:z.array(Id).max(8)}).strict(),
  z.object({operation:z.literal('revise'),...ExpectedBase,target:z.literal('plan'),expectedPlanRevisionId:Id,message:Message}).strict(),
  z.object({operation:z.literal('revise'),...ExpectedBase,target:z.literal('portfolio'),expectedConceptSetId:Id,message:Message}).strict(),
  z.object({operation:z.literal('revise'),...ExpectedBase,target:z.literal('concept'),expectedConceptRevisionId:Id,conceptId:Handle,message:Message}).strict(),
  z.object({operation:z.literal('import-source-asset'),...ExpectedBase,scanId:Id,candidateId:Handle}).strict(),
  z.object({operation:z.literal('handoff'),...ExpectedBase,selectionId:Id}).strict(),
  z.object({operation:z.literal('delete-project'),...ExpectedBase}).strict(),
]);

export type CreativeBuilderServerInput=z.input<typeof Input>;
export type CreativeBuilderLease=Readonly<{jobId:string;leaseToken:string;fencingGeneration:number;state:string;result:Record<string,unknown>|null}>;
export type CreativeBuilderCommitFence=Readonly<{jobId:string;leaseToken:string;fencingGeneration:number;projectId:string;expectedProjectRevision:number;operation:BuilderOperation}>;

export interface CreativeBuilderServerRepository {
  create(input:{normalizedUrl:string;idempotencyKey:string}):Promise<{projectId:string;revision:number}>;
  read(projectId:string):Promise<z.infer<typeof PublicCreativeProjectSchema>>;
  list(input:{limit:number;cursor:{createdAt:string;id:string}|null}):Promise<unknown>;
  editPlan(input:{projectId:string;expectedPlanRevisionId:string;expectedProjectRevision:number;scanId:string;assumptions:z.infer<typeof CreativeAssumptionsSchema>;channels:z.infer<typeof ChannelRecommendationSchema>[]}):Promise<z.infer<typeof PublicCreativeProjectSchema>>;
  confirmPlan(input:{projectId:string;expectedPlanRevisionId:string;expectedProjectRevision:number;confirmedClaimIds:string[]}):Promise<z.infer<typeof PublicCreativeProjectSchema>>;
  reserveJob(input:{projectId:string;expectedProjectRevision:number;operation:BuilderOperation;idempotencyKey:string;reservedUnits:number;reservedBytes:number;targetKind:'plan'|'portfolio'|'concept'|null;targetId:string|null}):Promise<{jobId:string;state:string;leaseToken:string|null;fencingGeneration:number;result:Record<string,unknown>|null}>;

  selectConcept(input:{projectId:string;expectedProjectRevision:number;expectedConceptSetId:string|null;expectedConceptRevisionId:string|null;conceptId:string;orderedAssetIds:string[]}):Promise<z.infer<typeof PublicCreativeProjectSchema>>;
  deleteProject(input:{projectId:string;expectedProjectRevision:number}):Promise<{project_id:string;state:'pending_objects'|'objects_deleted'|'failed';enqueued_objects:number;linked_studio_preserved:boolean}>;
}
export interface CreativeBuilderWorker {
  recover(input:{jobId:string;projectId:string;operation:BuilderOperation;expectedProjectRevision:number}):Promise<{jobId:string;state:'reserved'|'failed';leaseToken:string|null;fencingGeneration:number;result:null}>;
  transition(fence:CreativeBuilderCommitFence,state:'scanning'|'model_started'|'committing',modelTimeoutSeconds?:number):Promise<void>;
  commitAnalysis(fence:CreativeBuilderCommitFence,input:{scanId:string;receipt:LandingPageReceipt;assumptions:unknown;channels:unknown;previews:unknown[]}):Promise<void>;
  commitConcepts(fence:CreativeBuilderCommitFence,input:{confirmedPlanId:string;portfolio:unknown}):Promise<void>;
  commitRevision(fence:CreativeBuilderCommitFence,input:{target:'plan'|'portfolio'|'concept';expectedTargetId:string;conceptId:string|null;payload:unknown;userMessage:string;assistantMessage:string}):Promise<void>;
  fail(fence:CreativeBuilderCommitFence,code:'scan_failed'|'provider_failed'|'invalid_result'|'storage_failed'|'commit_failed'|'cancelled'):Promise<void>;
}
export interface CreativeBuilderServerAi {
  analyze(input:{projectId:string;scanId:string;planRevisionId:string;claimIds:string[];receipt:LandingPageReceipt}):Promise<{assumptions:unknown;channels:unknown;assistantMessage:string}>;
  generate(input:{projectId:string;expectedPlanRevisionId:string;portfolioId:string;conceptIds:string[]}):Promise<{concepts:z.infer<typeof GeneratedConceptSchema>[]}>;
  revise(input:Record<string,unknown>):Promise<{target:'plan';strategy:{assumptions:unknown;channels:unknown}}|{target:'portfolio';portfolio:{concepts:z.infer<typeof GeneratedConceptSchema>[]}}|{target:'concept';concept:z.infer<typeof GeneratedConceptSchema>}>;
}
export interface CreativeBuilderServerSources {
  preparePreviews(input:{fence:CreativeBuilderCommitFence;receipt:LandingPageReceipt}):Promise<unknown[]>;
  import(input:{fence:CreativeBuilderCommitFence;scanId:string;candidateId:string}):Promise<{assetId:string}>;
}
export interface CreativeBuilderServerDependencies {repository:CreativeBuilderServerRepository;worker:CreativeBuilderWorker;ai:CreativeBuilderServerAi;sources:CreativeBuilderServerSources;handoff:{execute(input:{projectId:string;expectedProjectRevision:number;expectedSelectionId:string}):Promise<StudioHandoffRecord>};scan(url:string,scanId:string):Promise<LandingPageReceipt>;uuid?:()=>string}

export class CreativeBuilderServerError extends Error {readonly code:'invalid'|'conflict'|'limit'|'unavailable';readonly status:number;constructor(code:'invalid'|'conflict'|'limit'|'unavailable'){super(`Creative Builder request ${code}.`);this.name='CreativeBuilderServerError';this.code=code;this.status={invalid:400,conflict:409,limit:429,unavailable:503}[code];}}
const failCode=(error:unknown,stage:'scan'|'model'|'storage'|'commit')=>stage==='scan'?'scan_failed' as const:stage==='model'?'provider_failed' as const:stage==='storage'?'storage_failed' as const:'commit_failed' as const;
const publicError=(error:unknown)=>{if(error instanceof CreativeBuilderServerError)return error;const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';return new CreativeBuilderServerError(code==='conflict'?'conflict':code==='limit'?'limit':code==='invalid'||code==='invalid_input'?'invalid':'unavailable');};

export function createCreativeBuilderServer(deps:CreativeBuilderServerDependencies){
  if(typeof window!=='undefined')throw new CreativeBuilderServerError('unavailable');
  const uuid=deps.uuid??randomUUID;
  const parseProject=(value:unknown)=>PublicCreativeProjectSchema.parse(value);
  async function reserve(projectId:string,revision:number,operation:BuilderOperation,key:string,targetKind:'plan'|'portfolio'|'concept'|null,targetId:string|null,reservedBytes=0):Promise<CreativeBuilderLease>{
    let job=await deps.repository.reserveJob({projectId,expectedProjectRevision:revision,operation,idempotencyKey:key,reservedUnits:1,reservedBytes,targetKind,targetId});
    if(job.state==='completed')return {...job,leaseToken:''};
    if(job.state!=='reserved')job=await deps.worker.recover({jobId:job.jobId,projectId,operation,expectedProjectRevision:revision});
    if(!job.leaseToken||job.state!=='reserved')throw new CreativeBuilderServerError('conflict');
    return {...job,leaseToken:job.leaseToken};
  }
  const fence=(job:CreativeBuilderLease,projectId:string,revision:number,operation:BuilderOperation):CreativeBuilderCommitFence=>({jobId:job.jobId,leaseToken:job.leaseToken,fencingGeneration:job.fencingGeneration,projectId,expectedProjectRevision:revision,operation});
  async function runFenced<T>(f:CreativeBuilderCommitFence,body:()=>Promise<T>,stage:'scan'|'model'|'storage'|'commit'):Promise<T>{try{return await body();}catch(error){try{await deps.worker.fail(f,failCode(error,stage));}catch{}throw publicError(error);}}
  async function canonical(projectId:string){return parseProject(await deps.repository.read(projectId));}
  async function afterCommit(projectId:string){try{return await canonical(projectId);}catch(error){throw publicError(error);}}

  return Object.freeze({
    async execute(raw:unknown,requestKey?:string):Promise<unknown>{
      const parsed=Input.safeParse(raw);if(!parsed.success)throw new CreativeBuilderServerError('invalid');const input=parsed.data;
      try{
        if(input.operation==='list'){
          const page=z.object({projects:z.array(z.object({id:Id}).passthrough()).max(100),nextCursor:z.object({createdAt:z.string().datetime({offset:true}),id:Id}).strict().nullable(),exhausted:z.boolean()}).strict().parse(await deps.repository.list({limit:input.limit??50,cursor:input.cursor??null}));
          return {projects:await Promise.all(page.projects.map(item=>canonical(item.id))),nextCursor:page.nextCursor,exhausted:page.exhausted};
        }
        if(input.operation==='read')return canonical(input.projectId);
        if(input.operation==='delete-project')return deps.repository.deleteProject({projectId:input.projectId,expectedProjectRevision:input.expectedProjectRevision});
        if(input.operation==='create-and-analyze'){
          const parsedKey=RequestKey.safeParse(requestKey);if(!parsedKey.success)throw new CreativeBuilderServerError('invalid');const key=parsedKey.data;
          const created=await deps.repository.create({normalizedUrl:input.url,idempotencyKey:key});
          const job=await reserve(created.projectId,0,'analysis',key,null,null);
          if(job.state==='completed')return afterCommit(created.projectId);
          const f=fence(job,created.projectId,0,'analysis');
          await deps.worker.transition(f,'scanning');
          const scanId=uuid();
          const receipt=LandingPageReceiptSchema.parse(await runFenced(f,()=>deps.scan(input.url,scanId),'scan'));
          if(receipt.id!==scanId)throw await runFenced(f,async()=>{throw new CreativeBuilderServerError('unavailable');},'scan');
          const previews=await runFenced(f,()=>deps.sources.preparePreviews({fence:f,receipt}),'storage');
          await deps.worker.transition(f,'model_started',MODEL_TIMEOUT_SECONDS);
          const draft=await runFenced(f,()=>deps.ai.analyze({projectId:created.projectId,scanId,planRevisionId:uuid(),claimIds:Array.from({length:8},()=>`claim-${uuid()}`),receipt}),'model');
          await deps.worker.transition(f,'committing');
          await runFenced(f,()=>deps.worker.commitAnalysis(f,{scanId,receipt,assumptions:draft.assumptions,channels:draft.channels,previews}),'commit');
          return afterCommit(created.projectId);
        }
        if(input.operation==='edit-plan'){
          const current=await canonical(input.projectId);if(current.projectRevision!==input.expectedProjectRevision||current.planRevisionId!==input.expectedPlanRevisionId)throw new CreativeBuilderServerError('conflict');
          const {channels,claims,...assumptionPatch}=input.patch;
          const assumptions=structuredClone(current.assumptions);
          for(const [name,patch] of Object.entries(assumptionPatch)){
            const key=name as Exclude<keyof typeof assumptions,'claims'>;
            assumptions[key]={...assumptions[key],recommendation:patch.recommendation,confirmed:false};
          }
          if(claims){
            const currentById=new Map(assumptions.claims.map((claim,index)=>[claim.id,{claim,index}]));let previousIndex=-1;
            assumptions.claims=claims.map(claim=>{const current=currentById.get(claim.id);if(!current||current.index<=previousIndex||current.claim.kind!==claim.kind)throw new CreativeBuilderServerError('invalid');previousIndex=current.index;if(current.claim.text===claim.text)return current.claim;const unconfirmed={...current.claim};delete unconfirmed.confirmationReceiptId;return {...unconfirmed,text:claim.text,status:'needs-confirmation' as const,pageExcerptIds:[]};});
          }
          let mergedChannels=current.channels;
          if(channels){
            if(channels.length!==current.channels.length||channels.some((channel,index)=>channel.channel!==current.channels[index]?.channel))throw new CreativeBuilderServerError('invalid');
            mergedChannels=channels.map((channel,index)=>({...current.channels[index],recommended:channel.recommended,placements:channel.placements}));
          }
          return parseProject(await deps.repository.editPlan({projectId:input.projectId,expectedPlanRevisionId:input.expectedPlanRevisionId,expectedProjectRevision:input.expectedProjectRevision,scanId:current.scanId,assumptions,channels:mergedChannels}));
        }
        if(input.operation==='confirm-plan')return parseProject(await deps.repository.confirmPlan(input));
        if(input.operation==='select-concept'){const revision='expectedConceptRevisionId' in input?input.expectedConceptRevisionId:null;const conceptSet='expectedConceptSetId' in input?input.expectedConceptSetId:null;return parseProject(await deps.repository.selectConcept({projectId:input.projectId,expectedProjectRevision:input.expectedProjectRevision,expectedConceptSetId:conceptSet,expectedConceptRevisionId:revision,conceptId:input.conceptId,orderedAssetIds:input.orderedAssetIds}));}
        if(input.operation==='handoff')return deps.handoff.execute({projectId:input.projectId,expectedProjectRevision:input.expectedProjectRevision,expectedSelectionId:input.selectionId});
        if(input.operation==='import-source-asset'){
          const key=RequestKey.parse(requestKey??`import:${input.projectId}:${input.scanId}:${input.candidateId}`);
          const job=await reserve(input.projectId,input.expectedProjectRevision,'source_import',key,null,null,8*1024*1024);if(job.state==='completed'){const result=z.object({asset_id:Id}).passthrough().parse(job.result);return {assetId:result.asset_id};}
          const f=fence(job,input.projectId,input.expectedProjectRevision,'source_import');await deps.worker.transition(f,'scanning');
          const imported=await runFenced(f,()=>deps.sources.import({fence:f,scanId:input.scanId,candidateId:input.candidateId}),'storage');return imported;
        }
        if(input.operation==='generate-concepts'){
          const key=RequestKey.parse(requestKey??`generation:${input.projectId}:${input.expectedPlanRevisionId}`);const job=await reserve(input.projectId,input.expectedProjectRevision,'generation',key,'plan',input.expectedPlanRevisionId);if(job.state==='completed')return afterCommit(input.projectId);
          const f=fence(job,input.projectId,input.expectedProjectRevision,'generation');await deps.worker.transition(f,'model_started',MODEL_TIMEOUT_SECONDS);
          const portfolioId=uuid(),conceptIds=Array.from({length:6},(_,i)=>`concept-${i+1}`);const portfolio=await runFenced(f,()=>deps.ai.generate({projectId:input.projectId,expectedPlanRevisionId:input.expectedPlanRevisionId,portfolioId,conceptIds}),'model');
          await deps.worker.transition(f,'committing');await runFenced(f,()=>deps.worker.commitConcepts(f,{confirmedPlanId:input.expectedPlanRevisionId,portfolio:portfolio.concepts.map(content=>({handle:content.id,content}))}),'commit');return afterCommit(input.projectId);
        }
        const targetId=input.target==='plan'?input.expectedPlanRevisionId:input.target==='portfolio'?input.expectedConceptSetId:input.expectedConceptRevisionId;
        const key=RequestKey.parse(requestKey??`revision:${input.projectId}:${targetId}:${uuid()}`);const job=await reserve(input.projectId,input.expectedProjectRevision,'revision',key,input.target,targetId);if(job.state==='completed')return afterCommit(input.projectId);
        const f=fence(job,input.projectId,input.expectedProjectRevision,'revision');await deps.worker.transition(f,'model_started',MODEL_TIMEOUT_SECONDS);
        const ids=input.target==='plan'?{expectedPlanRevisionId:input.expectedPlanRevisionId,newPlanRevisionId:uuid(),claimIds:Array.from({length:8},()=>`claim-${uuid()}`)}:input.target==='portfolio'?{expectedConceptSetId:input.expectedConceptSetId,newPortfolioId:uuid(),conceptIds:Array.from({length:6},(_,i)=>`concept-${i+1}`)}:{expectedConceptRevisionId:input.expectedConceptRevisionId,conceptId:input.conceptId};
        const revised=await runFenced(f,()=>deps.ai.revise({projectId:input.projectId,target:input.target,message:input.message,...ids}),'model');
        const payload=revised.target==='plan'?{assumptions:revised.strategy.assumptions,channels:revised.strategy.channels}:revised.target==='portfolio'?revised.portfolio.concepts.map(content=>({handle:content.id,content})):revised.concept;
        const assistantMessage=revised.target==='plan'?'Updated the plan.':revised.target==='portfolio'?'Updated the six-concept portfolio.':'Updated the concept.';
        await deps.worker.transition(f,'committing');await runFenced(f,()=>deps.worker.commitRevision(f,{target:input.target,expectedTargetId:targetId,conceptId:input.target==='concept'?input.conceptId:null,payload,userMessage:input.message,assistantMessage}),'commit');return afterCommit(input.projectId);
      }catch(error){throw publicError(error);}
    },
  });
}
