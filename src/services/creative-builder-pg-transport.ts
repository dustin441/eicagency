import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { CreativeBuilderRpcArguments, TrustedCreativeBuilderRpcTransport, VerifiedCreativeBuilderContext } from './creative-builder-repository.ts';

const Context = z.object({ tenantId: z.literal('eicagency'), ownerId: z.string().uuid() }).strict();
export type CreativeBuilderDatabaseCapability = 'repository' | 'worker';

const queries = Object.freeze({
  create_project: 'SELECT creative_builder.create_project($1::text) AS data',
  list_projects: 'SELECT row_to_json(p) AS data FROM creative_builder.list_projects($1::integer,$2::timestamptz,$3::uuid) AS p ORDER BY p.created_at,p.id',
  read_project: 'SELECT creative_builder.read_project($1::uuid) AS data',
  read_project_canonical: 'SELECT creative_builder.read_project_canonical($1::uuid) AS data',
  edit_plan: 'SELECT creative_builder.edit_plan($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::jsonb,$6::jsonb,$7::text) AS data',
  confirm_plan: 'SELECT creative_builder.confirm_plan($1::uuid,$2::uuid,$3::integer) AS data',
  reserve_job: 'SELECT creative_builder.reserve_job($1::uuid,$2::integer,$3::text,$4::text,$5::integer,$6::bigint,$7::text,$8::uuid) AS data',
  select_concept: 'SELECT creative_builder.select_concept($1::uuid,$2::integer,$3::uuid,$4::uuid,$5::text,$6::uuid[]) AS data',
  link_studio_output: 'SELECT creative_builder.link_studio_output($1::uuid,$2::integer,$3::uuid,$4::uuid,$5::uuid) AS data',
  transition_job: 'SELECT creative_builder.transition_job($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::text,$6::integer,$7::text,$8::integer) AS data',
  renew_job: 'SELECT creative_builder.renew_job($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::text,$6::integer,$7::integer) AS data',
  commit_analysis: 'SELECT creative_builder.commit_analysis($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::integer,$6::jsonb,$7::text,$8::jsonb,$9::jsonb,$10::text,$11::jsonb) AS data',
  commit_concepts: 'SELECT creative_builder.commit_concepts($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::integer,$6::uuid,$7::jsonb) AS data',
  commit_revision: 'SELECT creative_builder.commit_revision($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::integer,$6::text,$7::uuid,$8::text,$9::jsonb,$10::text,$11::text) AS data',
  import_asset_receipt: 'SELECT creative_builder.import_asset_receipt($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::integer,$6::uuid,$7::text,$8::text,$9::text,$10::text,$11::integer,$12::integer,$13::bigint) AS data',
  fail_job: 'SELECT creative_builder.fail_job($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::text,$6::integer,$7::text) AS data',
  recover_job: 'SELECT creative_builder.recover_job($1::uuid,$2::uuid,$3::text,$4::integer) AS data',
});

const repositoryNames = new Set<keyof CreativeBuilderRpcArguments>(['create_project', 'list_projects', 'read_project', 'edit_plan', 'confirm_plan', 'reserve_job', 'select_concept', 'link_studio_output']);
const workerNames = new Set<keyof CreativeBuilderRpcArguments>(['read_project', 'read_project_canonical', 'transition_job', 'renew_job', 'commit_analysis', 'commit_concepts', 'commit_revision', 'import_asset_receipt', 'fail_job', 'recover_job']);
const json = (value: unknown) => JSON.stringify(value);

function valuesFor<K extends keyof CreativeBuilderRpcArguments>(name: K, args: CreativeBuilderRpcArguments[K]): unknown[] {
  switch (name) {
    case 'create_project': { const a = args as CreativeBuilderRpcArguments['create_project']; return [a.p_normalized_url]; }
    case 'list_projects': { const a = args as CreativeBuilderRpcArguments['list_projects']; return [a.p_limit, a.p_after_created_at, a.p_after_id]; }
    case 'read_project': return [(args as CreativeBuilderRpcArguments['read_project']).p_project];
    case 'read_project_canonical': return [(args as CreativeBuilderRpcArguments['read_project_canonical']).p_project];
    case 'edit_plan': { const a = args as CreativeBuilderRpcArguments['edit_plan']; return [a.p_project, a.p_expected_plan, a.p_expected_revision, a.p_scan, json(a.p_assumptions), json(a.p_channels), a.p_assumptions_hash]; }
    case 'confirm_plan': { const a = args as CreativeBuilderRpcArguments['confirm_plan']; return [a.p_project, a.p_expected_plan, a.p_expected_revision]; }
    case 'reserve_job': { const a = args as CreativeBuilderRpcArguments['reserve_job']; return [a.p_project, a.p_expected_revision, a.p_operation, a.p_idempotency_key, a.p_reserved_units, a.p_reserved_bytes, a.p_target_kind, a.p_target_id]; }
    case 'select_concept': { const a = args as CreativeBuilderRpcArguments['select_concept']; return [a.p_project, a.p_expected_revision, a.p_expected_concept_set, a.p_expected_concept_revision, a.p_concept_handle, a.p_ordered_asset_ids]; }
    case 'link_studio_output': { const a = args as CreativeBuilderRpcArguments['link_studio_output']; return [a.p_project, a.p_expected_revision, a.p_expected_selection, a.p_studio_project, a.p_studio_version]; }
    case 'transition_job': { const a = args as CreativeBuilderRpcArguments['transition_job']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_operation, a.p_expected_revision, a.p_state, a.p_model_timeout_seconds]; }
    case 'renew_job': { const a = args as CreativeBuilderRpcArguments['renew_job']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_operation, a.p_expected_revision, a.p_seconds]; }
    case 'commit_analysis': { const a = args as CreativeBuilderRpcArguments['commit_analysis']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_expected_revision, json(a.p_receipt), a.p_receipt_sha256, json(a.p_assumptions), json(a.p_channels), a.p_assumptions_hash, json(a.p_previews)]; }
    case 'commit_concepts': { const a = args as CreativeBuilderRpcArguments['commit_concepts']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_expected_revision, a.p_confirmed_plan, json(a.p_portfolio)]; }
    case 'commit_revision': { const a = args as CreativeBuilderRpcArguments['commit_revision']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_expected_project_revision, a.p_target, a.p_expected_target, a.p_concept_handle, json(a.p_payload), a.p_user_message, a.p_assistant_message]; }
    case 'import_asset_receipt': { const a = args as CreativeBuilderRpcArguments['import_asset_receipt']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_expected_revision, a.p_scan, a.p_candidate_id, a.p_object_key, a.p_sha256, a.p_mime, a.p_width, a.p_height, a.p_bytes]; }
    case 'fail_job': { const a = args as CreativeBuilderRpcArguments['fail_job']; return [a.p_job, a.p_token, a.p_generation, a.p_project, a.p_operation, a.p_expected_revision, a.p_error_code]; }
    case 'recover_job': { const a = args as CreativeBuilderRpcArguments['recover_job']; return [a.p_job, a.p_project, a.p_operation, a.p_expected_revision]; }
    default: return [];
  }
}

/** Owner-bound SQL capability. The caller must authenticate and authorize before construction. */
export function createCreativeBuilderPgTransport(pool: Pick<Pool, 'connect'>, context: VerifiedCreativeBuilderContext, capability: CreativeBuilderDatabaseCapability = 'repository'): TrustedCreativeBuilderRpcTransport {
  if (typeof window !== 'undefined') throw new Error('Creative Builder transport denied');
  const parsed = Context.safeParse(context);
  if (!parsed.success || !['repository', 'worker'].includes(capability)) throw new Error('Creative Builder transport denied');
  const actor = Object.freeze(parsed.data);
  const claims = JSON.stringify({ role: 'service_role', creative_builder_tenant: actor.tenantId, creative_builder_owner: actor.ownerId });
  const allowlist = capability === 'repository' ? repositoryNames : workerNames;
  const role = capability === 'repository' ? 'creative_builder_repository' : 'creative_builder_worker';

  return Object.freeze({
    context: actor,
    async invoke<K extends keyof CreativeBuilderRpcArguments>(schema: 'creative_builder', name: K, args: CreativeBuilderRpcArguments[K]) {
      if (schema !== 'creative_builder' || !Object.hasOwn(queries, name) || !allowlist.has(name)) return { data: null, error: { code: '42501' } };
      let client: PoolClient | undefined;
      let broken = false;
      try {
        const values = valuesFor(name, args);
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query(`SET LOCAL ROLE ${role}`);
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
