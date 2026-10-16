import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  CREATIVE_BUILDER_IMAGE_MODEL_IDS,
  CreativeBuilderImageGenerationError,
  createCreativeBuilderImageGenerator,
  creativeBuilderImageGenerationConfig,
  type CreativeBuilderImageFetch,
} from './creative-builder-image-generation.ts';

const KEY='fal_test_key:secret_value_for_unit_tests';
const PROMPT='Create a square paid social image with exact, legible headline and CTA text.';
const expectCode=(code:string)=>(error:unknown)=>error instanceof CreativeBuilderImageGenerationError&&error.code===code&&!error.message.includes(KEY);

async function squarePng(){return sharp({create:{width:8,height:8,channels:3,background:'#123b2e'}}).png().toBuffer();}
async function landscapePng(){return sharp({create:{width:8,height:4,channels:3,background:'#123b2e'}}).png().toBuffer();}

function mockFetcher(image:Buffer,options:Readonly<{mediaUrl?:string;providerStatus?:number;declaredImageBytes?:number}>={}){
  const calls:Array<{url:string;init?:RequestInit}>=[];
  const fetcher:CreativeBuilderImageFetch=async(input,init)=>{
    const url=String(input);calls.push({url,init});
    if(url.startsWith('https://fal.run/')){
      const status=options.providerStatus??200;
      return new Response(status===200?JSON.stringify({images:[{url:options.mediaUrl??'https://v3b.fal.media/files/test.png'}],request_id:'request-1',seed:7}):'denied',{status,headers:{'content-type':'application/json'}});
    }
    const body=image.buffer.slice(image.byteOffset,image.byteOffset+image.byteLength) as ArrayBuffer;
    return new Response(body,{status:200,headers:{'content-type':'image/png',...(options.declaredImageBytes?{'content-length':String(options.declaredImageBytes)}:{})}});
  };
  return{calls,fetcher};
}

test('server config requires a dedicated bounded FAL credential',()=>{
  assert.throws(()=>creativeBuilderImageGenerationConfig({}),expectCode('invalid'));
  assert.throws(()=>creativeBuilderImageGenerationConfig({CREATIVE_BUILDER_FAL_KEY:'short'}),expectCode('invalid'));
  const config=creativeBuilderImageGenerationConfig({CREATIVE_BUILDER_FAL_KEY:KEY});
  assert.equal(config.baseUrl,'https://fal.run');
  assert.equal(JSON.stringify(config).includes(KEY),true);
});

test('rejects browser-controlled model selection and malformed prompts before provider calls',async()=>{
  const image=await squarePng();const mock=mockFetcher(image);
  const service=createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:mock.fetcher,randomInt:()=>0});
  await assert.rejects(service.generate({prompt:PROMPT,models:['flux-2-pro']}),expectCode('invalid'));
  await assert.rejects(service.generate({prompt:'short'}),expectCode('invalid'));
  assert.equal(mock.calls.length,0);
});

test('randomizes blind labels, sends model-specific square controls, validates bytes, and returns no provider URL',async()=>{
  const image=await squarePng();const mock=mockFetcher(image);
  const service=createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:mock.fetcher,randomInt:()=>0});
  const results=await service.generate({prompt:PROMPT});
  assert.deepEqual(results.map(item=>item.lineage.model),['gpt-image-2.5-flare','nano-banana-2','flux-2-pro','recraft-v4.1','gpt-image-2.5-sunburst']);
  assert.deepEqual(results.map(item=>item.blindId),['option-A','option-B','option-C','option-D','option-E']);
  assert.ok(results.every(item=>item.width===8&&item.height===8&&item.mimeType==='image/png'&&item.sizeBytes===image.length&&/^[a-f0-9]{64}$/.test(item.sha256)));
  const publicJson=JSON.stringify(results);
  assert.equal(publicJson.includes('fal.media'),false);
  assert.doesNotMatch(publicJson,/sunburst|flare|nano-banana|flux|recraft|text-to-image/i);
  assert.ok(results.every(item=>Object.prototype.propertyIsEnumerable.call(item,'lineage')===false));
  const apiCalls=mock.calls.filter(call=>call.url.startsWith('https://fal.run/'));
  assert.equal(apiCalls.length,5);
  for(const call of apiCalls){
    assert.equal(new Headers(call.init?.headers).get('Authorization'),`Key ${KEY}`);
    assert.equal(call.init?.redirect,'error');
    const body=JSON.parse(String(call.init?.body));
    assert.equal(body.prompt,PROMPT);assert.equal(body.enable_safety_checker,true);
    if(call.url.includes('nano-banana'))assert.equal(body.aspect_ratio,'1:1');else assert.equal(body.image_size,'square_hd');
  }
  const mediaCalls=mock.calls.filter(call=>call.url.includes('fal.media'));
  assert.equal(mediaCalls.length,5);assert.ok(mediaCalls.every(call=>call.init?.redirect==='error'));
});

test('registry contains the five approved research models only',()=>{
  assert.deepEqual([...CREATIVE_BUILDER_IMAGE_MODEL_IDS].sort(),['flux-2-pro','gpt-image-2.5-flare','gpt-image-2.5-sunburst','nano-banana-2','recraft-v4.1'].sort());
});

test('rejects untrusted provider media hosts, non-square images, oversized media, and provider failures with sanitized codes',async()=>{
  const square=await squarePng();const landscape=await landscapePng();
  const hostile=mockFetcher(square,{mediaUrl:'https://127.0.0.1/secret.png'});
  await assert.rejects(createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:hostile.fetcher,randomInt:()=>0}).generate({prompt:PROMPT}),expectCode('provider_output'));
  const wrongRatio=mockFetcher(landscape);
  await assert.rejects(createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:wrongRatio.fetcher,randomInt:()=>0}).generate({prompt:PROMPT}),expectCode('provider_output'));
  const oversized=mockFetcher(square,{declaredImageBytes:13*1024*1024});
  await assert.rejects(createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:oversized.fetcher,randomInt:()=>0}).generate({prompt:PROMPT}),expectCode('output_limit'));
  const unavailable=mockFetcher(square,{providerStatus:401});
  await assert.rejects(createCreativeBuilderImageGenerator({CREATIVE_BUILDER_FAL_KEY:KEY},{fetcher:unavailable.fetcher,randomInt:()=>0}).generate({prompt:PROMPT}),expectCode('provider_unavailable'));
});
