import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {NoObjectGeneratedError} from 'ai';
import {CreativeBuilderAiError, type StructuredModelRequest} from './creative-builder-ai.ts';
import {createOpenRouterStructuredModelExecutor} from './creative-builder-openrouter.ts';

const config={
  provider:'openrouter' as const,
  apiKey:`sk-or-v1-${'a'.repeat(64)}`,
  strategyModel:'anthropic/claude-sonnet-4.6',
  conceptModel:'openai/gpt-4.1-mini',
  qaModel:'google/gemini-3.1-pro-preview',
};
const request:StructuredModelRequest={
  operation:'analysis',system:'system',prompt:'prompt',schema:z.object({answer:z.string()}).strict(),maxOutputTokens:2400,timeoutMs:45_000,
};

test('OpenRouter executor uses only trusted server config and preserves bounded structured generation settings',async()=>{
  const providerCalls:unknown[]=[];
  const generationCalls:unknown[]=[];
  const strategyModel=Object.freeze({kind:'strategy-model'});
  const conceptModel=Object.freeze({kind:'concept-model'});
  const executor=createOpenRouterStructuredModelExecutor(config,{
    createProvider(settings){providerCalls.push(settings);return {chat(modelId:string){providerCalls.push(modelId);return (modelId===config.strategyModel?strategyModel:conceptModel) as never;}} as never;},
    async generate(options){generationCalls.push(options);return {object:{answer:'ok'},usage:{outputTokens:12}} as never;},
  });
  assert.deepEqual(await executor.execute(request),{output:{answer:'ok'},outputTokens:12});
  assert.deepEqual(providerCalls,[{apiKey:config.apiKey,baseURL:'https://openrouter.ai/api/v1'},config.strategyModel,config.conceptModel]);
  const options=generationCalls[0] as Record<string,unknown>;
  assert.equal(options.model,strategyModel);
  assert.equal(options.system,request.system);
  assert.equal(options.prompt,request.prompt);
  assert.equal(options.schema,request.schema);
  assert.equal(options.maxOutputTokens,request.maxOutputTokens);
  assert.equal(options.temperature,0);
  assert.equal(options.maxRetries,0);
  assert.ok(options.abortSignal instanceof AbortSignal);
  await executor.execute({...request,operation:'generation'});
  assert.equal((generationCalls[1] as Record<string,unknown>).model,conceptModel);
  await executor.execute({...request,operation:'revision',revisionTarget:'plan'});
  await executor.execute({...request,operation:'revision',revisionTarget:'portfolio'});
  await executor.execute({...request,operation:'revision',revisionTarget:'concept'});
  assert.equal((generationCalls[2] as Record<string,unknown>).model,strategyModel);
  assert.equal((generationCalls[3] as Record<string,unknown>).model,conceptModel);
  assert.equal((generationCalls[4] as Record<string,unknown>).model,conceptModel);
});

test('OpenRouter executor sanitizes provider errors without leaking credentials or response bodies',async()=>{
  const logs:unknown[][]=[];const original=console.error;console.error=(...values:unknown[])=>{logs.push(values);};
  const executor=createOpenRouterStructuredModelExecutor(config,{
    createProvider(){return {chat(){return {} as never;}} as never;},
    async generate(){const failure=new Error('upstream response body');failure.name=config.apiKey;throw failure;},
  });
  try{
    await assert.rejects(executor.execute(request),(error:unknown)=>
      error instanceof CreativeBuilderAiError &&
      error.code==='provider_unavailable' &&
      error.message==='The Creative Builder model is temporarily unavailable.' &&
      !error.message.includes(config.apiKey) &&
      error.cause===undefined
    );
  }finally{console.error=original;}
  assert.equal(JSON.stringify(logs).includes(config.apiKey),false);
  assert.match(JSON.stringify(logs),/UnknownError/);
});

test('OpenRouter executor classifies schema generation failures without retaining model text',async()=>{
  const original=console.error;console.error=()=>{};
  const executor=createOpenRouterStructuredModelExecutor(config,{
    createProvider(){return {chat(){return {} as never;}} as never;},
    async generate(){throw new NoObjectGeneratedError({message:'invalid object',text:`private ${config.apiKey}`,response:{} as never,usage:{} as never,finishReason:'stop'});},
  });
  try{await assert.rejects(executor.execute(request),(error:unknown)=>error instanceof CreativeBuilderAiError&&error.code==='invalid_output'&&!error.message.includes(config.apiKey)&&error.cause===undefined);}
  finally{console.error=original;}
});

test('OpenRouter executor also sanitizes provider initialization failures',()=>{
  assert.throws(()=>createOpenRouterStructuredModelExecutor(config,{
    createProvider(){throw new Error(`invalid credential ${config.apiKey}`);},
    async generate(){throw new Error('must not execute');},
  }),(error:unknown)=>error instanceof CreativeBuilderAiError&&error.code==='provider_unavailable'&&!error.message.includes(config.apiKey)&&error.cause===undefined);
});