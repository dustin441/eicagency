import 'server-only';
import {Pool,type PoolClient} from 'pg';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {creativeBuilderLifecycleConfig} from './creative-builder-server-config.ts';
import {createCreativeBuilderCleanupWorker,type CreativeBuilderCleanupStore} from './creative-builder-cleanup.ts';
import type {CreativeBuilderPrivateObjectProvider} from './creative-builder-source-storage.ts';

const Sweep=z.object({expiredJobs:z.number().int().nonnegative(),abandonedProjects:z.number().int().nonnegative(),enqueuedObjects:z.number().int().nonnegative()}).strict();
const Purge=z.object({purgedProjects:z.number().int().nonnegative(),expiredTombstones:z.number().int().nonnegative()}).strict();
const Claimed=z.array(z.object({id:z.string().uuid(),ownerId:z.string().uuid(),tenantId:z.literal('eicagency'),projectId:z.string().uuid(),objectKey:z.string(),leaseToken:z.string().uuid(),fencingGeneration:z.number().int().positive(),attempt:z.number().int().min(1).max(5)}).strict()).max(50);

function lifecycleStore(pool:Pick<Pool,'connect'>):CreativeBuilderCleanupStore{
 async function call<T>(sql:string,values:unknown[],schema:z.ZodType<T>):Promise<T>{
  let client:PoolClient|undefined,broken=false;
  try{
   client=await pool.connect();await client.query('BEGIN');await client.query('SET LOCAL ROLE creative_builder_worker');
   await client.query("SELECT set_config('statement_timeout','10000',true),set_config('search_path','pg_catalog',true)");
   const result=await client.query<{data:unknown}>(sql,values);await client.query('COMMIT');
   return schema.parse(result.rows[0]?.data);
  }catch{if(client)try{await client.query('ROLLBACK');}catch{broken=true;}throw new Error('Creative Builder lifecycle persistence unavailable');}
  finally{client?.release(broken);}
 }
 return Object.freeze({
  sweep:(limit:number)=>call('SELECT creative_builder.lifecycle_sweep($1::integer) AS data',[limit],Sweep),
  claimObjects:(limit:number)=>call('SELECT creative_builder.claim_cleanup_objects($1::integer,$2::integer) AS data',[limit,120],Claimed),
  completeObject:async (input:Parameters<CreativeBuilderCleanupStore['completeObject']>[0])=>{await call('SELECT creative_builder.complete_cleanup_object($1::uuid,$2::uuid,$3::integer,$4::text) AS data',[input.id,input.leaseToken,input.fencingGeneration,input.outcome],z.null());},
  failObject:async (input:Parameters<CreativeBuilderCleanupStore['failObject']>[0])=>{await call('SELECT creative_builder.fail_cleanup_object($1::uuid,$2::uuid,$3::integer,$4::text) AS data',[input.id,input.leaseToken,input.fencingGeneration,input.errorCode],z.null());},
  purge:(limit:number)=>call('SELECT creative_builder.purge_cleanup_projects($1::integer) AS data',[limit],Purge),
 });
}

export async function runProductionCreativeBuilderCleanup(env:Record<string,string|undefined>=process.env){
 const config=creativeBuilderLifecycleConfig(env),pool=new Pool(config.worker);
 const supabase=createSupabaseClient(config.storageUrl,config.storageKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const objects:CreativeBuilderPrivateObjectProvider={
  async putCreateOnly(){throw new Error('cleanup provider is delete-only');},
  async get(){throw new Error('cleanup provider is delete-only');},
  async remove(bucket,key){
   const existing=await supabase.storage.from(bucket).download(key);
   if(existing.error){const status=String((existing.error as {statusCode?:string|number}).statusCode??'');if(status==='404'||/not[ -]?found/i.test(existing.error.message))return 'not-found';throw new Error('storage unavailable');}
   const removed=await supabase.storage.from(bucket).remove([key]);if(removed.error)throw new Error('storage unavailable');return 'removed';
  },
 };
 try{return await createCreativeBuilderCleanupWorker({store:lifecycleStore(pool),objects}).run({batchSize:20,maxObjects:100,maxRuntimeMs:20_000});}
 finally{await pool.end();}
}
