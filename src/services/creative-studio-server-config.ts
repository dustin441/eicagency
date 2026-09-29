import { HostedStudioAccessError, hostedStudioAccessConfig } from '../lib/creative-studio/hosted-access.ts';

export function studioServerConfig(env: Record<string, string | undefined>) {
  if (typeof window !== 'undefined') throw new HostedStudioAccessError(503);
  const access = hostedStudioAccessConfig(env);
  if (!access.enabled) throw new HostedStudioAccessError(503);
  const database = (value: string | undefined) => {
    try {
      const url = new URL(value ?? '');
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2 || url.search || url.hash) throw new Error();
      return url;
    } catch { throw new HostedStudioAccessError(503); }
  };
  const repository = database(env.CREATIVE_STUDIO_REPOSITORY_DATABASE_URL);
  const worker = database(env.CREATIVE_STUDIO_WORKER_DATABASE_URL);
  if (repository.username === worker.username) throw new HostedStudioAccessError(503);
  let storageUrl: URL;
  try {
    storageUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (storageUrl.protocol !== 'https:' || storageUrl.username || storageUrl.password || storageUrl.search || storageUrl.hash || storageUrl.pathname !== '/') throw new Error();
  } catch { throw new HostedStudioAccessError(503); }
  const storageKey = env.CREATIVE_STUDIO_STORAGE_KEY;
  if (!storageKey?.trim()) throw new HostedStudioAccessError(503);
  // Explicit TLS verification in every environment. URL query overrides are rejected above.
  // Supabase's database/pooler uses its published CA rather than a system root.
  const ca = env.CREATIVE_STUDIO_DATABASE_CA?.replace(/\\n/g, '\n').trim();
  if (ca && (!ca.startsWith('-----BEGIN CERTIFICATE-----') || !ca.endsWith('-----END CERTIFICATE-----'))) throw new HostedStudioAccessError(503);
  const pool = (url: URL) => ({ connectionString: url.toString(), ssl: { rejectUnauthorized: true as const, ...(ca ? { ca } : {}) }, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 20000, allowExitOnIdle: true });
  return { access, repository: pool(repository), worker: pool(worker), storageUrl: storageUrl.origin, storageKey };
}
