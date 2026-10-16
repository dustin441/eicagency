import {createHash,randomInt as secureRandomInt} from 'node:crypto';
import sharp from 'sharp';
import {z} from 'zod';

export const CREATIVE_BUILDER_IMAGE_MODELS = Object.freeze({
  'gpt-image-2.5-sunburst': Object.freeze({endpoint:'openai/gpt-image-2.5/sunburst/text-to-image', sizeField:'image_size', sizeValue:'square_hd'}),
  'gpt-image-2.5-flare': Object.freeze({endpoint:'openai/gpt-image-2.5/flare/text-to-image', sizeField:'image_size', sizeValue:'square_hd'}),
  'nano-banana-2': Object.freeze({endpoint:'fal-ai/nano-banana-2', sizeField:'aspect_ratio', sizeValue:'1:1'}),
  'flux-2-pro': Object.freeze({endpoint:'fal-ai/flux-2-pro', sizeField:'image_size', sizeValue:'square_hd'}),
  'recraft-v4.1': Object.freeze({endpoint:'fal-ai/recraft/v4.1/text-to-image', sizeField:'image_size', sizeValue:'square_hd'}),
} as const);

export type CreativeBuilderImageModel = keyof typeof CREATIVE_BUILDER_IMAGE_MODELS;
export const CREATIVE_BUILDER_IMAGE_MODEL_IDS = Object.freeze(Object.keys(CREATIVE_BUILDER_IMAGE_MODELS) as CreativeBuilderImageModel[]);

const MAX_PROVIDER_JSON_BYTES = 64 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const FAL_TIMEOUT_MS = 180_000;
const ALLOWED_MEDIA_HOSTS = new Set(['v3b.fal.media', 'fal.media']);

const ConfigSchema = z.object({
  apiKey:z.string().trim().min(20).max(500).regex(/^[A-Za-z0-9_-]{8,128}:[A-Za-z0-9_-]{20,256}$/),
  baseUrl:z.literal('https://fal.run').default('https://fal.run'),
}).strict();
const GenerateSchema = z.object({
  prompt:z.string().trim().min(20).max(12_000),
}).strict();
const ProviderResponseSchema = z.object({
  images:z.array(z.object({url:z.string().url(),content_type:z.string().optional(),width:z.number().int().positive().optional(),height:z.number().int().positive().optional()}).passthrough()).min(1).max(4),
  request_id:z.string().min(1).max(300).optional(),
  seed:z.number().int().optional(),
}).passthrough();

export type CreativeBuilderGeneratedImage = Readonly<{
  blindId:string;
  bytes:Buffer;
  mimeType:'image/png'|'image/jpeg'|'image/webp';
  width:number;
  height:number;
  sizeBytes:number;
  sha256:string;
  /** Server-only reveal/persistence data. Deliberately non-enumerable at runtime. */
  lineage:Readonly<{provider:'fal';model:CreativeBuilderImageModel;endpoint:string;requestId?:string;seed?:number}>;
}>;

export type CreativeBuilderImageFetch = (input:string|URL,init?:RequestInit)=>Promise<Response>;
export class CreativeBuilderImageGenerationError extends Error{
  readonly code:'invalid'|'provider_unavailable'|'provider_output'|'output_limit';
  constructor(code:CreativeBuilderImageGenerationError['code']){
    super(`Creative Builder image generation: ${code}`);
    this.name='CreativeBuilderImageGenerationError';this.code=code;
  }
}

function mediaUrl(raw:string):URL{
  let url:URL;
  try{url=new URL(raw);}catch{throw new CreativeBuilderImageGenerationError('provider_output');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!ALLOWED_MEDIA_HOSTS.has(url.hostname.toLowerCase()))throw new CreativeBuilderImageGenerationError('provider_output');
  return url;
}
function signature(bytes:Buffer):'image/png'|'image/jpeg'|'image/webp'{
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';
  if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return'image/webp';
  throw new CreativeBuilderImageGenerationError('provider_output');
}
async function boundedResponseBytes(response:Response,maxBytes:number):Promise<Buffer>{
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>maxBytes)throw new CreativeBuilderImageGenerationError('output_limit');
  if(!response.body)throw new CreativeBuilderImageGenerationError('provider_output');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(!value)continue;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new CreativeBuilderImageGenerationError('output_limit');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)),total);
}
async function providerJson(response:Response):Promise<z.infer<typeof ProviderResponseSchema>>{
  if(!response.ok)throw new CreativeBuilderImageGenerationError('provider_unavailable');
  const bytes=await boundedResponseBytes(response,MAX_PROVIDER_JSON_BYTES);
  let value:unknown;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw new CreativeBuilderImageGenerationError('provider_output');}
  const parsed=ProviderResponseSchema.safeParse(value);if(!parsed.success)throw new CreativeBuilderImageGenerationError('provider_output');return parsed.data;
}
async function validateImage(bytes:Buffer){
  const mimeType=signature(bytes);let metadata;
  try{metadata=await sharp(bytes,{failOn:'error',limitInputPixels:MAX_IMAGE_PIXELS,animated:true}).metadata();}catch{throw new CreativeBuilderImageGenerationError('provider_output');}
  const width=metadata.width??0,height=metadata.height??0;
  if(!width||!height||width!==height||width>4096||height>4096||width*height>MAX_IMAGE_PIXELS||(metadata.pages??1)!==1)throw new CreativeBuilderImageGenerationError('provider_output');
  return{mimeType,width,height};
}

export function creativeBuilderImageGenerationConfig(env:Record<string,string|undefined>){
  const parsed=ConfigSchema.safeParse({apiKey:env.CREATIVE_BUILDER_FAL_KEY,baseUrl:'https://fal.run'});
  if(!parsed.success)throw new CreativeBuilderImageGenerationError('invalid');
  return Object.freeze(parsed.data);
}

export function createCreativeBuilderImageGenerator(env:Record<string,string|undefined>,dependencies:Readonly<{fetcher?:CreativeBuilderImageFetch;randomInt?:(maxExclusive:number)=>number}>={}){
  if(typeof window!=='undefined')throw new CreativeBuilderImageGenerationError('invalid');
  const config=creativeBuilderImageGenerationConfig(env);
  const fetcher=dependencies.fetcher??fetch;
  const randomInt=dependencies.randomInt??secureRandomInt;
  async function generateOne(prompt:string,model:CreativeBuilderImageModel,index:number):Promise<CreativeBuilderGeneratedImage>{
    const descriptor=CREATIVE_BUILDER_IMAGE_MODELS[model];
    const body={prompt,[descriptor.sizeField]:descriptor.sizeValue,enable_safety_checker:true};
    let response:Response;
    try{response=await fetcher(`${config.baseUrl}/${descriptor.endpoint}`,{method:'POST',headers:{Authorization:`Key ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(FAL_TIMEOUT_MS),redirect:'error'});}catch{throw new CreativeBuilderImageGenerationError('provider_unavailable');}
    const output=await providerJson(response);const url=mediaUrl(output.images[0].url);
    let media:Response;try{media=await fetcher(url,{method:'GET',headers:{Accept:'image/png,image/jpeg,image/webp'},signal:AbortSignal.timeout(30_000),redirect:'error'});}catch{throw new CreativeBuilderImageGenerationError('provider_unavailable');}
    if(!media.ok)throw new CreativeBuilderImageGenerationError('provider_unavailable');
    const bytes=await boundedResponseBytes(media,MAX_IMAGE_BYTES);const checked=await validateImage(bytes);
    const result={blindId:`option-${String.fromCharCode(65+index)}`,bytes,mimeType:checked.mimeType,width:checked.width,height:checked.height,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')} as CreativeBuilderGeneratedImage;
    Object.defineProperty(result,'lineage',{enumerable:false,configurable:false,writable:false,value:Object.freeze({provider:'fal' as const,model,endpoint:descriptor.endpoint,...(output.request_id?{requestId:output.request_id}:{}),...(output.seed!==undefined?{seed:output.seed}:{})})});
    return Object.freeze(result);
  }
  return Object.freeze({
    async generate(input:unknown):Promise<readonly CreativeBuilderGeneratedImage[]>{
      const parsed=GenerateSchema.safeParse(input);if(!parsed.success)throw new CreativeBuilderImageGenerationError('invalid');
      // The server owns the full research panel. Browser input cannot select,
      // omit, reorder, or substitute models.
      const models=[...CREATIVE_BUILDER_IMAGE_MODEL_IDS];
      for(let index=models.length-1;index>0;index-=1){const swap=randomInt(index+1);if(!Number.isInteger(swap)||swap<0||swap>index)throw new CreativeBuilderImageGenerationError('invalid');[models[index],models[swap]]=[models[swap],models[index]];}
      const results:CreativeBuilderGeneratedImage[]=[];
      for(let index=0;index<models.length;index+=1)results.push(await generateOne(parsed.data.prompt,models[index],index));
      return Object.freeze(results);
    },
  });
}
