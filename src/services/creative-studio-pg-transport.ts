import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { StudioRpcArguments, TrustedStudioRpcTransport, VerifiedStudioContext } from './creative-studio-repository.ts';

const Context = z.object({ tenantId: z.literal('eicagency'), ownerId: z.string().uuid() }).strict();
const queries = Object.freeze({
  create_artwork: 'SELECT creative_studio.create_artwork($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) AS data',
  review_asset: 'SELECT creative_studio.review_asset($1::uuid,$2::uuid,$3::uuid,$4::boolean) AS data',
  approve: 'SELECT creative_studio.approve($1::uuid,$2::uuid) AS data',
  save_version: 'SELECT creative_studio.save_version($1::uuid,$2::uuid,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb) AS data',
  enqueue: 'SELECT creative_studio.enqueue($1::uuid,$2::uuid,$3::text) AS data',
  save_direction: 'SELECT creative_studio.save_direction($1::uuid,$2::uuid,$3::jsonb,$4::jsonb,$5::jsonb) AS data',
  list_projects: 'SELECT row_to_json(p) AS data FROM creative_studio.list_projects($1::integer,$2::timestamptz,$3::uuid) AS p ORDER BY p.created_at,p.id',
  read_project: 'SELECT creative_studio.read_project($1::uuid) AS data',
});

/** Server-only capability. The caller must authenticate/allowlist the owner BEFORE construction.
 * This validates shape, not identity. Inject a dedicated pool; no env, JWT signing or network defaults.
 * Provision creative_studio_repository NOLOGIN NOBYPASSRLS with ONLY explicitly allowlisted RPC grants.
 * Its login must have no table rights and only membership in that role (never service_role).
 */
export function createStudioPgTransport(pool: Pick<Pool, 'connect'>, context: VerifiedStudioContext): TrustedStudioRpcTransport {
  if (typeof window !== 'undefined') throw new Error('Studio transport denied');
  const parsed = Context.safeParse(context);
  if (!parsed.success) throw new Error('Studio transport denied');
  const actor = Object.freeze(parsed.data);
  const claims = JSON.stringify({ role: 'service_role', creative_studio_tenant: actor.tenantId, creative_studio_owner: actor.ownerId });
  return Object.freeze({
    context: actor,
    async invoke<K extends keyof StudioRpcArguments>(schema: 'creative_studio', name: K, args: StudioRpcArguments[K]) {
      if (schema !== 'creative_studio' || !Object.hasOwn(queries, name)) return { data: null, error: { code: '42501' } };
      let client: PoolClient | undefined;
      let broken = false;
      try {
        let values: unknown[];
        switch (name) {
          case 'create_artwork': {
            const a=args as StudioRpcArguments['create_artwork'];
            values=[JSON.stringify(a.p_brief),JSON.stringify(a.p_scene),JSON.stringify(a.p_sources),JSON.stringify(a.p_recipes)];break;
          }
          case 'review_asset': {
            const a=args as StudioRpcArguments['review_asset'];
            values=[a.p_project,a.p_expected,a.p_asset,a.p_approved];break;
          }
          case 'approve': {
            const a=args as StudioRpcArguments['approve'];
            values=[a.p_project,a.p_expected];break;
          }
          case 'save_version': {
            const a = args as StudioRpcArguments['save_version'];
            values = [a.p_project,a.p_expected,JSON.stringify(a.p_brief),JSON.stringify(a.p_scene),JSON.stringify(a.p_sources),JSON.stringify(a.p_recipes)];
            break;
          }
          case 'enqueue': {
            const a = args as StudioRpcArguments['enqueue'];
            values = [a.p_project,a.p_expected,a.p_placement];
            break;
          }
          case 'save_direction': {
            const a = args as StudioRpcArguments['save_direction'];
            values = [a.p_project, a.p_expected, a.p_planning_brief === null ? null : JSON.stringify(a.p_planning_brief), JSON.stringify(a.p_direction), JSON.stringify(a.p_style_snapshot)];
            break;
          }
          case 'list_projects': {
            const a = args as StudioRpcArguments['list_projects'];
            values = [a.p_limit, a.p_after_created_at, a.p_after_id];
            break;
          }
          case 'read_project': values = [(args as StudioRpcArguments['read_project']).p_project]; break;
          default: return { data: null, error: { code: '42501' } };
        }
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE creative_studio_repository');
        await client.query("SELECT set_config('request.jwt.claims',$1,true), set_config('statement_timeout','10000',true), set_config('search_path','pg_catalog',true)", [claims]);
        const result = await client.query<{ data: unknown }>(queries[name], values);
        await client.query('COMMIT');
        return { data: name === 'list_projects' ? result.rows.map(row => row.data) : result.rows[0]?.data, error: null };
      } catch (error) {
        if (client) {
          try { await client.query('ROLLBACK'); } catch { broken = true; }
        }
        const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : undefined;
        return { data: null, error: code ? { code } : {} };
      } finally {
        client?.release(broken);
      }
    },
  });
}
