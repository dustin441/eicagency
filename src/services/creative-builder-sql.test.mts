import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../../supabase/creative_builder.sql', import.meta.url), 'utf8');

const requiredTables = ['projects','scans','plan_revisions','concept_sets','concept_revisions','selections','messages','source_assets','candidate_previews','jobs','daily_usage','preview_upload_attempts'];
const requiredRpcs = [
  'create_project','list_projects','read_project','read_project_canonical','edit_plan','confirm_plan','reserve_job',
  'transition_job','renew_job','register_preview_upload','commit_analysis','commit_concepts','commit_revision',
  'import_asset_receipt','select_concept','link_studio_output','fail_job','recover_job',
];

test('migration is additive, collision-sensitive, and defines the complete protected model', () => {
  assert.match(sql, /BEGIN;\s*CREATE ROLE creative_builder_repository/);
  assert.match(sql, /CREATE SCHEMA creative_builder;/);
  assert.doesNotMatch(sql, /CREATE (?:OR REPLACE|TABLE IF NOT EXISTS|SCHEMA IF NOT EXISTS)/i);
  for (const table of requiredTables) assert.match(sql, new RegExp(`CREATE TABLE creative_builder\\.${table} \\(`));
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA creative_builder FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
});

test('only exact security-definer RPC signatures are granted to dedicated roles', () => {
  for (const rpc of requiredRpcs) assert.match(sql, new RegExp(`CREATE FUNCTION creative_builder\\.${rpc}\\(`));
  assert.match(sql, /CREATE ROLE creative_builder_repository NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS/);
  assert.match(sql, /CREATE ROLE creative_builder_worker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL).*TABLE/i);
  assert.match(sql, /claims->>'creative_builder_tenant' IS DISTINCT FROM 'eicagency'/);
  assert.match(sql, /claims->>'creative_builder_owner'/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.read_project\(p_project uuid\)[\s\S]*'candidates'[\s\S]*candidate-'sourceUrl'-'sourceExcerptIds'/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.read_project_canonical\(p_project uuid\)[\s\S]*'receipt',s\.receipt/);
  const repositoryGrant = sql.match(/GRANT EXECUTE ON FUNCTION ([^;]+) TO creative_builder_repository;/)?.[1] ?? '';
  const workerGrant = sql.match(/GRANT EXECUTE ON FUNCTION ([^;]+) TO creative_builder_worker;/)?.[1] ?? '';
  assert(!repositoryGrant.includes('read_project_canonical'));
  assert(workerGrant.includes('read_project_canonical(uuid)'));
});

test('hard bounds, append-only history, fencing, quotas, and tombstone controls live in SQL', () => {
  for (const token of ['pg_column_size','fencing_generation','model_deadline','reserved_units','completed_units','tombstoned_at','cleanup_state','latest_selection_id']) assert.ok(sql.includes(token), `missing ${token}`);
  for (const table of ['scans','plan_revisions','concept_sets','concept_revisions','selections','messages','source_assets','candidate_previews']) {
    assert.match(sql, new RegExp(`CREATE TRIGGER builder_${table}_immutable`));
  }
  assert.match(sql, /analysis[\s\S]*generation[\s\S]*revision[\s\S]*source_import[\s\S]*cleanup/);
  assert.match(sql, /reserved[\s\S]*scanning[\s\S]*model_started[\s\S]*committing[\s\S]*completed[\s\S]*failed/);
  assert.match(sql, /attempts BETWEEN 1 AND 3/);
  assert.match(sql, /owner_daily_limit/);
  assert.match(sql, /tenant_daily_limit/);
  assert.match(sql, /tenant_concurrent_limit/);
  assert.match(sql, /builder-live:tenant:eicagency/);
  assert.match(sql, /builder-live:owner:/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.recover_job[\s\S]*builder-live:tenant:eicagency[\s\S]*builder-live:owner:[\s\S]*Owner job busy[\s\S]*Tenant concurrency exceeded/);
  assert.match(sql, /target_kind text CHECK \(target_kind IN \('plan','portfolio','concept'\)\)/);
  assert.match(sql, /job_target_is_current/);
  assert.match(sql, /Invalid unconfirmed claims/);
  assert.match(sql, /Invalid claim identities/);
  assert.match(sql, /confirmed_hash:=encode\(sha256\(convert_to\(confirmed_assumptions::text\|\|old\.channels::text/);
  assert.match(sql, /claim->>'kind' IN \('price','percentage','guarantee','testimonial','comparison','result','operational'\)/);
  assert.match(sql, /j\.target_id IS DISTINCT FROM p_confirmed_plan/);
  assert.match(sql, /j\.target_id IS DISTINCT FROM p_expected_target/);
  assert.match(sql, /p_bytes>j\.reserved_bytes/);
  assert.match(sql, /completed_bytes=completed_bytes-\(j\.reserved_bytes-p_bytes\)/);
  assert.match(sql, /CREATE TABLE creative_builder\.preview_upload_attempts[\s\S]*state text NOT NULL DEFAULT 'planned'/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.register_preview_upload[\s\S]*assert_job[\s\S]*preview_upload_attempts/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.commit_analysis[\s\S]*Preview upload receipt missing[\s\S]*state='finalized'/);
  assert.match(sql, /orphan_preview[\s\S]*preview_upload_attempts[\s\S]*candidate_previews/);
  assert.match(sql, /VALUES \('creative-builder-private','creative-builder-private',false,8388608,ARRAY\['image\/webp'\]\)/);
  assert.match(sql, /CREATE POLICY builder_no_client_storage ON storage\.objects AS RESTRICTIVE[\s\S]*bucket_id <> 'creative-builder-private'/);
  assert.match(sql, /CREATE FUNCTION creative_builder\.list_projects[\s\S]*latest_plan_revision_id IS NOT NULL[\s\S]*ORDER BY p\.created_at,p\.id LIMIT p_limit/);
});
