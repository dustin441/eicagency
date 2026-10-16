-- REVIEW DRAFT. Separate production approval is required. Never auto-apply.
-- One-shot additive migration: every role/schema/object collision aborts the transaction.
BEGIN;

CREATE ROLE creative_builder_repository NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
CREATE ROLE creative_builder_worker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA creative_builder;
REVOKE ALL ON SCHEMA creative_builder FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA creative_builder TO creative_builder_repository, creative_builder_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA creative_builder REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE creative_builder.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id = 'eicagency'),
  normalized_url text NOT NULL CHECK (length(normalized_url) BETWEEN 8 AND 2048 AND normalized_url ~ '^https?://'),
  creation_idempotency_key text NOT NULL CHECK (length(creation_idempotency_key) BETWEEN 8 AND 96 AND creation_idempotency_key ~ '^[A-Za-z0-9:_-]+$'),
  latest_scan_id uuid,
  latest_plan_revision_id uuid,
  latest_concept_set_id uuid,
  latest_selection_id uuid,
  linked_studio_project_id uuid,
  linked_studio_version_id uuid,
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 1000),
  tombstoned_at timestamptz,
  cleanup_state text NOT NULL DEFAULT 'active' CHECK (cleanup_state IN ('active','pending_objects','objects_deleted','failed')),
  cleanup_after timestamptz,
  content_purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((tombstoned_at IS NULL) = (cleanup_state = 'active')),
  CHECK ((linked_studio_project_id IS NULL) = (linked_studio_version_id IS NULL))
);
CREATE INDEX builder_project_owner_list_idx ON creative_builder.projects(owner_id,tenant_id,created_at,id);
CREATE UNIQUE INDEX builder_project_owner_creation_key_idx ON creative_builder.projects(owner_id,creation_idempotency_key);

CREATE TABLE creative_builder.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  project_revision integer NOT NULL CHECK (project_revision > 0),
  receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt)='object' AND pg_column_size(receipt) <= 1048576),
  receipt_sha256 text NOT NULL CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(project_id,project_revision)
);

CREATE TABLE creative_builder.plan_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  parent_id uuid,
  scan_id uuid NOT NULL,
  project_revision integer NOT NULL CHECK (project_revision > 0),
  assumptions jsonb NOT NULL CHECK (jsonb_typeof(assumptions)='object' AND pg_column_size(assumptions) <= 262144),
  channels jsonb NOT NULL CHECK (jsonb_typeof(channels)='array' AND pg_column_size(channels) <= 131072),
  assumptions_hash text NOT NULL CHECK (assumptions_hash ~ '^[0-9a-f]{64}$'),
  confirmation_receipts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(confirmation_receipts)='array' AND pg_column_size(confirmation_receipts) <= 8192),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(project_id,project_revision),
  FOREIGN KEY(project_id,parent_id) REFERENCES creative_builder.plan_revisions(project_id,id),
  FOREIGN KEY(project_id,scan_id) REFERENCES creative_builder.scans(project_id,id)
);

CREATE TABLE creative_builder.concept_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  parent_id uuid,
  plan_revision_id uuid NOT NULL,
  project_revision integer NOT NULL CHECK (project_revision > 0),
  portfolio jsonb NOT NULL CHECK (jsonb_typeof(portfolio)='array' AND jsonb_array_length(portfolio)=6 AND pg_column_size(portfolio) <= 1048576),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(project_id,project_revision),
  FOREIGN KEY(project_id,parent_id) REFERENCES creative_builder.concept_sets(project_id,id),
  FOREIGN KEY(project_id,plan_revision_id) REFERENCES creative_builder.plan_revisions(project_id,id)
);

CREATE TABLE creative_builder.concept_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  concept_set_id uuid NOT NULL,
  concept_handle text NOT NULL CHECK (concept_handle ~ '^[a-z][a-z0-9_-]{0,63}$'),
  parent_id uuid,
  revision integer NOT NULL CHECK (revision BETWEEN 1 AND 100),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object' AND pg_column_size(content) <= 262144),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(concept_set_id,concept_handle,revision),
  FOREIGN KEY(project_id,concept_set_id) REFERENCES creative_builder.concept_sets(project_id,id),
  FOREIGN KEY(project_id,parent_id) REFERENCES creative_builder.concept_revisions(project_id,id)
);

CREATE TABLE creative_builder.source_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  scan_id uuid NOT NULL,
  candidate_id text NOT NULL CHECK (candidate_id ~ '^[A-Za-z0-9_-]{1,96}$'),
  object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 1024),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 8192),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(project_id,scan_id,candidate_id,sha256),
  FOREIGN KEY(project_id,scan_id) REFERENCES creative_builder.scans(project_id,id)
);

CREATE TABLE creative_builder.candidate_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  scan_id uuid NOT NULL,
  candidate_id text NOT NULL CHECK (candidate_id ~ '^[A-Za-z0-9_-]{1,96}$'),
  object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 1024),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 400),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 400),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id), UNIQUE(scan_id,candidate_id),
  FOREIGN KEY(project_id,scan_id) REFERENCES creative_builder.scans(project_id,id)
);

CREATE TABLE creative_builder.selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  concept_set_id uuid NOT NULL,
  concept_revision_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('portfolio','revision')),
  concept_handle text NOT NULL CHECK (concept_handle ~ '^[a-z][a-z0-9_-]{0,63}$'),
  ordered_asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[] CHECK (cardinality(ordered_asset_ids) BETWEEN 0 AND 8),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,id),
  FOREIGN KEY(project_id,concept_set_id) REFERENCES creative_builder.concept_sets(project_id,id),
  FOREIGN KEY(project_id,concept_revision_id) REFERENCES creative_builder.concept_revisions(project_id,id)
);

CREATE TABLE creative_builder.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 200),
  target_kind text NOT NULL CHECK (target_kind IN ('plan','portfolio','concept')),
  target_revision_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,ordinal)
);

CREATE TABLE creative_builder.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id='eicagency'),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  operation text NOT NULL CHECK (operation IN ('analysis','generation','revision','source_import','cleanup')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128 AND idempotency_key ~ '^[A-Za-z0-9:_-]+$'),
  expected_project_revision integer NOT NULL CHECK (expected_project_revision BETWEEN 0 AND 1000),
  target_kind text CHECK (target_kind IN ('plan','portfolio','concept')),
  target_id uuid,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','scanning','model_started','committing','completed','failed')),
  reserved_units integer NOT NULL CHECK (reserved_units BETWEEN 1 AND 10),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes BETWEEN 0 AND 8388608),
  completed_units integer NOT NULL DEFAULT 0 CHECK (completed_units >= 0 AND completed_units <= reserved_units),
  lease_token uuid,
  fencing_generation integer NOT NULL DEFAULT 1 CHECK (fencing_generation > 0),
  lease_expires_at timestamptz,
  model_deadline timestamptz,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  result jsonb CHECK (result IS NULL OR (jsonb_typeof(result)='object' AND pg_column_size(result) <= 65536)),
  error_code text CHECK (error_code IN ('scan_failed','provider_failed','invalid_result','lease_expired','storage_failed','commit_failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,idempotency_key),
  CHECK ((state IN ('completed','failed')) = (lease_token IS NULL AND lease_expires_at IS NULL)),
  CHECK ((operation IN ('generation','revision')) = (target_kind IS NOT NULL AND target_id IS NOT NULL)),
  CHECK (operation <> 'generation' OR target_kind='plan'),
  CHECK (state <> 'model_started' OR model_deadline IS NOT NULL)
);
CREATE INDEX builder_job_live_owner_idx ON creative_builder.jobs(owner_id,state,lease_expires_at);
CREATE INDEX builder_job_live_tenant_idx ON creative_builder.jobs(tenant_id,state,lease_expires_at);

CREATE TABLE creative_builder.daily_usage (
  scope text NOT NULL CHECK (scope IN ('owner','tenant')),
  subject_id uuid NOT NULL,
  usage_date date NOT NULL,
  operation text NOT NULL CHECK (operation IN ('analysis','generation','revision','source_import','cleanup')),
  reserved_units integer NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  completed_units integer NOT NULL DEFAULT 0 CHECK (completed_units BETWEEN 0 AND reserved_units),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  completed_bytes bigint NOT NULL DEFAULT 0 CHECK (completed_bytes BETWEEN 0 AND reserved_bytes),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope,subject_id,usage_date,operation),
  CHECK ((scope='owner') OR subject_id='00000000-0000-0000-0000-000000000000'::uuid)
);

-- Register every upload target before bytes are written. Maintenance can then
-- clean an abandoned write by exact database receipt without accepting a key
-- or URL from a browser, while finalized receipts remain distinguishable.
CREATE TABLE creative_builder.upload_attempts (
  job_id uuid NOT NULL REFERENCES creative_builder.jobs(id),
  fencing_generation integer NOT NULL CHECK (fencing_generation > 0),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id='eicagency'),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  candidate_id text NOT NULL CHECK (candidate_id ~ '^[A-Za-z0-9_-]{1,96}$'),
  object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 1024),
  state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','finalized')),
  finalized_asset_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finalized_at timestamptz,
  PRIMARY KEY(job_id,fencing_generation),
  FOREIGN KEY(project_id,finalized_asset_id) REFERENCES creative_builder.source_assets(project_id,id),
  CHECK ((state='finalized')=(finalized_asset_id IS NOT NULL AND finalized_at IS NOT NULL))
);

CREATE TABLE creative_builder.cleanup_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id='eicagency'),
  project_id uuid NOT NULL REFERENCES creative_builder.projects(id),
  object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 1024),
  source_kind text NOT NULL CHECK (source_kind IN ('orphan_import','project_asset','project_preview')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','deleted','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  fencing_generation integer NOT NULL DEFAULT 0 CHECK (fencing_generation >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_outcome text CHECK (last_outcome IN ('removed','not_found','storage_failed','retry_exhausted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state='leased')=(lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (state<>'deleted' OR last_outcome IN ('removed','not_found'))
);
CREATE INDEX builder_cleanup_claim_idx ON creative_builder.cleanup_objects(state,next_attempt_at,created_at,id);

CREATE TABLE creative_builder.project_tombstones (
  project_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  tenant_id text NOT NULL CHECK (tenant_id='eicagency'),
  tombstoned_at timestamptz NOT NULL,
  purged_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at=purged_at+interval '30 days')
);

ALTER TABLE creative_builder.projects ADD CONSTRAINT builder_latest_scan_fk FOREIGN KEY(id,latest_scan_id) REFERENCES creative_builder.scans(project_id,id);
ALTER TABLE creative_builder.projects ADD CONSTRAINT builder_latest_plan_fk FOREIGN KEY(id,latest_plan_revision_id) REFERENCES creative_builder.plan_revisions(project_id,id);
ALTER TABLE creative_builder.projects ADD CONSTRAINT builder_latest_concept_fk FOREIGN KEY(id,latest_concept_set_id) REFERENCES creative_builder.concept_sets(project_id,id);
ALTER TABLE creative_builder.projects ADD CONSTRAINT builder_latest_selection_fk FOREIGN KEY(id,latest_selection_id) REFERENCES creative_builder.selections(project_id,id);

-- Claims must be installed with set_config(..., true) in the same transaction as each RPC.
-- Browser JWTs and generic service-role sessions fail closed.
CREATE FUNCTION creative_builder.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claims jsonb := auth.jwt(); u uuid;
BEGIN
  IF claims->>'role' IS DISTINCT FROM 'service_role'
    OR claims->>'creative_builder_tenant' IS DISTINCT FROM 'eicagency'
    OR nullif(claims->>'creative_builder_owner','') IS NULL THEN
    RAISE EXCEPTION 'Builder backend authorization required' USING ERRCODE='42501';
  END IF;
  BEGIN u := (claims->>'creative_builder_owner')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Builder backend authorization required' USING ERRCODE='42501';
  END;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=u
    AND (p.role IN ('agency','super_admin') OR (p.role='client' AND 'eicagency'=ANY(p.client_access)))) THEN
    RAISE EXCEPTION 'Builder owner denied' USING ERRCODE='42501';
  END IF;
  RETURN u;
END $$;

CREATE FUNCTION creative_builder.immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('creative_builder.lifecycle_purge',true)='on' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Immutable Builder history' USING ERRCODE='55000';
END $$;
CREATE TRIGGER builder_scans_immutable BEFORE UPDATE OR DELETE ON creative_builder.scans FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_plan_revisions_immutable BEFORE UPDATE OR DELETE ON creative_builder.plan_revisions FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_concept_sets_immutable BEFORE UPDATE OR DELETE ON creative_builder.concept_sets FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_concept_revisions_immutable BEFORE UPDATE OR DELETE ON creative_builder.concept_revisions FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_selections_immutable BEFORE UPDATE OR DELETE ON creative_builder.selections FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_messages_immutable BEFORE UPDATE OR DELETE ON creative_builder.messages FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_source_assets_immutable BEFORE UPDATE OR DELETE ON creative_builder.source_assets FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();
CREATE TRIGGER builder_candidate_previews_immutable BEFORE UPDATE OR DELETE ON creative_builder.candidate_previews FOR EACH ROW EXECUTE FUNCTION creative_builder.immutable();

CREATE FUNCTION creative_builder.owner_daily_limit(p_operation text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE p_operation WHEN 'analysis' THEN 10 WHEN 'generation' THEN 10 WHEN 'revision' THEN 30 WHEN 'source_import' THEN 20 WHEN 'cleanup' THEN 50 ELSE NULL END
$$;
CREATE FUNCTION creative_builder.tenant_daily_limit(p_operation text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE p_operation WHEN 'analysis' THEN 100 WHEN 'generation' THEN 100 WHEN 'revision' THEN 300 WHEN 'source_import' THEN 200 WHEN 'cleanup' THEN 500 ELSE NULL END
$$;
CREATE FUNCTION creative_builder.tenant_concurrent_limit() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 8 $$;

CREATE FUNCTION creative_builder.job_target_is_current(j creative_builder.jobs,p creative_builder.projects) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE j.operation
  WHEN 'generation' THEN j.target_kind='plan' AND j.target_id=p.latest_plan_revision_id AND EXISTS (
   SELECT 1 FROM creative_builder.plan_revisions r CROSS JOIN LATERAL jsonb_array_elements(r.confirmation_receipts) receipt
   WHERE r.id=j.target_id AND r.project_id=p.id AND receipt->>'scope'='plan' AND (receipt->>'planRevisionId')::uuid=r.id AND receipt->>'contentSha256'=r.assumptions_hash)
  WHEN 'revision' THEN CASE j.target_kind
   WHEN 'plan' THEN j.target_id=p.latest_plan_revision_id
   WHEN 'portfolio' THEN j.target_id=p.latest_concept_set_id
   WHEN 'concept' THEN EXISTS (SELECT 1 FROM creative_builder.concept_revisions c WHERE c.id=j.target_id AND c.project_id=p.id AND c.concept_set_id=p.latest_concept_set_id AND NOT EXISTS (SELECT 1 FROM creative_builder.concept_revisions newer WHERE newer.concept_set_id=c.concept_set_id AND newer.concept_handle=c.concept_handle AND newer.revision>c.revision))
   ELSE false END
  ELSE true END
$$;

CREATE FUNCTION creative_builder.create_project(p_normalized_url text,p_idempotency_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid := creative_builder.actor(); existing creative_builder.projects; pid uuid;
BEGIN
  IF p_normalized_url IS NULL OR length(p_normalized_url) NOT BETWEEN 8 AND 2048 OR p_normalized_url !~ '^https?://' THEN
    RAISE EXCEPTION 'Invalid URL' USING ERRCODE='22023';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 96 OR p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' THEN RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('builder-project:'||u::text,0));
  SELECT * INTO existing FROM creative_builder.projects WHERE owner_id=u AND creation_idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF existing.normalized_url IS DISTINCT FROM p_normalized_url OR existing.tombstoned_at IS NOT NULL THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('project_id',existing.id,'revision',0);
  END IF;
  IF (SELECT count(*) FROM creative_builder.projects WHERE owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL) >= 50 THEN
    RAISE EXCEPTION 'Project limit' USING ERRCODE='54000';
  END IF;
  INSERT INTO creative_builder.projects(owner_id,normalized_url,creation_idempotency_key) VALUES(u,p_normalized_url,p_idempotency_key) RETURNING id INTO pid;
  RETURN jsonb_build_object('project_id',pid,'revision',0);
END $$;

CREATE FUNCTION creative_builder.list_projects(p_limit integer DEFAULT 50,p_after_created_at timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,normalized_url text,revision integer,latest_scan_id uuid,latest_plan_revision_id uuid,latest_concept_set_id uuid,latest_selection_id uuid,linked_studio_project_id uuid,linked_studio_version_id uuid,created_at timestamptz,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid := creative_builder.actor();
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_after_created_at IS NULL)<>(p_after_id IS NULL) THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT p.id,p.normalized_url,p.revision,p.latest_scan_id,p.latest_plan_revision_id,p.latest_concept_set_id,p.latest_selection_id,p.linked_studio_project_id,p.linked_studio_version_id,p.created_at,p.updated_at
 FROM creative_builder.projects p WHERE p.owner_id=u AND p.tenant_id='eicagency' AND p.tombstoned_at IS NULL
 AND (p_after_id IS NULL OR (p.created_at,p.id)>(p_after_created_at,p_after_id)) ORDER BY p.created_at,p.id LIMIT p_limit;
END $$;

CREATE FUNCTION creative_builder.read_project(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid := creative_builder.actor(); result jsonb;
BEGIN
 SELECT jsonb_build_object(
  'project',to_jsonb(p)-'owner_id'-'tenant_id'-'creation_idempotency_key'-'tombstoned_at'-'cleanup_state'-'cleanup_after'-'content_purged_at',
  'scans',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'project_revision',s.project_revision,'candidates',coalesce((SELECT jsonb_agg(candidate-'sourceUrl'-'sourceExcerptIds') FROM jsonb_array_elements(coalesce(s.receipt->'assets','[]'::jsonb)) candidate),'[]'::jsonb),'receipt_sha256',s.receipt_sha256,'created_at',s.created_at) ORDER BY s.project_revision) FROM creative_builder.scans s WHERE s.project_id=p.id),'[]'::jsonb),
  'plans',coalesce((SELECT jsonb_agg(to_jsonb(r)-'created_by' ORDER BY r.project_revision) FROM creative_builder.plan_revisions r WHERE r.project_id=p.id),'[]'::jsonb),
  'concept_sets',coalesce((SELECT jsonb_agg(to_jsonb(c)-'created_by' ORDER BY c.project_revision) FROM creative_builder.concept_sets c WHERE c.project_id=p.id),'[]'::jsonb),
  'concept_revisions',coalesce((SELECT jsonb_agg(to_jsonb(c)-'created_by' ORDER BY c.created_at,c.id) FROM creative_builder.concept_revisions c WHERE c.project_id=p.id),'[]'::jsonb),
  'selections',coalesce((SELECT jsonb_agg(to_jsonb(s)-'owner_id' ORDER BY s.created_at,s.id) FROM creative_builder.selections s WHERE s.project_id=p.id),'[]'::jsonb),
  'messages',coalesce((SELECT jsonb_agg(to_jsonb(m)-'created_by' ORDER BY m.ordinal) FROM creative_builder.messages m WHERE m.project_id=p.id),'[]'::jsonb),
  'source_assets',coalesce((SELECT jsonb_agg(to_jsonb(a)-'object_key'-'created_by' ORDER BY a.created_at,a.id) FROM creative_builder.source_assets a WHERE a.project_id=p.id),'[]'::jsonb),
  'candidate_previews',coalesce((SELECT jsonb_agg(to_jsonb(c)-'object_key' ORDER BY c.created_at,c.id) FROM creative_builder.candidate_previews c WHERE c.project_id=p.id),'[]'::jsonb),
  'jobs',coalesce((SELECT jsonb_agg(to_jsonb(j)-'lease_token'-'result' ORDER BY j.created_at,j.id) FROM creative_builder.jobs j WHERE j.project_id=p.id),'[]'::jsonb)
 ) INTO result FROM creative_builder.projects p WHERE p.id=p_project AND p.owner_id=u AND p.tenant_id='eicagency' AND p.tombstoned_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION creative_builder.read_project_canonical(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 result:=creative_builder.read_project(p_project);
 RETURN jsonb_set(result,'{scans}',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'project_revision',s.project_revision,'receipt',s.receipt,'receipt_sha256',s.receipt_sha256,'created_at',s.created_at) ORDER BY s.project_revision) FROM creative_builder.scans s WHERE s.project_id=p_project),'[]'::jsonb));
END $$;

CREATE FUNCTION creative_builder.edit_plan(p_project uuid,p_expected_plan uuid,p_expected_revision integer,p_scan uuid,p_assumptions jsonb,p_channels jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); p creative_builder.projects; rid uuid; nextrev integer; assumptions_hash text;
BEGIN
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR p.latest_plan_revision_id IS DISTINCT FROM p_expected_plan THEN RAISE EXCEPTION 'Plan conflict' USING ERRCODE='40001'; END IF;
 IF p_scan IS DISTINCT FROM p.latest_scan_id OR jsonb_typeof(p_assumptions) IS DISTINCT FROM 'object' OR jsonb_typeof(p_channels) IS DISTINCT FROM 'array'
   OR pg_column_size(p_assumptions)>262144 OR pg_column_size(p_channels)>131072 THEN RAISE EXCEPTION 'Invalid plan' USING ERRCODE='22023'; END IF;
 assumptions_hash:=encode(sha256(convert_to(p_assumptions::text||p_channels::text,'UTF8')),'hex');
 IF (SELECT count(*) FROM creative_builder.plan_revisions WHERE project_id=p_project)>=100 THEN RAISE EXCEPTION 'Plan revision limit' USING ERRCODE='54000'; END IF;
 nextrev:=p.revision+1;
 INSERT INTO creative_builder.plan_revisions(project_id,parent_id,scan_id,project_revision,assumptions,channels,assumptions_hash,created_by)
 VALUES(p_project,p.latest_plan_revision_id,p_scan,nextrev,p_assumptions,p_channels,assumptions_hash,u) RETURNING id INTO rid;
 UPDATE creative_builder.projects SET revision=nextrev,latest_plan_revision_id=rid,latest_concept_set_id=NULL,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 RETURN jsonb_build_object('plan_revision_id',rid,'revision',nextrev,'confirmed',false,'assumptions_hash',assumptions_hash);
END $$;

CREATE FUNCTION creative_builder.confirm_plan(p_project uuid,p_expected_plan uuid,p_expected_revision integer,p_confirmed_claim_ids text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); p creative_builder.projects; old creative_builder.plan_revisions; rid uuid:=gen_random_uuid(); plan_receipt_id uuid:=gen_random_uuid(); claim_receipt_id uuid; nextrev integer; receipts jsonb; confirmed_assumptions jsonb; confirmed_hash text; claim_ids text[]; confirmed_at text; assumption_key text;
BEGIN
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR p.latest_plan_revision_id IS DISTINCT FROM p_expected_plan THEN RAISE EXCEPTION 'Plan conflict' USING ERRCODE='40001'; END IF;
 SELECT * INTO old FROM creative_builder.plan_revisions WHERE id=p_expected_plan AND project_id=p_project;
 IF jsonb_array_length(old.confirmation_receipts)>0 THEN RAISE EXCEPTION 'Already confirmed' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM creative_builder.plan_revisions WHERE project_id=p_project)>=100 THEN RAISE EXCEPTION 'Plan revision limit' USING ERRCODE='54000'; END IF;
 nextrev:=p.revision+1; confirmed_assumptions:=old.assumptions; confirmed_at:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 IF jsonb_typeof(coalesce(confirmed_assumptions->'claims','[]'::jsonb)) IS DISTINCT FROM 'array' OR (SELECT count(*)<>count(DISTINCT claim->>'id') OR coalesce(bool_or(nullif(claim->>'id','') IS NULL),false) FROM jsonb_array_elements(coalesce(confirmed_assumptions->'claims','[]'::jsonb)) claim) THEN RAISE EXCEPTION 'Invalid claim identities' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(confirmed_assumptions->'claims','[]'::jsonb)) claim WHERE claim->>'status' NOT IN ('page-observed','needs-confirmation') OR claim ? 'confirmationReceiptId') THEN RAISE EXCEPTION 'Invalid unconfirmed claims' USING ERRCODE='22023'; END IF;
 FOREACH assumption_key IN ARRAY ARRAY['advertisedSubject','offer','audience','awareness','funnelStage','objective','message','cta'] LOOP
  IF confirmed_assumptions ? assumption_key THEN confirmed_assumptions:=jsonb_set(confirmed_assumptions,ARRAY[assumption_key,'confirmed'],'true'::jsonb,false); END IF;
 END LOOP;
 SELECT coalesce(array_agg(claim->>'id' ORDER BY claim->>'id'),'{}'::text[]) INTO claim_ids FROM jsonb_array_elements(coalesce(confirmed_assumptions->'claims','[]'::jsonb)) claim WHERE (claim->>'status'='needs-confirmation' OR claim->>'kind' IN ('price','percentage','guarantee','testimonial','comparison','result','operational')) AND nullif(claim->>'id','') IS NOT NULL;
 IF p_confirmed_claim_ids IS NULL OR cardinality(p_confirmed_claim_ids)<>cardinality(claim_ids) OR cardinality(p_confirmed_claim_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_confirmed_claim_ids) id) OR EXISTS(SELECT 1 FROM unnest(claim_ids) id WHERE NOT id=ANY(p_confirmed_claim_ids)) THEN RAISE EXCEPTION 'Claim confirmation mismatch' USING ERRCODE='22023'; END IF;
 IF cardinality(claim_ids)>0 THEN
  claim_receipt_id:=gen_random_uuid();
  confirmed_assumptions:=jsonb_set(confirmed_assumptions,'{claims}',(SELECT jsonb_agg(CASE WHEN claim->>'status'='needs-confirmation' OR claim->>'kind' IN ('price','percentage','guarantee','testimonial','comparison','result','operational') THEN claim||jsonb_build_object('status','user-confirmed','confirmationReceiptId',claim_receipt_id) ELSE claim END ORDER BY ordinality) FROM jsonb_array_elements(coalesce(confirmed_assumptions->'claims','[]'::jsonb)) WITH ORDINALITY AS c(claim,ordinality)),false);
 END IF;
 confirmed_hash:=encode(sha256(convert_to(confirmed_assumptions::text||old.channels::text,'UTF8')),'hex');
 receipts:=jsonb_build_array(jsonb_build_object('id',plan_receipt_id,'scope','plan','planRevisionId',rid,'contentSha256',confirmed_hash,'claimIds','[]'::jsonb,'confirmedAt',confirmed_at,'confirmedBy',u));
 IF claim_receipt_id IS NOT NULL THEN receipts:=receipts||jsonb_build_array(jsonb_build_object('id',claim_receipt_id,'scope','claim','planRevisionId',rid,'contentSha256',confirmed_hash,'claimIds',to_jsonb(claim_ids),'confirmedAt',confirmed_at,'confirmedBy',u)); END IF;
 INSERT INTO creative_builder.plan_revisions(id,project_id,parent_id,scan_id,project_revision,assumptions,channels,assumptions_hash,confirmation_receipts,created_by)
 VALUES(rid,p_project,old.id,old.scan_id,nextrev,confirmed_assumptions,old.channels,confirmed_hash,receipts,u);
 UPDATE creative_builder.projects SET revision=nextrev,latest_plan_revision_id=rid,latest_concept_set_id=NULL,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 RETURN jsonb_build_object('plan_revision_id',rid,'revision',nextrev,'confirmation_receipts',receipts);
END $$;

CREATE FUNCTION creative_builder.reserve_job(p_project uuid,p_expected_revision integer,p_operation text,p_idempotency_key text,p_reserved_units integer DEFAULT 1,p_reserved_bytes bigint DEFAULT 0,p_target_kind text DEFAULT NULL,p_target_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); p creative_builder.projects; j creative_builder.jobs; tok uuid:=gen_random_uuid(); nowts timestamptz:=clock_timestamp(); owner_limit integer; tenant_limit integer; owner_used integer; tenant_used integer; live_until timestamptz;
BEGIN
 IF p_operation NOT IN ('analysis','generation','revision','source_import','cleanup') OR p_reserved_units NOT BETWEEN 1 AND 10 OR length(p_idempotency_key) NOT BETWEEN 8 AND 128 OR p_idempotency_key !~ '^[A-Za-z0-9:_-]+$'
   OR p_reserved_bytes NOT BETWEEN 0 AND 8388608 OR (p_operation<>'source_import' AND p_reserved_bytes<>0)
   OR ((p_operation IN ('generation','revision')) IS DISTINCT FROM (p_target_kind IS NOT NULL AND p_target_id IS NOT NULL))
   OR (p_operation='generation' AND p_target_kind IS DISTINCT FROM 'plan') OR (p_target_kind IS NOT NULL AND p_target_kind NOT IN ('plan','portfolio','concept')) THEN RAISE EXCEPTION 'Invalid reservation' USING ERRCODE='22023'; END IF;
 -- Live capacity is shared across every operation. Lock tenant first, then owner,
 -- before idempotency lookup and capacity checks so cross-operation races serialize.
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-live:tenant:eicagency',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-live:owner:'||u::text,0));
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO j FROM creative_builder.jobs WHERE owner_id=u AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF j.project_id IS DISTINCT FROM p_project OR j.operation IS DISTINCT FROM p_operation OR j.expected_project_revision IS DISTINCT FROM p_expected_revision OR j.reserved_units IS DISTINCT FROM p_reserved_units OR j.reserved_bytes IS DISTINCT FROM p_reserved_bytes OR j.target_kind IS DISTINCT FROM p_target_kind OR j.target_id IS DISTINCT FROM p_target_id THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('job_id',j.id,'state',j.state,'lease_token',j.lease_token,'fencing_generation',j.fencing_generation,'attempts',j.attempts,'idempotent',true,'result',j.result);
 END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Project conflict' USING ERRCODE='40001'; END IF;
 j.operation:=p_operation; j.target_kind:=p_target_kind; j.target_id:=p_target_id;
 IF NOT creative_builder.job_target_is_current(j,p) THEN RAISE EXCEPTION 'Stale job target' USING ERRCODE='40001'; END IF;
 -- One deterministic advisory lock serializes owner+tenant counter creation, checks, and increments.
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-usage:'||current_date::text||':'||p_operation,0));
 INSERT INTO creative_builder.daily_usage(scope,subject_id,usage_date,operation) VALUES
 ('owner',u,current_date,p_operation),('tenant','00000000-0000-0000-0000-000000000000',current_date,p_operation) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM creative_builder.daily_usage WHERE usage_date=current_date AND operation=p_operation AND ((scope='owner' AND subject_id=u) OR scope='tenant') ORDER BY scope,subject_id FOR UPDATE;
 SELECT reserved_units INTO owner_used FROM creative_builder.daily_usage WHERE scope='owner' AND subject_id=u AND usage_date=current_date AND operation=p_operation;
 SELECT reserved_units INTO tenant_used FROM creative_builder.daily_usage WHERE scope='tenant' AND subject_id='00000000-0000-0000-0000-000000000000' AND usage_date=current_date AND operation=p_operation;
 owner_limit:=creative_builder.owner_daily_limit(p_operation); tenant_limit:=creative_builder.tenant_daily_limit(p_operation);
 IF owner_used+p_reserved_units>owner_limit OR tenant_used+p_reserved_units>tenant_limit THEN RAISE EXCEPTION 'Daily quota exceeded' USING ERRCODE='54000'; END IF;
 IF p_operation='source_import' AND (SELECT reserved_bytes+p_reserved_bytes>67108864 FROM creative_builder.daily_usage WHERE scope='owner' AND subject_id=u AND usage_date=current_date AND operation=p_operation) THEN RAISE EXCEPTION 'Owner byte quota exceeded' USING ERRCODE='54000'; END IF;
 IF p_operation='source_import' AND (SELECT reserved_bytes+p_reserved_bytes>536870912 FROM creative_builder.daily_usage WHERE scope='tenant' AND usage_date=current_date AND operation=p_operation) THEN RAISE EXCEPTION 'Tenant byte quota exceeded' USING ERRCODE='54000'; END IF;
 IF EXISTS(SELECT 1 FROM creative_builder.jobs x WHERE x.owner_id=u AND x.state NOT IN ('completed','failed') AND greatest(x.lease_expires_at,coalesce(x.model_deadline,x.lease_expires_at))>nowts) THEN RAISE EXCEPTION 'Owner job busy' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM creative_builder.jobs x WHERE x.tenant_id='eicagency' AND x.state NOT IN ('completed','failed') AND greatest(x.lease_expires_at,coalesce(x.model_deadline,x.lease_expires_at))>nowts)>=creative_builder.tenant_concurrent_limit() THEN RAISE EXCEPTION 'Tenant concurrency exceeded' USING ERRCODE='55000'; END IF;
 UPDATE creative_builder.daily_usage SET reserved_units=reserved_units+p_reserved_units,reserved_bytes=reserved_bytes+p_reserved_bytes,updated_at=nowts WHERE usage_date=current_date AND operation=p_operation AND ((scope='owner' AND subject_id=u) OR scope='tenant');
 INSERT INTO creative_builder.jobs(owner_id,project_id,operation,idempotency_key,expected_project_revision,target_kind,target_id,reserved_units,reserved_bytes,lease_token,lease_expires_at)
 VALUES(u,p_project,p_operation,p_idempotency_key,p_expected_revision,p_target_kind,p_target_id,p_reserved_units,p_reserved_bytes,tok,nowts+interval '120 seconds') RETURNING * INTO j;
 RETURN jsonb_build_object('job_id',j.id,'state',j.state,'lease_token',j.lease_token,'fencing_generation',j.fencing_generation,'attempts',j.attempts,'idempotent',false);
END $$;

CREATE FUNCTION creative_builder.transition_job(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_operation text,p_expected_revision integer,p_state text,p_model_timeout_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; p creative_builder.projects; nowts timestamptz:=clock_timestamp(); deadline timestamptz;
BEGIN
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job AND owner_id=u AND project_id=p_project AND operation=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR NOT creative_builder.job_target_is_current(j,p) OR j.expected_project_revision IS DISTINCT FROM p_expected_revision OR j.lease_token IS DISTINCT FROM p_token OR j.fencing_generation IS DISTINCT FROM p_generation OR greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))<=nowts THEN RAISE EXCEPTION 'Stale job fence' USING ERRCODE='40001'; END IF;
 IF NOT ((j.state='reserved' AND p_state IN ('scanning','model_started')) OR (j.state='scanning' AND p_state IN ('model_started','committing')) OR (j.state='model_started' AND p_state='committing')) THEN RAISE EXCEPTION 'Invalid transition' USING ERRCODE='22023'; END IF;
 IF p_state='model_started' THEN
   IF p_model_timeout_seconds IS NULL OR p_model_timeout_seconds NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'Invalid model deadline' USING ERRCODE='22023'; END IF;
   deadline:=nowts+make_interval(secs=>p_model_timeout_seconds);
   UPDATE creative_builder.jobs SET state=p_state,model_deadline=deadline,lease_expires_at=deadline,updated_at=nowts WHERE id=p_job;
 ELSE UPDATE creative_builder.jobs SET state=p_state,updated_at=nowts WHERE id=p_job; END IF;
 RETURN jsonb_build_object('job_id',p_job,'state',p_state,'model_deadline',deadline,'fencing_generation',p_generation);
END $$;

CREATE FUNCTION creative_builder.renew_job(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_operation text,p_expected_revision integer,p_seconds integer DEFAULT 120) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; p creative_builder.projects; nowts timestamptz:=clock_timestamp(); expiry timestamptz;
BEGIN
 IF p_seconds NOT BETWEEN 30 AND 300 THEN RAISE EXCEPTION 'Invalid lease' USING ERRCODE='22023'; END IF;
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job AND owner_id=u AND project_id=p_project AND operation=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR NOT creative_builder.job_target_is_current(j,p) OR j.expected_project_revision IS DISTINCT FROM p_expected_revision OR j.state IN ('completed','failed') OR j.lease_token IS DISTINCT FROM p_token OR j.fencing_generation IS DISTINCT FROM p_generation OR greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))<=nowts THEN RAISE EXCEPTION 'Stale job fence' USING ERRCODE='40001'; END IF;
 -- model_started has a hard provider deadline: renewal cannot move it. Once the
 -- provider returned and the job is committing, a bounded commit lease may move.
 IF j.state='model_started' THEN expiry:=j.model_deadline;
 ELSE expiry:=nowts+make_interval(secs=>p_seconds); END IF;
 UPDATE creative_builder.jobs SET lease_expires_at=expiry,updated_at=nowts WHERE id=p_job; RETURN expiry;
END $$;

CREATE FUNCTION creative_builder.assert_job(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_operation text,p_expected_revision integer,p_required_state text) RETURNS creative_builder.jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; p creative_builder.projects;
BEGIN
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job AND owner_id=u AND project_id=p_project AND operation=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF j.expected_project_revision IS DISTINCT FROM p_expected_revision OR p.revision IS DISTINCT FROM p_expected_revision OR NOT creative_builder.job_target_is_current(j,p) OR j.state IS DISTINCT FROM p_required_state OR j.lease_token IS DISTINCT FROM p_token OR j.fencing_generation IS DISTINCT FROM p_generation OR greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))<=clock_timestamp() THEN RAISE EXCEPTION 'Stale job fence' USING ERRCODE='40001'; END IF;
 RETURN j;
END $$;

CREATE FUNCTION creative_builder.complete_job(p_job uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j creative_builder.jobs;
BEGIN
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job FOR UPDATE;
 UPDATE creative_builder.jobs SET state='completed',completed_units=reserved_units,lease_token=NULL,lease_expires_at=NULL,result=p_result,updated_at=clock_timestamp() WHERE id=p_job;
 UPDATE creative_builder.daily_usage SET completed_units=completed_units+j.reserved_units,completed_bytes=completed_bytes+j.reserved_bytes,updated_at=clock_timestamp()
 WHERE usage_date=j.created_at::date AND operation=j.operation AND ((scope='owner' AND subject_id=j.owner_id) OR scope='tenant');
END $$;

CREATE FUNCTION creative_builder.commit_analysis(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_expected_revision integer,p_scan uuid,p_receipt jsonb,p_assumptions jsonb,p_channels jsonb,p_previews jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; sid uuid:=p_scan; rid uuid; nextrev integer:=p_expected_revision+1; item jsonb; result jsonb; receipt_hash text; assumptions_hash text;
BEGIN
 j:=creative_builder.assert_job(p_job,p_token,p_generation,p_project,'analysis',p_expected_revision,'committing');
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR pg_column_size(p_receipt)>1048576 OR p_receipt->>'id' IS DISTINCT FROM p_scan::text
 OR jsonb_typeof(p_assumptions) IS DISTINCT FROM 'object' OR pg_column_size(p_assumptions)>262144 OR jsonb_typeof(p_channels) IS DISTINCT FROM 'array' OR pg_column_size(p_channels)>131072
 OR jsonb_typeof(p_previews) IS DISTINCT FROM 'array' OR jsonb_array_length(p_previews)>8 OR pg_column_size(p_previews)>2097152 THEN RAISE EXCEPTION 'Invalid analysis' USING ERRCODE='22023'; END IF;
 receipt_hash:=encode(sha256(convert_to(p_receipt::text,'UTF8')),'hex'); assumptions_hash:=encode(sha256(convert_to(p_assumptions::text||p_channels::text,'UTF8')),'hex');
 IF (SELECT count(*) FROM creative_builder.scans WHERE project_id=p_project)>=20 THEN RAISE EXCEPTION 'Scan limit' USING ERRCODE='54000'; END IF;
 INSERT INTO creative_builder.scans(id,project_id,project_revision,receipt,receipt_sha256,created_by) VALUES(sid,p_project,nextrev,p_receipt,receipt_hash,u);
 FOR item IN SELECT value FROM jsonb_array_elements(p_previews) LOOP
  IF item->>'object_key' !~ ('^eicagency/'||u::text||'/'||p_project::text||'/'||p_job::text||'/'||p_generation::text||'/previews/')
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_receipt->'assets','[]'::jsonb)) asset WHERE asset->>'id'=item->>'candidate_id') THEN
    RAISE EXCEPTION 'Invalid candidate preview receipt' USING ERRCODE='22023';
  END IF;
  INSERT INTO creative_builder.candidate_previews(project_id,scan_id,candidate_id,object_key,sha256,mime_type,width,height,size_bytes)
  VALUES(p_project,sid,item->>'candidate_id',item->>'object_key',item->>'sha256',item->>'mime_type',(item->>'width')::integer,(item->>'height')::integer,(item->>'size_bytes')::integer);
 END LOOP;
 INSERT INTO creative_builder.plan_revisions(project_id,scan_id,project_revision,assumptions,channels,assumptions_hash,created_by) VALUES(p_project,sid,nextrev,p_assumptions,p_channels,assumptions_hash,u) RETURNING id INTO rid;
 UPDATE creative_builder.projects SET revision=nextrev,latest_scan_id=sid,latest_plan_revision_id=rid,latest_concept_set_id=NULL,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 result:=jsonb_build_object('scan_id',sid,'plan_revision_id',rid,'revision',nextrev,'receipt_sha256',receipt_hash,'assumptions_hash',assumptions_hash); PERFORM creative_builder.complete_job(p_job,result); RETURN result;
END $$;

CREATE FUNCTION creative_builder.insert_concepts(p_project uuid,p_set uuid,p_portfolio jsonb,p_owner uuid,p_parent_set uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE item jsonb; handles text[]:='{}'; handle text; prior creative_builder.concept_revisions; next_revision integer;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements(p_portfolio) LOOP
  handle:=item->>'handle';
  IF handle IS NULL OR handle !~ '^[a-z][a-z0-9_-]{0,63}$' OR jsonb_typeof(item->'content') IS DISTINCT FROM 'object' OR pg_column_size(item->'content')>262144 OR handle=ANY(handles) THEN RAISE EXCEPTION 'Invalid concept portfolio' USING ERRCODE='22023'; END IF;
  handles:=array_append(handles,handle);
  prior:=NULL; next_revision:=1;
  IF p_parent_set IS NOT NULL THEN
   SELECT * INTO prior FROM creative_builder.concept_revisions WHERE project_id=p_project AND concept_set_id=p_parent_set AND concept_handle=handle ORDER BY revision DESC LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION 'Portfolio parent mismatch' USING ERRCODE='22023'; END IF;
   next_revision:=prior.revision+1;
  END IF;
  IF next_revision>100 THEN RAISE EXCEPTION 'Concept revision limit' USING ERRCODE='54000'; END IF;
  INSERT INTO creative_builder.concept_revisions(project_id,concept_set_id,concept_handle,parent_id,revision,content,content_hash,created_by)
  VALUES(p_project,p_set,handle,prior.id,next_revision,item->'content',encode(sha256(convert_to((item->'content')::text,'UTF8')),'hex'),p_owner);
 END LOOP;
 IF cardinality(handles)<>6 THEN RAISE EXCEPTION 'Exactly six concepts required' USING ERRCODE='22023'; END IF;
END $$;

CREATE FUNCTION creative_builder.commit_concepts(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_expected_revision integer,p_confirmed_plan uuid,p_portfolio jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; sid uuid; nextrev integer:=p_expected_revision+1; result jsonb;
BEGIN
 j:=creative_builder.assert_job(p_job,p_token,p_generation,p_project,'generation',p_expected_revision,'committing');
 IF j.target_kind IS DISTINCT FROM 'plan' OR j.target_id IS DISTINCT FROM p_confirmed_plan THEN RAISE EXCEPTION 'Generation target conflict' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_portfolio) IS DISTINCT FROM 'array' OR jsonb_array_length(p_portfolio)<>6 OR pg_column_size(p_portfolio)>1048576
 OR NOT EXISTS(SELECT 1 FROM creative_builder.projects p JOIN creative_builder.plan_revisions r ON r.id=p.latest_plan_revision_id CROSS JOIN LATERAL jsonb_array_elements(r.confirmation_receipts) receipt WHERE p.id=p_project AND r.id=p_confirmed_plan AND receipt->>'scope'='plan' AND (receipt->>'planRevisionId')::uuid=r.id AND receipt->>'contentSha256'=r.assumptions_hash) THEN RAISE EXCEPTION 'Confirmed plan required' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM creative_builder.concept_sets WHERE project_id=p_project)>=50 THEN RAISE EXCEPTION 'Concept set limit' USING ERRCODE='54000'; END IF;
 INSERT INTO creative_builder.concept_sets(project_id,plan_revision_id,project_revision,portfolio,content_hash,created_by) VALUES(p_project,p_confirmed_plan,nextrev,p_portfolio,encode(sha256(convert_to(p_portfolio::text,'UTF8')),'hex'),u) RETURNING id INTO sid;
 PERFORM creative_builder.insert_concepts(p_project,sid,p_portfolio,u);
 UPDATE creative_builder.projects SET revision=nextrev,latest_concept_set_id=sid,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 result:=jsonb_build_object('concept_set_id',sid,'revision',nextrev); PERFORM creative_builder.complete_job(p_job,result); RETURN result;
END $$;

CREATE FUNCTION creative_builder.append_turns(p_project uuid,p_target text,p_revision uuid,p_user text,p_assistant text,p_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 IF length(p_user) NOT BETWEEN 1 AND 2000 OR length(p_assistant) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(ordinal),0) INTO n FROM creative_builder.messages WHERE project_id=p_project;
 IF n+2>200 THEN RAISE EXCEPTION 'Message limit' USING ERRCODE='54000'; END IF;
 INSERT INTO creative_builder.messages(project_id,ordinal,target_kind,target_revision_id,role,content,created_by) VALUES
 (p_project,n+1,p_target,p_revision,'user',p_user,p_owner),(p_project,n+2,p_target,p_revision,'assistant',p_assistant,p_owner);
END $$;

CREATE FUNCTION creative_builder.commit_revision(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_expected_project_revision integer,p_target text,p_expected_target uuid,p_concept_handle text,p_payload jsonb,p_user_message text,p_assistant_message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; p creative_builder.projects; new_id uuid; nextrev integer:=p_expected_project_revision+1; oldplan creative_builder.plan_revisions; oldset creative_builder.concept_sets; oldconcept creative_builder.concept_revisions; item jsonb; parentrev creative_builder.concept_revisions; result jsonb;
BEGIN
 j:=creative_builder.assert_job(p_job,p_token,p_generation,p_project,'revision',p_expected_project_revision,'committing');
 IF j.target_kind IS DISTINCT FROM p_target OR j.target_id IS DISTINCT FROM p_expected_target THEN RAISE EXCEPTION 'Revision target conflict' USING ERRCODE='40001'; END IF;
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project FOR UPDATE;
 IF p_target NOT IN ('plan','portfolio','concept') OR pg_column_size(p_payload)>1048576 THEN RAISE EXCEPTION 'Invalid revision target' USING ERRCODE='22023'; END IF;
 IF p_target='plan' THEN
  IF p.latest_plan_revision_id IS DISTINCT FROM p_expected_target OR p_concept_handle IS NOT NULL OR jsonb_typeof(p_payload->'assumptions') IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'channels') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Plan conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO oldplan FROM creative_builder.plan_revisions WHERE id=p_expected_target AND project_id=p_project;
  INSERT INTO creative_builder.plan_revisions(project_id,parent_id,scan_id,project_revision,assumptions,channels,assumptions_hash,created_by)
  VALUES(p_project,oldplan.id,oldplan.scan_id,nextrev,p_payload->'assumptions',p_payload->'channels',encode(sha256(convert_to((p_payload->'assumptions')::text||(p_payload->'channels')::text,'UTF8')),'hex'),u) RETURNING id INTO new_id;
  UPDATE creative_builder.projects SET revision=nextrev,latest_plan_revision_id=new_id,latest_concept_set_id=NULL,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 ELSIF p_target='portfolio' THEN
  IF p.latest_concept_set_id IS DISTINCT FROM p_expected_target OR p_concept_handle IS NOT NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload)<>6 THEN RAISE EXCEPTION 'Portfolio conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO oldset FROM creative_builder.concept_sets WHERE id=p_expected_target AND project_id=p_project;
  INSERT INTO creative_builder.concept_sets(project_id,parent_id,plan_revision_id,project_revision,portfolio,content_hash,created_by) VALUES(p_project,oldset.id,oldset.plan_revision_id,nextrev,p_payload,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),u) RETURNING id INTO new_id;
  PERFORM creative_builder.insert_concepts(p_project,new_id,p_payload,u,oldset.id);
  UPDATE creative_builder.projects SET revision=nextrev,latest_concept_set_id=new_id,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 ELSE
  IF p_concept_handle IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Concept target required' USING ERRCODE='22023'; END IF;
  SELECT * INTO oldconcept FROM creative_builder.concept_revisions WHERE id=p_expected_target AND project_id=p_project AND concept_handle=p_concept_handle AND concept_set_id=p.latest_concept_set_id;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM creative_builder.concept_revisions c WHERE c.concept_set_id=oldconcept.concept_set_id AND c.concept_handle=p_concept_handle AND c.revision>oldconcept.revision) THEN RAISE EXCEPTION 'Concept conflict' USING ERRCODE='40001'; END IF;
  IF oldconcept.revision>=100 THEN RAISE EXCEPTION 'Concept revision limit' USING ERRCODE='54000'; END IF;
  INSERT INTO creative_builder.concept_revisions(project_id,concept_set_id,concept_handle,parent_id,revision,content,content_hash,created_by) VALUES(p_project,oldconcept.concept_set_id,p_concept_handle,oldconcept.id,oldconcept.revision+1,p_payload,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),u) RETURNING id INTO new_id;
  UPDATE creative_builder.projects SET revision=nextrev,latest_selection_id=NULL,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project;
 END IF;
 PERFORM creative_builder.append_turns(p_project,p_target,new_id,p_user_message,p_assistant_message,u);
 result:=jsonb_build_object('target',p_target,'target_revision_id',new_id,'revision',nextrev); PERFORM creative_builder.complete_job(p_job,result); RETURN result;
END $$;

CREATE FUNCTION creative_builder.import_asset_receipt(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_expected_revision integer,p_scan uuid,p_candidate_id text,p_object_key text,p_sha256 text,p_mime text,p_width integer,p_height integer,p_bytes bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; aid uuid; result jsonb;
BEGIN
 j:=creative_builder.assert_job(p_job,p_token,p_generation,p_project,'source_import',p_expected_revision,'committing');
 IF p_scan IS DISTINCT FROM (SELECT latest_scan_id FROM creative_builder.projects WHERE id=p_project) OR p_bytes<1 OR p_bytes>j.reserved_bytes OR p_object_key !~ ('^eicagency/'||u::text||'/'||p_project::text||'/'||p_job::text||'/'||p_generation::text||'/')
 OR NOT EXISTS (SELECT 1 FROM creative_builder.scans s, LATERAL jsonb_array_elements(coalesce(s.receipt->'assets','[]'::jsonb)) asset WHERE s.id=p_scan AND s.project_id=p_project AND asset->>'id'=p_candidate_id) THEN RAISE EXCEPTION 'Invalid asset receipt' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM creative_builder.source_assets WHERE project_id=p_project)>=50 THEN RAISE EXCEPTION 'Asset limit' USING ERRCODE='54000'; END IF;
 INSERT INTO creative_builder.upload_attempts(job_id,fencing_generation,owner_id,project_id,candidate_id,object_key)
 VALUES(p_job,p_generation,u,p_project,p_candidate_id,p_object_key) ON CONFLICT(job_id,fencing_generation) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM creative_builder.upload_attempts a WHERE a.job_id=p_job AND a.fencing_generation=p_generation AND a.owner_id=u AND a.project_id=p_project AND a.candidate_id=p_candidate_id AND a.object_key=p_object_key AND a.state='planned') THEN RAISE EXCEPTION 'Upload target conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO creative_builder.source_assets(project_id,scan_id,candidate_id,object_key,sha256,mime_type,width,height,size_bytes,created_by) VALUES(p_project,p_scan,p_candidate_id,p_object_key,p_sha256,p_mime,p_width,p_height,p_bytes,u) RETURNING id INTO aid;
 UPDATE creative_builder.upload_attempts SET state='finalized',finalized_asset_id=aid,finalized_at=clock_timestamp()
 WHERE job_id=p_job AND fencing_generation=p_generation AND owner_id=u AND project_id=p_project AND object_key=p_object_key AND state='planned';
 IF NOT FOUND THEN RAISE EXCEPTION 'Upload receipt missing' USING ERRCODE='40001'; END IF;
 result:=jsonb_build_object('asset_id',aid,'sha256',p_sha256); PERFORM creative_builder.complete_job(p_job,result);
 UPDATE creative_builder.daily_usage SET completed_bytes=completed_bytes-(j.reserved_bytes-p_bytes),updated_at=clock_timestamp()
 WHERE usage_date=j.created_at::date AND operation=j.operation AND ((scope='owner' AND subject_id=j.owner_id) OR scope='tenant');
 RETURN result;
END $$;

CREATE FUNCTION creative_builder.select_concept(p_project uuid,p_expected_revision integer,p_expected_concept_set uuid,p_expected_concept_revision uuid,p_concept_handle text,p_ordered_asset_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); p creative_builder.projects; cid uuid; sid uuid; h text; source_kind text; nextrev integer; distinct_assets integer;
BEGIN
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR (p_expected_concept_set IS NULL)=(p_expected_concept_revision IS NULL) OR cardinality(coalesce(p_ordered_asset_ids,'{}'::uuid[]))>8 THEN RAISE EXCEPTION 'Selection conflict' USING ERRCODE='40001'; END IF;
 IF p_expected_concept_set IS NOT NULL THEN
  source_kind:='portfolio';
  IF p.latest_concept_set_id IS DISTINCT FROM p_expected_concept_set THEN RAISE EXCEPTION 'Concept set conflict' USING ERRCODE='40001'; END IF;
  SELECT id INTO cid FROM creative_builder.concept_revisions WHERE concept_set_id=p_expected_concept_set AND concept_handle=p_concept_handle ORDER BY revision ASC LIMIT 1;
 ELSE
  source_kind:='revision';
  SELECT c.id INTO cid FROM creative_builder.concept_revisions c WHERE c.id=p_expected_concept_revision AND c.project_id=p_project AND c.concept_set_id=p.latest_concept_set_id AND c.concept_handle=p_concept_handle
   AND NOT EXISTS(SELECT 1 FROM creative_builder.concept_revisions newer WHERE newer.concept_set_id=c.concept_set_id AND newer.concept_handle=c.concept_handle AND newer.revision>c.revision);
 END IF;
 IF cid IS NULL THEN RAISE EXCEPTION 'Concept revision conflict' USING ERRCODE='40001'; END IF;
 SELECT count(DISTINCT x),count(*) INTO distinct_assets,nextrev FROM unnest(coalesce(p_ordered_asset_ids,'{}'::uuid[])) x;
 IF distinct_assets<>nextrev OR EXISTS(SELECT 1 FROM unnest(coalesce(p_ordered_asset_ids,'{}'::uuid[])) x LEFT JOIN creative_builder.source_assets a ON a.id=x AND a.project_id=p_project AND a.created_by=u WHERE a.id IS NULL) THEN RAISE EXCEPTION 'Invalid selection asset' USING ERRCODE='22023'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('source',source_kind,'concept_set_id',p.latest_concept_set_id,'concept_revision_id',cid,'concept_handle',p_concept_handle,'asset_ids',coalesce(p_ordered_asset_ids,'{}'::uuid[]))::text,'UTF8')),'hex');
 INSERT INTO creative_builder.selections(project_id,concept_set_id,concept_revision_id,source_kind,concept_handle,ordered_asset_ids,content_hash,owner_id) VALUES(p_project,p.latest_concept_set_id,cid,source_kind,p_concept_handle,coalesce(p_ordered_asset_ids,'{}'::uuid[]),h,u) RETURNING id INTO sid;
 UPDATE creative_builder.projects SET revision=revision+1,latest_selection_id=sid,linked_studio_project_id=NULL,linked_studio_version_id=NULL,updated_at=clock_timestamp() WHERE id=p_project RETURNING revision INTO nextrev;
 RETURN jsonb_build_object('selection_id',sid,'content_hash',h,'revision',nextrev);
END $$;

CREATE FUNCTION creative_builder.resolve_import_candidate(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_expected_revision integer,p_scan uuid,p_candidate_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; candidate jsonb; existing creative_builder.source_assets; object_key text;
BEGIN
 j:=creative_builder.assert_job(p_job,p_token,p_generation,p_project,'source_import',p_expected_revision,'scanning');
 IF p_scan IS DISTINCT FROM (SELECT latest_scan_id FROM creative_builder.projects WHERE id=p_project) THEN RAISE EXCEPTION 'Stale scan' USING ERRCODE='40001'; END IF;
 SELECT asset INTO candidate FROM creative_builder.scans s,LATERAL jsonb_array_elements(coalesce(s.receipt->'assets','[]'::jsonb)) asset WHERE s.id=p_scan AND s.project_id=p_project AND asset->>'id'=p_candidate_id;
 IF candidate IS NULL OR nullif(candidate->>'sourceUrl','') IS NULL THEN RAISE EXCEPTION 'Candidate not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM creative_builder.source_assets WHERE project_id=p_project AND scan_id=p_scan AND candidate_id=p_candidate_id ORDER BY created_at DESC LIMIT 1;
 object_key:=coalesce(existing.object_key,'eicagency/'||u::text||'/'||p_project::text||'/'||p_job::text||'/'||p_generation::text||'/import.webp');
 INSERT INTO creative_builder.upload_attempts(job_id,fencing_generation,owner_id,project_id,candidate_id,object_key,state,finalized_asset_id,finalized_at)
 VALUES(p_job,p_generation,u,p_project,p_candidate_id,object_key,CASE WHEN existing.id IS NULL THEN 'planned' ELSE 'finalized' END,existing.id,CASE WHEN existing.id IS NULL THEN NULL ELSE clock_timestamp() END)
 ON CONFLICT(job_id,fencing_generation) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM creative_builder.upload_attempts a WHERE a.job_id=p_job AND a.fencing_generation=p_generation AND a.owner_id=u AND a.project_id=p_project AND a.candidate_id=p_candidate_id AND a.object_key=object_key) THEN RAISE EXCEPTION 'Upload target conflict' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('sourceUrl',candidate->>'sourceUrl','target',jsonb_build_object('objectKey',object_key,'jobId',p_job,'fencingGeneration',p_generation)) || CASE WHEN existing.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('finalized',jsonb_build_object('assetId',existing.id,'receipt',jsonb_build_object('sha256',existing.sha256,'mimeType',existing.mime_type,'width',existing.width,'height',existing.height,'sizeBytes',existing.size_bytes))) END;
END $$;

CREATE FUNCTION creative_builder.resolve_private_image(p_project uuid,p_scan uuid,p_candidate_id text,p_asset uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); result jsonb;
BEGIN
 IF (p_asset IS NULL)=(p_scan IS NULL OR p_candidate_id IS NULL) THEN RAISE EXCEPTION 'Choose one opaque image identity' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL) THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p_asset IS NOT NULL THEN SELECT jsonb_build_object('objectKey',object_key,'sha256',sha256,'mimeType',mime_type,'width',width,'height',height,'sizeBytes',size_bytes) INTO result FROM creative_builder.source_assets WHERE id=p_asset AND project_id=p_project AND created_by=u;
 ELSE SELECT jsonb_build_object('objectKey',object_key,'sha256',sha256,'mimeType',mime_type,'width',width,'height',height,'sizeBytes',size_bytes) INTO result FROM creative_builder.candidate_previews WHERE project_id=p_project AND scan_id=p_scan AND candidate_id=p_candidate_id; END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Image not found' USING ERRCODE='42501'; END IF; RETURN result;
END $$;

CREATE FUNCTION creative_builder.link_studio_output(p_project uuid,p_expected_revision integer,p_expected_selection uuid,p_studio_project uuid,p_studio_version uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); nextrev integer;
BEGIN
 UPDATE creative_builder.projects SET revision=revision+1,linked_studio_project_id=p_studio_project,linked_studio_version_id=p_studio_version,updated_at=clock_timestamp()
 WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL AND revision=p_expected_revision AND latest_selection_id=p_expected_selection AND p_studio_project IS NOT NULL AND p_studio_version IS NOT NULL RETURNING revision INTO nextrev;
 IF NOT FOUND THEN RAISE EXCEPTION 'Handoff conflict' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('revision',nextrev,'studio_project_id',p_studio_project,'studio_version_id',p_studio_version);
END $$;

CREATE FUNCTION creative_builder.fail_job(p_job uuid,p_token uuid,p_generation integer,p_project uuid,p_operation text,p_expected_revision integer,p_error_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs;
BEGIN
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job AND owner_id=u AND project_id=p_project AND operation=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
 IF j.expected_project_revision IS DISTINCT FROM p_expected_revision OR j.state IN ('completed','failed') OR j.lease_token IS DISTINCT FROM p_token OR j.fencing_generation IS DISTINCT FROM p_generation OR greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))<=clock_timestamp() THEN RAISE EXCEPTION 'Stale job fence' USING ERRCODE='40001'; END IF;
 IF p_error_code NOT IN ('scan_failed','provider_failed','invalid_result','storage_failed','commit_failed','cancelled') THEN RAISE EXCEPTION 'Invalid error code' USING ERRCODE='22023'; END IF;
 UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,error_code=p_error_code,updated_at=clock_timestamp() WHERE id=p_job;
END $$;

CREATE FUNCTION creative_builder.recover_job(p_job uuid,p_project uuid,p_operation text,p_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); j creative_builder.jobs; p creative_builder.projects; tok uuid:=gen_random_uuid(); nowts timestamptz:=clock_timestamp();
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-live:tenant:eicagency',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-live:owner:'||u::text,0));
 SELECT * INTO j FROM creative_builder.jobs WHERE id=p_job AND owner_id=u AND project_id=p_project AND operation=p_operation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' AND tombstoned_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision OR NOT creative_builder.job_target_is_current(j,p) OR j.expected_project_revision IS DISTINCT FROM p_expected_revision OR j.state IN ('completed','failed') OR greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))>nowts THEN RAISE EXCEPTION 'Job not recoverable' USING ERRCODE='40001'; END IF;
 IF j.attempts>=3 THEN UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,error_code='lease_expired',updated_at=nowts WHERE id=p_job; RETURN jsonb_build_object('job_id',p_job,'state','failed','attempts',j.attempts); END IF;
 IF EXISTS(SELECT 1 FROM creative_builder.jobs x WHERE x.id<>p_job AND x.owner_id=u AND x.state NOT IN ('completed','failed') AND greatest(x.lease_expires_at,coalesce(x.model_deadline,x.lease_expires_at))>nowts) THEN RAISE EXCEPTION 'Owner job busy' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM creative_builder.jobs x WHERE x.id<>p_job AND x.tenant_id='eicagency' AND x.state NOT IN ('completed','failed') AND greatest(x.lease_expires_at,coalesce(x.model_deadline,x.lease_expires_at))>nowts)>=creative_builder.tenant_concurrent_limit() THEN RAISE EXCEPTION 'Tenant concurrency exceeded' USING ERRCODE='55000'; END IF;
 UPDATE creative_builder.jobs SET state='reserved',attempts=attempts+1,fencing_generation=fencing_generation+1,lease_token=tok,lease_expires_at=nowts+interval '120 seconds',model_deadline=NULL,error_code=NULL,updated_at=nowts WHERE id=p_job RETURNING * INTO j;
 RETURN jsonb_build_object('job_id',j.id,'state',j.state,'lease_token',j.lease_token,'fencing_generation',j.fencing_generation,'attempts',j.attempts);
END $$;

CREATE FUNCTION creative_builder.enqueue_project_objects(p_project uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE inserted integer:=0; n integer;
BEGIN
 INSERT INTO creative_builder.cleanup_objects(owner_id,project_id,object_key,source_kind)
 SELECT p.owner_id,p.id,a.object_key,'project_asset' FROM creative_builder.projects p JOIN creative_builder.source_assets a ON a.project_id=p.id WHERE p.id=p_project AND p.tombstoned_at IS NOT NULL
 ON CONFLICT(object_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; inserted:=inserted+n;
 INSERT INTO creative_builder.cleanup_objects(owner_id,project_id,object_key,source_kind)
 SELECT p.owner_id,p.id,a.object_key,'project_preview' FROM creative_builder.projects p JOIN creative_builder.candidate_previews a ON a.project_id=p.id WHERE p.id=p_project AND p.tombstoned_at IS NOT NULL
 ON CONFLICT(object_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; inserted:=inserted+n;
 UPDATE creative_builder.projects p SET cleanup_state=CASE WHEN EXISTS(SELECT 1 FROM creative_builder.cleanup_objects c WHERE c.project_id=p.id AND c.state<>'deleted') THEN 'pending_objects' ELSE 'objects_deleted' END,updated_at=clock_timestamp() WHERE p.id=p_project AND p.tombstoned_at IS NOT NULL;
 RETURN inserted;
END $$;

CREATE FUNCTION creative_builder.delete_project(p_project uuid,p_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); p creative_builder.projects; nowts timestamptz:=clock_timestamp(); enqueued integer;
BEGIN
 SELECT * INTO p FROM creative_builder.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
 IF p.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Project conflict' USING ERRCODE='40001'; END IF;
 IF p.tombstoned_at IS NOT NULL THEN
  RETURN jsonb_build_object('project_id',p.id,'state',p.cleanup_state,'enqueued_objects',(SELECT count(*) FROM creative_builder.cleanup_objects WHERE project_id=p.id AND state<>'completed'),'linked_studio_preserved',p.linked_studio_project_id IS NOT NULL);
 END IF;
 IF EXISTS(SELECT 1 FROM creative_builder.jobs j WHERE j.project_id=p.id AND j.state NOT IN ('completed','failed') AND greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))>nowts AND j.state<>'reserved') THEN RAISE EXCEPTION 'Active job conflict' USING ERRCODE='55000'; END IF;
 UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,model_deadline=NULL,error_code='cancelled',updated_at=nowts WHERE project_id=p.id AND state='reserved';
 UPDATE creative_builder.projects SET tombstoned_at=nowts,cleanup_state='pending_objects',cleanup_after=nowts+interval '30 days',updated_at=nowts WHERE id=p.id;
 enqueued:=creative_builder.enqueue_project_objects(p.id);
 RETURN jsonb_build_object('project_id',p.id,'state',(SELECT cleanup_state FROM creative_builder.projects WHERE id=p.id),'enqueued_objects',enqueued,'linked_studio_preserved',p.linked_studio_project_id IS NOT NULL);
END $$;

CREATE FUNCTION creative_builder.lifecycle_sweep(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE nowts timestamptz:=clock_timestamp(); expired_count integer:=0; abandoned_count integer:=0; enqueued_count integer:=0; n integer; p record;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid lifecycle batch' USING ERRCODE='22023'; END IF;
 WITH stale AS (
  SELECT id FROM creative_builder.jobs WHERE state NOT IN ('completed','failed') AND greatest(lease_expires_at,coalesce(model_deadline,lease_expires_at))<=nowts ORDER BY updated_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit
 )
 UPDATE creative_builder.jobs j SET state='failed',lease_token=NULL,lease_expires_at=NULL,model_deadline=NULL,error_code='lease_expired',updated_at=nowts FROM stale WHERE j.id=stale.id;
 GET DIAGNOSTICS expired_count=ROW_COUNT;

 FOR p IN SELECT candidate.id FROM creative_builder.projects candidate
  WHERE candidate.tombstoned_at IS NULL AND candidate.updated_at<=nowts-interval '30 days' AND candidate.linked_studio_project_id IS NULL
   AND (candidate.latest_plan_revision_id IS NULL OR NOT EXISTS(SELECT 1 FROM creative_builder.plan_revisions r WHERE r.id=candidate.latest_plan_revision_id AND jsonb_array_length(r.confirmation_receipts)>0))
   AND NOT EXISTS(SELECT 1 FROM creative_builder.jobs j WHERE j.project_id=candidate.id AND j.state NOT IN ('completed','failed') AND greatest(j.lease_expires_at,coalesce(j.model_deadline,j.lease_expires_at))>nowts)
  ORDER BY candidate.updated_at,candidate.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
  UPDATE creative_builder.projects SET tombstoned_at=nowts,cleanup_state='pending_objects',cleanup_after=nowts+interval '30 days',updated_at=nowts WHERE id=p.id;
  UPDATE creative_builder.jobs SET state='failed',lease_token=NULL,lease_expires_at=NULL,model_deadline=NULL,error_code='cancelled',updated_at=nowts WHERE project_id=p.id AND state NOT IN ('completed','failed');
  abandoned_count:=abandoned_count+1; enqueued_count:=enqueued_count+creative_builder.enqueue_project_objects(p.id);
 END LOOP;

 INSERT INTO creative_builder.cleanup_objects(owner_id,project_id,object_key,source_kind)
 SELECT a.owner_id,a.project_id,a.object_key,'orphan_import' FROM creative_builder.upload_attempts a JOIN creative_builder.jobs j ON j.id=a.job_id
 WHERE a.state='planned' AND j.state='failed' AND NOT EXISTS(SELECT 1 FROM creative_builder.source_assets s WHERE s.object_key=a.object_key)
 ORDER BY a.created_at,a.job_id LIMIT p_limit ON CONFLICT(object_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; enqueued_count:=enqueued_count+n;
 RETURN jsonb_build_object('expiredJobs',expired_count,'abandonedProjects',abandoned_count,'enqueuedObjects',enqueued_count);
END $$;

CREATE FUNCTION creative_builder.claim_cleanup_objects(p_limit integer DEFAULT 20,p_lease_seconds integer DEFAULT 120) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE nowts timestamptz:=clock_timestamp(); item creative_builder.cleanup_objects; tok uuid; result jsonb:='[]'::jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN RAISE EXCEPTION 'Invalid cleanup claim' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT c.* FROM creative_builder.cleanup_objects c
  WHERE c.attempts<5 AND c.next_attempt_at<=nowts AND (c.state='pending' OR (c.state='leased' AND c.lease_expires_at<=nowts))
   AND ((c.source_kind='orphan_import' AND EXISTS(SELECT 1 FROM creative_builder.upload_attempts a WHERE a.object_key=c.object_key AND a.state='planned') AND NOT EXISTS(SELECT 1 FROM creative_builder.source_assets s WHERE s.object_key=c.object_key))
    OR (c.source_kind IN ('project_asset','project_preview') AND EXISTS(SELECT 1 FROM creative_builder.projects p WHERE p.id=c.project_id AND p.owner_id=c.owner_id AND p.tenant_id=c.tenant_id AND p.tombstoned_at IS NOT NULL)))
  ORDER BY c.next_attempt_at,c.created_at,c.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
  tok:=gen_random_uuid();
  UPDATE creative_builder.cleanup_objects SET state='leased',attempts=attempts+1,fencing_generation=fencing_generation+1,lease_token=tok,lease_expires_at=nowts+make_interval(secs=>p_lease_seconds),updated_at=nowts WHERE id=item.id RETURNING * INTO item;
  result:=result||jsonb_build_array(jsonb_build_object('id',item.id,'ownerId',item.owner_id,'tenantId',item.tenant_id,'projectId',item.project_id,'objectKey',item.object_key,'leaseToken',item.lease_token,'fencingGeneration',item.fencing_generation,'attempt',item.attempts));
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION creative_builder.complete_cleanup_object(p_id uuid,p_token uuid,p_generation integer,p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c creative_builder.cleanup_objects;
BEGIN
 SELECT * INTO c FROM creative_builder.cleanup_objects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'leased' OR c.lease_token IS DISTINCT FROM p_token OR c.fencing_generation IS DISTINCT FROM p_generation OR c.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Stale cleanup fence' USING ERRCODE='40001'; END IF;
 IF p_outcome NOT IN ('removed','not-found') THEN RAISE EXCEPTION 'Invalid cleanup outcome' USING ERRCODE='22023'; END IF;
 IF c.source_kind='orphan_import' AND (EXISTS(SELECT 1 FROM creative_builder.source_assets s WHERE s.object_key=c.object_key) OR NOT EXISTS(SELECT 1 FROM creative_builder.upload_attempts a WHERE a.object_key=c.object_key AND a.state='planned')) THEN RAISE EXCEPTION 'Finalized object protected' USING ERRCODE='40001'; END IF;
 IF c.source_kind IN ('project_asset','project_preview') AND NOT EXISTS(SELECT 1 FROM creative_builder.projects p WHERE p.id=c.project_id AND p.tombstoned_at IS NOT NULL) THEN RAISE EXCEPTION 'Live object protected' USING ERRCODE='40001'; END IF;
 UPDATE creative_builder.cleanup_objects SET state='deleted',lease_token=NULL,lease_expires_at=NULL,last_outcome=replace(p_outcome,'-','_'),updated_at=clock_timestamp() WHERE id=p_id;
 UPDATE creative_builder.projects p SET cleanup_state='objects_deleted',updated_at=clock_timestamp() WHERE p.id=c.project_id AND p.tombstoned_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM creative_builder.cleanup_objects x WHERE x.project_id=p.id AND x.state<>'deleted');
END $$;

CREATE FUNCTION creative_builder.fail_cleanup_object(p_id uuid,p_token uuid,p_generation integer,p_error_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c creative_builder.cleanup_objects; delay_seconds integer;
BEGIN
 SELECT * INTO c FROM creative_builder.cleanup_objects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'leased' OR c.lease_token IS DISTINCT FROM p_token OR c.fencing_generation IS DISTINCT FROM p_generation OR c.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Stale cleanup fence' USING ERRCODE='40001'; END IF;
 IF p_error_code<>'storage_failed' THEN RAISE EXCEPTION 'Invalid cleanup error' USING ERRCODE='22023'; END IF;
 IF c.attempts>=5 THEN
  UPDATE creative_builder.cleanup_objects SET state='failed',lease_token=NULL,lease_expires_at=NULL,last_outcome='retry_exhausted',updated_at=clock_timestamp() WHERE id=p_id;
  UPDATE creative_builder.projects SET cleanup_state='failed',updated_at=clock_timestamp() WHERE id=c.project_id AND tombstoned_at IS NOT NULL;
 ELSE
  delay_seconds:=CASE c.attempts WHEN 1 THEN 60 WHEN 2 THEN 300 WHEN 3 THEN 1800 ELSE 7200 END;
  UPDATE creative_builder.cleanup_objects SET state='pending',lease_token=NULL,lease_expires_at=NULL,next_attempt_at=clock_timestamp()+make_interval(secs=>delay_seconds),last_outcome='storage_failed',updated_at=clock_timestamp() WHERE id=p_id;
 END IF;
END $$;

CREATE FUNCTION creative_builder.purge_cleanup_projects(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE nowts timestamptz:=clock_timestamp(); p creative_builder.projects; purged integer:=0; expired integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid purge batch' USING ERRCODE='22023'; END IF;
 PERFORM set_config('creative_builder.lifecycle_purge','on',true);
 FOR p IN SELECT candidate.* FROM creative_builder.projects candidate WHERE candidate.tombstoned_at IS NOT NULL AND candidate.cleanup_state='objects_deleted' AND candidate.cleanup_after<=nowts AND NOT EXISTS(SELECT 1 FROM creative_builder.cleanup_objects c WHERE c.project_id=candidate.id AND c.state<>'deleted') ORDER BY candidate.cleanup_after,candidate.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
  INSERT INTO creative_builder.project_tombstones(project_id,owner_id,tenant_id,tombstoned_at,purged_at,expires_at) VALUES(p.id,p.owner_id,p.tenant_id,p.tombstoned_at,nowts,nowts+interval '30 days');
  UPDATE creative_builder.projects SET latest_scan_id=NULL,latest_plan_revision_id=NULL,latest_concept_set_id=NULL,latest_selection_id=NULL,content_purged_at=nowts WHERE id=p.id;
  DELETE FROM creative_builder.upload_attempts WHERE project_id=p.id;
  DELETE FROM creative_builder.cleanup_objects WHERE project_id=p.id;
  DELETE FROM creative_builder.selections WHERE project_id=p.id;
  DELETE FROM creative_builder.messages WHERE project_id=p.id;
  DELETE FROM creative_builder.concept_revisions WHERE project_id=p.id;
  DELETE FROM creative_builder.concept_sets WHERE project_id=p.id;
  DELETE FROM creative_builder.plan_revisions WHERE project_id=p.id;
  DELETE FROM creative_builder.source_assets WHERE project_id=p.id;
  DELETE FROM creative_builder.candidate_previews WHERE project_id=p.id;
  DELETE FROM creative_builder.scans WHERE project_id=p.id;
  DELETE FROM creative_builder.jobs WHERE project_id=p.id;
  DELETE FROM creative_builder.projects WHERE id=p.id;
  purged:=purged+1;
 END LOOP;
 WITH gone AS (SELECT project_id FROM creative_builder.project_tombstones WHERE expires_at<=nowts ORDER BY expires_at,project_id LIMIT p_limit FOR UPDATE SKIP LOCKED) DELETE FROM creative_builder.project_tombstones t USING gone WHERE t.project_id=gone.project_id;
 GET DIAGNOSTICS expired=ROW_COUNT;
 RETURN jsonb_build_object('purgedProjects',purged,'expiredTombstones',expired);
END $$;

ALTER TABLE creative_builder.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.plan_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.concept_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.concept_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.candidate_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.upload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.cleanup_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_builder.project_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA creative_builder FROM PUBLIC, anon, authenticated, service_role, creative_builder_repository, creative_builder_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creative_builder FROM PUBLIC, anon, authenticated, service_role, creative_builder_repository, creative_builder_worker;

GRANT EXECUTE ON FUNCTION creative_builder.create_project(text,text),creative_builder.list_projects(integer,timestamptz,uuid),creative_builder.read_project(uuid),creative_builder.edit_plan(uuid,uuid,integer,uuid,jsonb,jsonb),creative_builder.confirm_plan(uuid,uuid,integer,text[]),creative_builder.reserve_job(uuid,integer,text,text,integer,bigint,text,uuid),creative_builder.select_concept(uuid,integer,uuid,uuid,text,uuid[]),creative_builder.link_studio_output(uuid,integer,uuid,uuid,uuid),creative_builder.delete_project(uuid,integer) TO creative_builder_repository;
GRANT EXECUTE ON FUNCTION creative_builder.read_project(uuid),creative_builder.read_project_canonical(uuid),creative_builder.transition_job(uuid,uuid,integer,uuid,text,integer,text,integer),creative_builder.renew_job(uuid,uuid,integer,uuid,text,integer,integer),creative_builder.commit_analysis(uuid,uuid,integer,uuid,integer,uuid,jsonb,jsonb,jsonb,jsonb),creative_builder.commit_concepts(uuid,uuid,integer,uuid,integer,uuid,jsonb),creative_builder.commit_revision(uuid,uuid,integer,uuid,integer,text,uuid,text,jsonb,text,text),creative_builder.import_asset_receipt(uuid,uuid,integer,uuid,integer,uuid,text,text,text,text,integer,integer,bigint),creative_builder.fail_job(uuid,uuid,integer,uuid,text,integer,text),creative_builder.recover_job(uuid,uuid,text,integer),creative_builder.resolve_import_candidate(uuid,uuid,integer,uuid,integer,uuid,text),creative_builder.resolve_private_image(uuid,uuid,text,uuid),creative_builder.lifecycle_sweep(integer),creative_builder.claim_cleanup_objects(integer,integer),creative_builder.complete_cleanup_object(uuid,uuid,integer,text),creative_builder.fail_cleanup_object(uuid,uuid,integer,text),creative_builder.purge_cleanup_projects(integer) TO creative_builder_worker;

COMMIT;
