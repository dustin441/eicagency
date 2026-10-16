import test from 'node:test';
import assert from 'node:assert/strict';
import {CreativeBuilderImageQaError,createOpenRouterImageQa} from './creative-builder-image-qa.ts';

const config={provider:'openrouter' as const,apiKey:`sk-or-v1-${'a'.repeat(64)}`,strategyModel:'anthropic/claude-sonnet-4.6',qaModel:'google/gemini-3.1-pro-preview'};
const brief='Create a square EIC ad with the exact required headline and schedule-a-call CTA.';
const output={messageClarity:5,textAccuracy:5,brandFit:4,distinctiveness:4,visualQuality:4,trust:5,launchReadiness:4,hardFailures:[],summary:'Clear and credible.',recommendation:'advance'} as const;
const expectCode=(code:string)=>(error:unknown)=>error instanceof CreativeBuilderImageQaError&&error.code===code&&!error.message.includes(config.apiKey);

function dependencies(overrides:Readonly<{output?:unknown;outputTokens?:number;failure?:Error}>={}){
  const providerCalls:unknown[]=[];const generationCalls:unknown[]=[];const model={kind:'qa-model'};
  return{
    providerCalls,generationCalls,
    dependencies:{
      createProvider(settings:unknown){providerCalls.push(settings);return{chat(modelId:string){providerCalls.push(modelId);return model as never;}} as never;},
      async generate(options:unknown){generationCalls.push(options);if(overrides.failure)throw overrides.failure;return{object:overrides.output??output,usage:{outputTokens:overrides.outputTokens??95}} as never;},
    },
  };
}

test('independent QA uses only the dedicated QA model and blind option identity',async()=>{
  const fake=dependencies();const qa=createOpenRouterImageQa(config,fake.dependencies);
  const result=await qa.judge({promptVersion:'eic-white-label-v1',brief,images:[{blindId:'option-A',bytes:Buffer.from([1,2,3]),mimeType:'image/png'}]});
  assert.deepEqual(fake.providerCalls,[{apiKey:config.apiKey,baseURL:'https://openrouter.ai/api/v1'},config.qaModel]);
  assert.equal(result[0].blindId,'option-A');
  assert.deepEqual(result[0].lineage,{provider:'openrouter',model:config.qaModel,promptVersion:'eic-white-label-v1',outputTokens:95});
  const serialized=JSON.stringify(fake.generationCalls);
  assert.match(serialized,/option-A/);assert.doesNotMatch(serialized,/sunburst|flare|nano-banana|flux|recraft/i);
  const options=fake.generationCalls[0] as {maxOutputTokens:number;maxRetries:number;abortSignal:AbortSignal;messages:unknown[]};
  assert.equal(options.maxOutputTokens,1200);assert.equal(options.maxRetries,0);assert.ok(options.abortSignal instanceof AbortSignal);assert.equal(options.messages.length,1);
});

test('QA input rejects model metadata, duplicate labels, malformed labels, and oversized images before model execution',async()=>{
  const fake=dependencies();const qa=createOpenRouterImageQa(config,fake.dependencies);
  await assert.rejects(qa.judge({promptVersion:'v1',brief,images:[{blindId:'option-A',bytes:Buffer.from([1]),mimeType:'image/png',model:'flux-2-pro'}]}),expectCode('invalid'));
  await assert.rejects(qa.judge({promptVersion:'v1',brief,images:[{blindId:'option-A',bytes:Buffer.from([1]),mimeType:'image/png'},{blindId:'option-A',bytes:Buffer.from([2]),mimeType:'image/png'}]}),expectCode('invalid'));
  await assert.rejects(qa.judge({promptVersion:'v1',brief,images:[{blindId:'flux-2-pro',bytes:Buffer.from([1]),mimeType:'image/png'}]}),expectCode('invalid'));
  await assert.rejects(qa.judge({promptVersion:'v1',brief,images:[{blindId:'option-A',bytes:Buffer.alloc(12*1024*1024+1),mimeType:'image/png'}]}),expectCode('invalid'));
  assert.equal(fake.generationCalls.length,0);
});

test('QA sanitizes provider failures and rejects malformed or over-limit model output',async()=>{
  const input={promptVersion:'v1',brief,images:[{blindId:'option-A',bytes:Buffer.from([1]),mimeType:'image/png'}]};
  const failed=dependencies({failure:new Error(`401 ${config.apiKey} private body`)});
  await assert.rejects(createOpenRouterImageQa(config,failed.dependencies).judge(input),expectCode('provider_unavailable'));
  const malformed=dependencies({output:{recommendation:'advance'}});
  await assert.rejects(createOpenRouterImageQa(config,malformed.dependencies).judge(input),expectCode('invalid_output'));
  const over=dependencies({outputTokens:1201});
  await assert.rejects(createOpenRouterImageQa(config,over.dependencies).judge(input),expectCode('output_limit'));
});
