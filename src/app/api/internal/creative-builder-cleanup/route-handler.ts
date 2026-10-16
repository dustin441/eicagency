import 'server-only';
import {createHash,timingSafeEqual} from 'node:crypto';
import {runProductionCreativeBuilderCleanup} from '../../../../services/creative-builder-cleanup-runtime.ts';

const noStore={'Cache-Control':'private, no-store, max-age=0'};
const digest=(value:string)=>createHash('sha256').update(value,'utf8').digest();
function authorized(request:Request,expected:string|undefined){
 if(!expected||expected!==expected.trim()||expected.length<32)return false;
 const supplied=/^Bearer ([^\s]+)$/.exec(request.headers.get('authorization')??'')?.[1]??'';
 return timingSafeEqual(digest(expected),digest(supplied));
}
export function createCreativeBuilderCleanupPostHandler(dependencies:Readonly<{getSecret?:()=>string|undefined;run?:()=>Promise<unknown>}>={}){
 const getSecret=dependencies.getSecret??(()=>process.env.CREATIVE_BUILDER_CLEANUP_TOKEN);
 const run=dependencies.run??(()=>runProductionCreativeBuilderCleanup());
 return async function POST(request:Request){
  if(!authorized(request,getSecret()))return Response.json({error:'Unauthorized'},{status:401,headers:noStore});
  const body=await request.text().catch(()=>null);
  if(body===null||body.trim()!=='')return Response.json({error:'Invalid request'},{status:400,headers:noStore});
  try{return Response.json({ok:true,receipt:await run()},{headers:noStore});}
  catch{return Response.json({error:'Creative Builder cleanup failed'},{status:503,headers:noStore});}
 };
}
