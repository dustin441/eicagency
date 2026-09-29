import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerifiedStudioContext } from './creative-studio-repository.ts';
import { createStudioPrivateStorage } from './creative-studio-private-storage.ts';

/** Server composition only: inject the approved storage client. No credentials are read,
 * no public/signed URLs are created and no general-purpose storage capability is returned.
 * The private wrapper validates owner/path/content before these SDK operations run.
 */
export function createSupabaseStudioPrivateStorage(context:VerifiedStudioContext,client:Pick<SupabaseClient,'storage'>){
 return createStudioPrivateStorage(context,{
  async upload(bucket,key,bytes,options){
   const result=await client.storage.from(bucket).upload(key,bytes,options);
   return {error:result.error};
  },
  async download(bucket,key){
   const result=await client.storage.from(bucket).download(key);
   return {data:result.data,error:result.error};
  },
 });
}
