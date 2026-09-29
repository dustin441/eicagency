import type { Pool } from 'pg';
import { z } from 'zod';
import type { VerifiedStudioContext } from './creative-studio-repository.ts';
import type { StudioPngMetadata } from './creative-studio-private-storage.ts';
const Id=z.string().uuid();
/** Trusted server construction only; never bind identity from request JSON. No default pool or credentials. */
export function createStudioWorkerPgTransport(pool:Pick<Pool,'connect'>,context:VerifiedStudioContext){
 if(typeof window!=='undefined')throw new Error('Worker denied');
 const actor=Object.freeze(z.object({tenantId:z.literal('eicagency'),ownerId:Id}).strict().parse(context));
 const claims=JSON.stringify({role:'service_role',creative_studio_tenant:actor.tenantId,creative_studio_owner:actor.ownerId});
 async function query(sql:string,values:unknown[]){
  const c=await pool.connect();let broken=false;
  try{await c.query('BEGIN');await c.query('SET LOCAL ROLE creative_studio_worker');await c.query("SELECT set_config('request.jwt.claims',$1,true),set_config('statement_timeout','10000',true),set_config('search_path','pg_catalog',true)",[claims]);const r=await c.query(sql,values);await c.query('COMMIT');return r.rows;}
  catch(e){try{await c.query('ROLLBACK');}catch{broken=true;}throw e;}finally{c.release(broken);}
 }
 return Object.freeze({context:actor,
  async claim(projectId:string):Promise<unknown>{return (await query('SELECT to_jsonb(j) AS data FROM creative_studio.claim_project($1::uuid) j',[Id.parse(projectId)]))[0]?.data??null;},
  async read(projectId:string):Promise<unknown>{return (await query('SELECT creative_studio.read_project($1::uuid) AS data',[Id.parse(projectId)]))[0]?.data;},
  async finish(jobId:string,token:string,result:(StudioPngMetadata & {qaPassed:boolean})|null):Promise<string|null>{
   const r=result===null?null:z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),mimeType:z.literal('image/png'),sizeBytes:z.number().int().positive().max(20971520),width:z.number().int().positive().max(8192),height:z.number().int().positive().max(8192),qaPassed:z.boolean()}).strict().parse(result);const data=(await query('SELECT creative_studio.finish($1::uuid,$2::uuid,$3::boolean,$4::text,$5::text,$6::bigint,$7::integer,$8::integer,$9::boolean) AS data',[Id.parse(jobId),Id.parse(token),r!==null,r?.sha256??null,r?.mimeType??null,r?.sizeBytes??null,r?.width??null,r?.height??null,r?.qaPassed??null]))[0]?.data;
   return r?Id.parse(data):z.null().parse(data);
  }
 });
}
export type StudioWorkerTransport=ReturnType<typeof createStudioWorkerPgTransport>;
