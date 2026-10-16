import {z} from 'zod';
import {createClient} from '@/utils/supabase/server';
import {hasStudioClientAccess} from '@/lib/creative-studio/hosted-access';
import {createCreativeBuilderRuntime} from '@/services/creative-builder-runtime';
import {CreativeBuilderServerError} from '@/services/creative-builder-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const Preview=z.object({projectId:z.string().uuid(),scanId:z.string().uuid(),candidateId:z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/)}).strict();
const Asset=z.object({projectId:z.string().uuid(),assetId:z.string().uuid()}).strict();
const Import=Preview.extend({expectedProjectRevision:z.number().int().min(0).max(1000)}).strict();
const BODY_LIMIT=16*1024;

class HttpError extends Error{constructor(readonly status:number){super('Creative Builder image request failed.');}}
async function authorize(){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new HttpError(401);
 const {data:profile,error:profileError}=await supabase.from('profiles').select('role, client_access').eq('id',user.id).single();
 if(profileError||!profile||!hasStudioClientAccess(profile))throw new HttpError(403);
 return {ownerId:user.id,tenantId:'eicagency' as const};
}
async function jsonBody(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403);
 if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new HttpError(415);
 const declared=Number(request.headers.get('content-length'));if(Number.isFinite(declared)&&declared>BODY_LIMIT)throw new HttpError(413);
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400);const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>BODY_LIMIT){await reader.cancel();throw new HttpError(413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new HttpError(400);}
}
function failure(error:unknown,fallback=400){const status=error instanceof HttpError?error.status:error instanceof CreativeBuilderServerError?error.status:fallback;const message=status===401?'Authentication required.':status===403?'EIC Agency access required.':status===413?'Source image request body too large.':status===415?'JSON content type required.':status===409?'Creative Builder state changed. Refresh and retry.':status===429?'Creative Builder usage limit reached.':status===400?'Invalid source image request.':'Source image unavailable.';return Response.json({error:message},{status,headers:noStore});}

export async function GET(request:Request){let app:ReturnType<typeof createCreativeBuilderRuntime>|undefined;try{
 const context=await authorize();
 const query=new URL(request.url).searchParams;if(new Set(query.keys()).size!==query.size)throw new HttpError(400);
 const kind=query.get('kind');const raw=Object.fromEntries(query);delete raw.kind;
 const parsed=kind==='asset'?Asset.safeParse(raw):kind==='preview'?Preview.safeParse(raw):{success:false as const};if(!parsed.success)throw new HttpError(400);
 app=createCreativeBuilderRuntime(process.env,context);const image=await app.readImage(parsed.data);return new Response(new Uint8Array(image.bytes),{headers:{...noStore,...image.headers}});
 }catch(error){return failure(error,404);}finally{await app?.close();}}

export async function POST(request:Request){let app:ReturnType<typeof createCreativeBuilderRuntime>|undefined;try{
 const context=await authorize();
 const input=Import.parse(await jsonBody(request));app=createCreativeBuilderRuntime(process.env,context);
 const result=await app.server.execute({operation:'import-source-asset',...input},request.headers.get('idempotency-key')??undefined);
 return Response.json(result,{headers:noStore});
 }catch(error){return failure(error);}finally{await app?.close();}}
