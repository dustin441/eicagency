import { createHash } from 'node:crypto';
import { z } from 'zod';
import { RatioSchema } from '../lib/creative-studio/model.ts';
import type { VerifiedStudioContext } from './creative-studio-repository.ts';
const BUCKET='creative-studio-private';
const Context=z.object({tenantId:z.literal('eicagency'),ownerId:z.string().uuid()}).strict();
const Locator=z.object({ownerId:z.string().uuid(),projectId:z.string().uuid(),versionId:z.string().uuid(),placementId:RatioSchema,jobId:z.string().uuid(),leaseToken:z.string().uuid()}).strict();
const Metadata=z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),sizeBytes:z.number().int().positive().max(20971520),width:z.number().int().positive(),height:z.number().int().positive(),mimeType:z.literal('image/png')}).strict();
export type StudioStorageLocator=z.infer<typeof Locator>;
export type StudioPngMetadata=z.infer<typeof Metadata>;
/** Supply a dedicated server storage capability. Never expose it or locators to the browser.
 * Caller must validate current lease/owner in SQL before upload, and authorize the owning
 * project plus immutable asset record before download. This is not authentication.
 */
export interface StudioPrivateObjectTransport {
 upload(bucket:string,key:string,bytes:Uint8Array,options:{contentType:'image/png';upsert:false}):Promise<{error:unknown|null}>;
 download(bucket:string,key:string):Promise<{data:Blob|null;error:unknown|null}>;
}
export class StudioStorageError extends Error{readonly code:'invalid'|'denied'|'unavailable'|'integrity';constructor(code:'invalid'|'denied'|'unavailable'|'integrity'){super(`Creative Studio storage: ${code}`);this.code=code;this.name='StudioStorageError';}}
export function createStudioPrivateStorage(context:VerifiedStudioContext,transport:StudioPrivateObjectTransport){
 if(typeof window!=='undefined')throw new StudioStorageError('denied');
 const actor=Context.safeParse(context);if(!actor.success)throw new StudioStorageError('denied');
 const ownerId=actor.data.ownerId;
 function key(input:StudioStorageLocator){
  const parsed=Locator.safeParse(input);if(!parsed.success)throw new StudioStorageError('invalid');
  const l=parsed.data;if(l.ownerId!==ownerId)throw new StudioStorageError('denied');
  return ['eicagency',ownerId,l.projectId,l.versionId,l.placementId,l.jobId,l.leaseToken].join('/');
 }
 function metadata(input:StudioPngMetadata){const p=Metadata.safeParse(input);if(!p.success)throw new StudioStorageError('invalid');return p.data;}
 function verify(bytes:Buffer,meta:StudioPngMetadata){
  if(bytes.length!==meta.sizeBytes||bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==meta.width||bytes.readUInt32BE(20)!==meta.height||createHash('sha256').update(bytes).digest('hex')!==meta.sha256)throw new StudioStorageError('integrity');
 }
 return Object.freeze({
  async upload(input:StudioStorageLocator,bytes:Uint8Array,expected:StudioPngMetadata):Promise<void>{
   const objectKey=key(input);const meta=metadata(expected);const stable=Buffer.from(bytes);verify(stable,meta);
   let result;try{result=await transport.upload(BUCKET,objectKey,stable,{contentType:'image/png',upsert:false});}catch{throw new StudioStorageError('unavailable');}
   if(!result||result.error!==null)throw new StudioStorageError('unavailable');
  },
  async download(input:StudioStorageLocator,expected:StudioPngMetadata):Promise<Buffer>{
   const objectKey=key(input);const meta=metadata(expected);
   let result;try{result=await transport.download(BUCKET,objectKey);}catch{throw new StudioStorageError('unavailable');}
   if(!result||result.error!==null||!result.data)throw new StudioStorageError('unavailable');
   if(result.data.size!==meta.sizeBytes||result.data.type!=='image/png')throw new StudioStorageError('integrity');
   let bytes:Buffer;try{bytes=Buffer.from(await result.data.arrayBuffer());}catch{throw new StudioStorageError('unavailable');}
   verify(bytes,meta);return bytes;
  },
 });
}
