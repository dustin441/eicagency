import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeHostedStudio, type HostedStudioAccessConfig } from '../lib/creative-studio/hosted-access.ts';

/** Per-request server binding. Inject the cookie-bound server client factory, never an
 * admin client impersonating a request. Disabled paths make no profile query.
 * Hosted profile role-write protections still need environment-specific verification.
 */
export function authorizeSupabaseHostedStudio(config:HostedStudioAccessConfig,createServerClient:()=>Promise<SupabaseClient>){
 return authorizeSupabaseHostedStudioIdentity(config,createServerClient).then(result=>result.context);
}
export async function authorizeSupabaseHostedStudioIdentity(config:HostedStudioAccessConfig,createServerClient:()=>Promise<SupabaseClient>){
 let verifiedRole: 'agency' | 'super_admin' | 'client' | undefined;
 let client:Promise<SupabaseClient>|undefined;
 const getClient=()=>client??=createServerClient();
 const context = await authorizeHostedStudio(config,{
  async getVerifiedUser(){
   const {data,error}=await (await getClient()).auth.getUser();
   if(error||!data.user)return null;
   return {id:data.user.id};
  },
  async getProtectedProfile(id){
   const {data,error}=await (await getClient()).from('profiles').select('role, client_access').eq('id',id).single();
   if(error||!data||typeof data.role!=='string')return null;
   if(data.role==='agency'||data.role==='super_admin'||data.role==='client')verifiedRole=data.role;
   return {role:data.role,client_access:data.client_access};
  },
 });
 if(!verifiedRole)throw new Error('Creative Studio access denied.');
 return {context,identity:{userId:context.ownerId,role:verifiedRole}};
}
