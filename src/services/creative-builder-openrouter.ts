import 'server-only';
import {createOpenAI} from '@ai-sdk/openai';
import {generateObject,NoObjectGeneratedError} from 'ai';
import {
  CreativeBuilderAiError,
  createCreativeBuilderAi,
  type CanonicalStrategyLoader,
  type StructuredModelExecutor,
  type StructuredModelRequest,
} from './creative-builder-ai.ts';
import type {CreativeBuilderModelConfig} from './creative-builder-server-config.ts';

const OPENROUTER_BASE_URL='https://openrouter.ai/api/v1';

type OpenRouterDependencies=Readonly<{
  createProvider: typeof createOpenAI;
  generate: typeof generateObject;
}>;

const productionDependencies:OpenRouterDependencies={createProvider:createOpenAI,generate:generateObject};

export function createOpenRouterStructuredModelExecutor(
  config:CreativeBuilderModelConfig,
  dependencies:OpenRouterDependencies=productionDependencies,
):StructuredModelExecutor {
  let strategyModel:ReturnType<ReturnType<typeof createOpenAI>['chat']>;
  let conceptModel:ReturnType<ReturnType<typeof createOpenAI>['chat']>;
  try {
    const provider=dependencies.createProvider({apiKey:config.apiKey,baseURL:OPENROUTER_BASE_URL});
    strategyModel=provider.chat(config.strategyModel);
    conceptModel=provider.chat(config.conceptModel);
  } catch {
    throw new CreativeBuilderAiError('provider_unavailable');
  }
  return Object.freeze({
    async execute(request:StructuredModelRequest) {
      if((request.operation==='revision')!==Boolean(request.revisionTarget))throw new CreativeBuilderAiError('invalid_input');
      const useStrategy=request.operation==='analysis'||(request.operation==='revision'&&request.revisionTarget==='plan');
      try {
        const result=await dependencies.generate({
          model:useStrategy?strategyModel:conceptModel,
          system:request.system,
          prompt:request.prompt,
          schema:request.schema,
          maxOutputTokens:request.maxOutputTokens,
          temperature:0,
          maxRetries:0,
          abortSignal:AbortSignal.timeout(request.timeoutMs),
        });
        return {output:result.object,outputTokens:result.usage.outputTokens};
      } catch (error) {
        const failure=error as {name?:unknown;statusCode?:unknown;isRetryable?:unknown};
        const knownNames=new Set(['AI_APICallError','AI_NoObjectGeneratedError','AI_RetryError','AbortError','TimeoutError']);
        console.error('Creative Builder model call failed',{
          operation:request.operation,
          role:useStrategy?'strategy':'concept',
          name:typeof failure?.name==='string'&&knownNames.has(failure.name)?failure.name:'UnknownError',
          statusCode:typeof failure?.statusCode==='number'?failure.statusCode:null,
          retryable:typeof failure?.isRetryable==='boolean'?failure.isRetryable:null,
        });
        if(NoObjectGeneratedError.isInstance(error))throw new CreativeBuilderAiError('invalid_output');
        throw new CreativeBuilderAiError('provider_unavailable');
      }
    },
  });
}

export function createProductionCreativeBuilderAi(canonicalLoader:CanonicalStrategyLoader,config:CreativeBuilderModelConfig){
  return createCreativeBuilderAi(createOpenRouterStructuredModelExecutor(config),canonicalLoader);
}