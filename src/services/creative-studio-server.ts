import type { SupabaseClient } from '@supabase/supabase-js';
import { studioServerConfig } from './creative-studio-server-config.ts';
import { authorizeSupabaseHostedStudioIdentity } from './creative-studio-supabase-auth.ts';
import { createHostedStudioRuntime } from './creative-studio-hosted-runtime.ts';

type Config = ReturnType<typeof studioServerConfig>;
let resources: ReturnType<typeof resourcesFor> | undefined;
async function resourcesFor(config: Config) {
  const [{ Pool }, { createClient }] = await Promise.all([import('pg'), import('@supabase/supabase-js')]);
  const repositoryPool = new Pool(config.repository);
  const workerPool = new Pool(config.worker);
  // Idle connection errors must not terminate the server or expose credential-bearing details.
  repositoryPool.on('error', () => {});
  workerPool.on('error', () => {});
  return { repositoryPool, workerPool, storageClient: createClient(config.storageUrl, config.storageKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) };
}
export async function authorizeStudioServer(env: Record<string, string | undefined>, client: () => Promise<SupabaseClient>) {
  const config = studioServerConfig(env);
  const verified = await authorizeSupabaseHostedStudioIdentity(config.access, client);
  return { config, ...verified };
}
/** Injectable construction boundary: denied requests never construct pools/storage/runtime. */
export async function hostedStudioServer(env: Record<string, string | undefined>, client: () => Promise<SupabaseClient>, construct = async (authorized: Awaited<ReturnType<typeof authorizeStudioServer>>) => {
  resources ??= resourcesFor(authorized.config).catch(error => { resources = undefined; throw error; });
  return createHostedStudioRuntime({ enabled: true, context: authorized.context }, await resources);
}) {
  const authorized = await authorizeStudioServer(env, client);
  return { identity: authorized.identity, service: await construct(authorized) };
}
