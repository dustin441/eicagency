import {z} from 'zod';
import type {CreativeBuilderPrivateObjectProvider} from './creative-builder-source-storage.ts';

const Id=z.string().uuid();
const CleanupObject=z.object({
 id:Id,ownerId:Id,tenantId:z.literal('eicagency'),projectId:Id,
 objectKey:z.string().min(1).max(1024),leaseToken:Id,
 fencingGeneration:z.number().int().positive(),attempt:z.number().int().min(1).max(5),
}).strict();
const Options=z.object({batchSize:z.number().int().min(1).max(50).default(20),maxObjects:z.number().int().min(1).max(500).default(100),maxRuntimeMs:z.number().int().min(100).max(240_000).default(20_000)}).strict();
const Sweep=z.object({expiredJobs:z.number().int().nonnegative(),abandonedProjects:z.number().int().nonnegative(),enqueuedObjects:z.number().int().nonnegative()}).strict();
const Purge=z.object({purgedProjects:z.number().int().nonnegative(),expiredTombstones:z.number().int().nonnegative()}).strict();

export type CreativeBuilderCleanupObject=Readonly<z.infer<typeof CleanupObject>>;
export interface CreativeBuilderCleanupStore {
 sweep(limit:number):Promise<z.infer<typeof Sweep>>;
 claimObjects(limit:number):Promise<CreativeBuilderCleanupObject[]>;
 completeObject(input:Readonly<{id:string;leaseToken:string;fencingGeneration:number;outcome:'removed'|'not-found'}>):Promise<void>;
 failObject(input:Readonly<{id:string;leaseToken:string;fencingGeneration:number;errorCode:'storage_failed'}>):Promise<void>;
 purge(limit:number):Promise<z.infer<typeof Purge>>;
}
export type CreativeBuilderCleanupErrorCode='invalid'|'integrity'|'unavailable';
export class CreativeBuilderCleanupError extends Error{
 readonly code:CreativeBuilderCleanupErrorCode;
 constructor(code:CreativeBuilderCleanupErrorCode){super(`Creative Builder cleanup: ${code}`);this.name='CreativeBuilderCleanupError';this.code=code;}
}
function parse<S extends z.ZodType>(schema:S,value:unknown,code:CreativeBuilderCleanupErrorCode):z.output<S>{const parsed=schema.safeParse(value);if(!parsed.success)throw new CreativeBuilderCleanupError(code);return parsed.data;}
function validateTarget(target:CreativeBuilderCleanupObject):void{
 const prefix=`eicagency/${target.ownerId}/${target.projectId}/`;
 if(!target.objectKey.startsWith(prefix)||target.objectKey.includes('..')||target.objectKey.includes('\\')||target.objectKey.includes('://')||target.objectKey.startsWith('/'))throw new CreativeBuilderCleanupError('integrity');
}
export function createCreativeBuilderCleanupWorker(dependencies:Readonly<{store:CreativeBuilderCleanupStore;objects:CreativeBuilderPrivateObjectProvider;now?:()=>number}>){
 if(typeof window!=='undefined')throw new CreativeBuilderCleanupError('unavailable');
 const now=dependencies.now??Date.now;
 return Object.freeze({
  async run(input:unknown={}){
   const options=parse(Options,input,'invalid');
   const started=now();
   let sweep:z.infer<typeof Sweep>;
   try{sweep=parse(Sweep,await dependencies.store.sweep(options.batchSize),'integrity');}catch(error){if(error instanceof CreativeBuilderCleanupError)throw error;throw new CreativeBuilderCleanupError('unavailable');}
   const totals={...sweep,claimedObjects:0,deletedObjects:0,missingObjects:0,retryObjects:0,acknowledgementFailures:0,purgedProjects:0,expiredTombstones:0};
   while(totals.claimedObjects<options.maxObjects&&now()-started<options.maxRuntimeMs){
    const remaining=Math.min(options.batchSize,options.maxObjects-totals.claimedObjects);
    let claimed:unknown;
    try{claimed=await dependencies.store.claimObjects(remaining);}catch{throw new CreativeBuilderCleanupError('unavailable');}
    const targets=parse(z.array(CleanupObject).max(remaining),claimed,'integrity');
    if(targets.length===0)break;
    for(const target of targets){
     validateTarget(target);totals.claimedObjects+=1;
     let outcome:'removed'|'not-found';
     try{outcome=await dependencies.objects.remove('creative-builder-private',target.objectKey);}catch{
      try{await dependencies.store.failObject({id:target.id,leaseToken:target.leaseToken,fencingGeneration:target.fencingGeneration,errorCode:'storage_failed'});totals.retryObjects+=1;}catch{totals.acknowledgementFailures+=1;}
      continue;
     }
     try{
      await dependencies.store.completeObject({id:target.id,leaseToken:target.leaseToken,fencingGeneration:target.fencingGeneration,outcome});
      if(outcome==='removed')totals.deletedObjects+=1;else totals.missingObjects+=1;
     }catch{totals.acknowledgementFailures+=1;}
     if(totals.claimedObjects>=options.maxObjects||now()-started>=options.maxRuntimeMs)break;
    }
    if(targets.length<remaining)break;
   }
   try{const purge=parse(Purge,await dependencies.store.purge(options.batchSize),'integrity');totals.purgedProjects=purge.purgedProjects;totals.expiredTombstones=purge.expiredTombstones;}catch{throw new CreativeBuilderCleanupError('unavailable');}
   return Object.freeze(totals);
  },
 });
}
