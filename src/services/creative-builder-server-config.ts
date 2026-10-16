import 'server-only';

export class CreativeBuilderConfigError extends Error {
  readonly status = 503;
  constructor() {
    super('Creative Builder is unavailable.');
    this.name = 'CreativeBuilderConfigError';
  }
}

type Environment = Record<string, string | undefined>;
export type CreativeBuilderModelConfig = Readonly<{
  provider: 'openrouter';
  apiKey: string;
  strategyModel: string;
  qaModel: string;
}>;

const DEFAULT_STRATEGY_MODEL = 'anthropic/claude-sonnet-4.6';
const DEFAULT_QA_MODEL = 'google/gemini-3.1-pro-preview';
const OPENROUTER_KEY = /^sk-or-v1-[a-f0-9]{64}$/;
const OPENROUTER_MODEL = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

function databaseUrl(value: string | undefined): URL {
  try {
    const url = new URL(value ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2 || url.search || url.hash) throw new Error();
    return url;
  } catch {
    throw new CreativeBuilderConfigError();
  }
}

/** Fail-closed server bootstrap. No client code should import or serialize its result. */
export function creativeBuilderServerConfig(env: Environment) {
  if (typeof window !== 'undefined' || env.CREATIVE_BUILDER_ENABLED !== 'true') throw new CreativeBuilderConfigError();

  const repositoryUrl = databaseUrl(env.CREATIVE_BUILDER_REPOSITORY_DATABASE_URL);
  const workerUrl = databaseUrl(env.CREATIVE_BUILDER_WORKER_DATABASE_URL);
  if (repositoryUrl.username === workerUrl.username) throw new CreativeBuilderConfigError();

  let storageUrl: URL;
  try {
    storageUrl = new URL(env.CREATIVE_BUILDER_STORAGE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (storageUrl.protocol !== 'https:' || storageUrl.username || storageUrl.password || storageUrl.pathname !== '/' || storageUrl.search || storageUrl.hash) throw new Error();
  } catch {
    throw new CreativeBuilderConfigError();
  }

  const storageKey = env.CREATIVE_BUILDER_STORAGE_KEY?.trim();
  const modelApiKey = env.CREATIVE_BUILDER_OPENROUTER_API_KEY;
  const strategyModel = env.CREATIVE_BUILDER_STRATEGY_MODEL ?? DEFAULT_STRATEGY_MODEL;
  const qaModel = env.CREATIVE_BUILDER_QA_MODEL ?? DEFAULT_QA_MODEL;
  if (!storageKey || !modelApiKey || !OPENROUTER_KEY.test(modelApiKey) || !OPENROUTER_MODEL.test(strategyModel) || !OPENROUTER_MODEL.test(qaModel) || qaModel === strategyModel) throw new CreativeBuilderConfigError();

  const ca = env.CREATIVE_BUILDER_DATABASE_CA?.replace(/\\n/g, '\n').trim();
  if (ca && (!ca.startsWith('-----BEGIN CERTIFICATE-----') || !ca.endsWith('-----END CERTIFICATE-----'))) throw new CreativeBuilderConfigError();

  const pool = (url: URL) => Object.freeze({
    connectionString: url.toString(),
    ssl: Object.freeze({ rejectUnauthorized: true as const, ...(ca ? { ca } : {}) }),
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    allowExitOnIdle: true,
  });

  return Object.freeze({
    enabled: true as const,
    repository: pool(repositoryUrl),
    worker: pool(workerUrl),
    storageUrl: storageUrl.origin,
    storageKey,
    model: Object.freeze({provider:'openrouter' as const,apiKey:modelApiKey,strategyModel,qaModel}),
  });
}

/** Fail-closed bootstrap used only by the secret-protected lifecycle route. */
export function creativeBuilderLifecycleConfig(env: Environment) {
  if (typeof window !== 'undefined' || env.CREATIVE_BUILDER_ENABLED !== 'true') throw new CreativeBuilderConfigError();
  const workerUrl = databaseUrl(env.CREATIVE_BUILDER_WORKER_DATABASE_URL);
  let storageUrl: URL;
  try {
    storageUrl = new URL(env.CREATIVE_BUILDER_STORAGE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (storageUrl.protocol !== 'https:' || storageUrl.username || storageUrl.password || storageUrl.pathname !== '/' || storageUrl.search || storageUrl.hash) throw new Error();
  } catch { throw new CreativeBuilderConfigError(); }
  const storageKey = env.CREATIVE_BUILDER_STORAGE_KEY?.trim();
  const routeSecret = env.CREATIVE_BUILDER_CLEANUP_TOKEN;
  if (!storageKey || !routeSecret || routeSecret !== routeSecret.trim() || routeSecret.length < 32) throw new CreativeBuilderConfigError();
  const ca = env.CREATIVE_BUILDER_DATABASE_CA?.replace(/\\n/g, '\n').trim();
  if (ca && (!ca.startsWith('-----BEGIN CERTIFICATE-----') || !ca.endsWith('-----END CERTIFICATE-----'))) throw new CreativeBuilderConfigError();
  return Object.freeze({
    worker: Object.freeze({connectionString: workerUrl.toString(), ssl: Object.freeze({rejectUnauthorized: true as const, ...(ca ? {ca} : {})}), max: 2, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000, statement_timeout: 15_000, query_timeout: 20_000, allowExitOnIdle: true}),
    storageUrl: storageUrl.origin, storageKey, routeSecret,
  });
}
