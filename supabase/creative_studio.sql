-- REVIEW DRAFT. Separate concrete production approval required. Never auto-apply.
-- One-shot additive migration: fail on collisions rather than silently accept drift.
-- Dedicated, non-exposed schema; only narrowly granted RPCs, no table DML grants.
BEGIN;
CREATE SCHEMA creative_studio;
REVOKE ALL ON SCHEMA creative_studio FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA creative_studio TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA creative_studio REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Eligibility reuses protected public.profiles; no Studio-specific enrollment table.
CREATE TABLE creative_studio.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id = 'eicagency'),
  planning_brief jsonb CHECK (jsonb_typeof(planning_brief) = 'object'),
  latest_direction_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  latest_version_id uuid,
  approved_version_id uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((approved_version_id IS NULL) = (approved_at IS NULL)),
  CHECK (approved_version_id IS NULL OR approved_version_id = latest_version_id)
);
-- Full Direction JSON, including Idea developments/drafts/content, is never projected
-- into a lossy subset. Semantic validation remains in the trusted server schemas.
CREATE TABLE creative_studio.directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_studio.projects(id),
  parent_id uuid,
  revision integer NOT NULL CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  brief jsonb NOT NULL CHECK (jsonb_typeof(brief) = 'object'),
  style_snapshot jsonb NOT NULL CHECK (jsonb_typeof(style_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, id),
  UNIQUE (project_id, revision),
  FOREIGN KEY (project_id, parent_id) REFERENCES creative_studio.directions(project_id, id)
);
ALTER TABLE creative_studio.projects ADD CONSTRAINT studio_direction_fk
  FOREIGN KEY (id, latest_direction_id) REFERENCES creative_studio.directions(project_id, id);
CREATE INDEX studio_owner_list_idx ON creative_studio.projects(owner_id, tenant_id, created_at, id);
CREATE TABLE creative_studio.versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES creative_studio.projects(id),
  parent_id uuid,
  brief jsonb NOT NULL CHECK (jsonb_typeof(brief) = 'object'),
  scene jsonb NOT NULL CHECK (jsonb_typeof(scene) = 'object'),
  source_snapshot jsonb NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
  -- keyed by placement id; each entry contains saved HTML with embedded original
  -- assets, placement snapshot and SHA256 of those exact UTF-8 HTML bytes.
  recipes jsonb NOT NULL CHECK (jsonb_typeof(recipes) = 'object' AND recipes <> '{}'::jsonb),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, parent_id) REFERENCES creative_studio.versions(project_id, id)
);
ALTER TABLE creative_studio.projects ADD CONSTRAINT studio_latest_fk
  FOREIGN KEY (id, latest_version_id) REFERENCES creative_studio.versions(project_id, id);
ALTER TABLE creative_studio.projects ADD CONSTRAINT studio_approved_fk
  FOREIGN KEY (id, approved_version_id) REFERENCES creative_studio.versions(project_id, id);
CREATE TABLE creative_studio.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES creative_studio.versions(id),
  placement_id text NOT NULL,
  recipe_sha256 text NOT NULL CHECK (recipe_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text CHECK (error_code IN ('render_failed','lease_expired','qa_failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, placement_id, recipe_sha256),
  CHECK ((status = 'running') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status = 'running' OR (lease_token IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX studio_job_claim_idx ON creative_studio.jobs(status, created_at);
CREATE TABLE creative_studio.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES creative_studio.jobs(id),
  object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 8192),
  qa_passed boolean NOT NULL,
  finalized_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE creative_studio.reviews (
  asset_id uuid PRIMARY KEY REFERENCES creative_studio.assets(id),
  approved boolean NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

-- SQL callers must be a trusted backend with server-minted, short-lived claims.
-- Do not forward a browser JWT, user_metadata, or request-body identity here.
-- Existing generic service-role JWT intentionally fails (missing owner claim).
CREATE FUNCTION creative_studio.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid; claims jsonb := auth.jwt();
BEGIN
  IF claims->>'role' IS DISTINCT FROM 'service_role'
     OR claims->>'creative_studio_tenant' IS DISTINCT FROM 'eicagency' THEN
    RAISE EXCEPTION 'Studio backend authorization required' USING ERRCODE = '42501';
  END IF;
  u := (claims->>'creative_studio_owner')::uuid;
  IF u IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u
    AND (p.role IN ('agency','super_admin') OR (p.role = 'client' AND 'eicagency' = ANY(p.client_access)))) THEN
    RAISE EXCEPTION 'Studio owner denied' USING ERRCODE = '42501';
  END IF;
  RETURN u;
END $$;
CREATE FUNCTION creative_studio.immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Immutable Studio history' USING ERRCODE = '55000'; END $$;
CREATE TRIGGER studio_versions_immutable BEFORE UPDATE OR DELETE ON creative_studio.versions
FOR EACH ROW EXECUTE FUNCTION creative_studio.immutable();
CREATE TRIGGER studio_assets_immutable BEFORE UPDATE OR DELETE ON creative_studio.assets
FOR EACH ROW EXECUTE FUNCTION creative_studio.immutable();

CREATE TRIGGER studio_directions_immutable BEFORE UPDATE OR DELETE ON creative_studio.directions
FOR EACH ROW EXECUTE FUNCTION creative_studio.immutable();

-- NULL project creates direction-only project; planning brief is create-only.
-- Existing artwork projects can acquire directions without changing artwork history.
CREATE FUNCTION creative_studio.save_direction(p_project uuid, p_expected uuid,
  p_planning_brief jsonb, p_direction jsonb, p_style_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); pid uuid := p_project; current_id uuid; did uuid; rev integer;
BEGIN
  IF jsonb_typeof(p_direction) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_style_snapshot) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_direction->'styleId') IS DISTINCT FROM 'string'
    OR p_direction->>'styleId' IS DISTINCT FROM p_style_snapshot->>'id'
    OR octet_length(p_direction::text) > 1048576
    OR octet_length(p_style_snapshot::text) > 1048576 THEN
    RAISE EXCEPTION 'Invalid direction snapshot' USING ERRCODE = '22023';
  END IF;
  IF pid IS NULL THEN
    IF p_expected IS NOT NULL OR jsonb_typeof(p_planning_brief) IS DISTINCT FROM 'object'
      OR octet_length(p_planning_brief::text) > 1048576 THEN
      RAISE EXCEPTION 'New direction requires planning brief and no expected revision' USING ERRCODE = '22023';
    END IF;
    INSERT INTO creative_studio.projects(owner_id,planning_brief) VALUES(u,p_planning_brief) RETURNING id INTO pid;
  ELSIF p_planning_brief IS NOT NULL THEN
    RAISE EXCEPTION 'Planning brief is create-only' USING ERRCODE = '22023';
  END IF;
  SELECT latest_direction_id INTO current_id FROM creative_studio.projects
    WHERE id = pid AND owner_id = u AND tenant_id = 'eicagency' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  IF current_id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Direction conflict' USING ERRCODE = '40001'; END IF;
  SELECT coalesce(max(d.revision),0)+1 INTO rev FROM creative_studio.directions d WHERE d.project_id=pid;
  INSERT INTO creative_studio.directions(project_id,parent_id,revision,created_by,brief,style_snapshot)
    VALUES(pid,current_id,rev,u,p_direction,p_style_snapshot) RETURNING id INTO did;
  UPDATE creative_studio.projects SET latest_direction_id=did, updated_at=clock_timestamp() WHERE id=pid;
  RETURN jsonb_build_object('project_id',pid,'direction_id',did,'revision',rev);
END $$;

-- Stable created_at/id cursor (not mutable updated_at); no render/recovery side effects.
CREATE FUNCTION creative_studio.list_projects(p_limit integer DEFAULT 50,
  p_after_created_at timestamptz DEFAULT NULL, p_after_id uuid DEFAULT NULL)
RETURNS SETOF creative_studio.projects
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor();
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_after_created_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid page' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT p.* FROM creative_studio.projects p
    WHERE p.owner_id=u AND p.tenant_id='eicagency'
      AND (p_after_id IS NULL OR (p.created_at,p.id) > (p_after_created_at,p_after_id))
    ORDER BY p.created_at,p.id LIMIT p_limit;
END $$;

-- One project snapshot; all child rows are reached only through its authorized id.
-- Internal backend DTO, not a public API payload. Never expose recipes/object keys
-- or lease tokens to browser clients. This read deliberately omits lease tokens.
CREATE FUNCTION creative_studio.read_project(p_project uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); result jsonb;
BEGIN
  SELECT jsonb_build_object('project',to_jsonb(p),
    'directions',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.revision)
      FROM creative_studio.directions d WHERE d.project_id=p.id),'[]'::jsonb),
    'versions',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at,v.id)
      FROM creative_studio.versions v WHERE v.project_id=p.id),'[]'::jsonb),
    'jobs',coalesce((SELECT jsonb_agg(to_jsonb(j)-'lease_token' ORDER BY j.created_at,j.id)
      FROM creative_studio.jobs j JOIN creative_studio.versions v ON v.id=j.version_id WHERE v.project_id=p.id),'[]'::jsonb),
    'assets',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.finalized_at,a.id)
      FROM creative_studio.assets a JOIN creative_studio.jobs j ON j.id=a.job_id
      JOIN creative_studio.versions v ON v.id=j.version_id WHERE v.project_id=p.id),'[]'::jsonb),
    'reviews',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.asset_id)
      FROM creative_studio.reviews r JOIN creative_studio.assets a ON a.id=r.asset_id
      JOIN creative_studio.jobs j ON j.id=a.job_id JOIN creative_studio.versions v ON v.id=j.version_id
      WHERE v.project_id=p.id),'[]'::jsonb)) INTO result
  FROM creative_studio.projects p WHERE p.id=p_project AND p.owner_id=u AND p.tenant_id='eicagency';
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION creative_studio.save_version(p_project uuid, p_expected uuid,
  p_brief jsonb, p_scene jsonb, p_sources jsonb, p_recipes jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); pid uuid := p_project; current_id uuid; vid uuid; r record;
BEGIN
  IF p_recipes IS NULL OR jsonb_typeof(p_recipes) <> 'object' OR p_recipes = '{}'::jsonb
    OR octet_length(p_recipes::text) > 16777216 THEN RAISE EXCEPTION 'Invalid recipes'; END IF;
  FOR r IN SELECT key, value FROM jsonb_each(p_recipes) LOOP
    IF r.key !~ '^[a-zA-Z0-9:_-]{1,80}$' OR jsonb_typeof(r.value) IS DISTINCT FROM 'object'
      OR jsonb_typeof(r.value->'placement') IS DISTINCT FROM 'object'
      OR jsonb_typeof(r.value->'html') IS DISTINCT FROM 'string'
      OR coalesce(length(r.value->>'html'),0) = 0
      OR coalesce(r.value->>'sha256','') !~ '^[0-9a-f]{64}$'
      OR r.value->>'sha256' IS DISTINCT FROM encode(sha256(convert_to(r.value->>'html','UTF8')),'hex')
      OR coalesce(r.value->'placement'->>'width','') !~ '^[1-9][0-9]{0,3}$'
      OR coalesce(r.value->'placement'->>'height','') !~ '^[1-9][0-9]{0,3}$'
      OR coalesce(r.value->'placement'->>'maxBytes','') !~ '^[1-9][0-9]{0,7}$'
      OR coalesce(r.value->'placement'->>'mimeType','') NOT IN ('image/png','image/jpeg') THEN
      RAISE EXCEPTION 'Invalid recipe entry';
    END IF;
  END LOOP;
  IF pid IS NULL THEN
    IF p_expected IS NOT NULL THEN RAISE EXCEPTION 'New project cannot have expected version'; END IF;
    INSERT INTO creative_studio.projects(owner_id) VALUES (u) RETURNING id INTO pid;
  END IF;
  SELECT latest_version_id INTO current_id FROM creative_studio.projects
    WHERE id = pid AND owner_id = u AND tenant_id = 'eicagency' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  IF current_id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE = '40001'; END IF;
  INSERT INTO creative_studio.versions(project_id,parent_id,brief,scene,source_snapshot,recipes)
    VALUES(pid,current_id,p_brief,p_scene,p_sources,p_recipes) RETURNING id INTO vid;
  UPDATE creative_studio.projects SET latest_version_id = vid, approved_version_id = NULL, approved_at = NULL, updated_at=clock_timestamp() WHERE id = pid;
  RETURN vid;
END $$;

CREATE FUNCTION creative_studio.enqueue(p_project uuid, p_expected uuid, p_placement text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); v uuid; h text; jid uuid;
BEGIN
  SELECT latest_version_id INTO v FROM creative_studio.projects
    WHERE id = p_project AND owner_id = u AND tenant_id = 'eicagency' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  IF v IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE = '40001'; END IF;
  SELECT recipes->p_placement->>'sha256' INTO h FROM creative_studio.versions WHERE id = v;
  IF h IS NULL THEN RAISE EXCEPTION 'Unknown placement'; END IF;
  INSERT INTO creative_studio.jobs(version_id,placement_id,recipe_sha256) VALUES(v,p_placement,h)
    ON CONFLICT (version_id,placement_id,recipe_sha256) DO NOTHING RETURNING id INTO jid;
  IF jid IS NULL THEN SELECT id INTO jid FROM creative_studio.jobs WHERE version_id=v AND placement_id=p_placement AND recipe_sha256=h; END IF;
  RETURN jid;
END $$;

-- Fixed 120s leases, maximum 3 attempts. Explicit worker/reconciler call only;
-- GET/list must not call this. Expired terminal attempts become visibly failed.
CREATE FUNCTION creative_studio.claim() RETURNS SETOF creative_studio.jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); jid uuid;
BEGIN
  -- Global single live lease, shared with claim_project across all eligible owners.
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-worker:global',0));
  IF EXISTS (SELECT 1 FROM creative_studio.jobs WHERE status='running' AND lease_expires_at>clock_timestamp()) THEN RETURN; END IF;
  UPDATE creative_studio.jobs j SET status='failed', lease_token=NULL, lease_expires_at=NULL, error_code='lease_expired'
    FROM creative_studio.versions v, creative_studio.projects p
    WHERE j.version_id=v.id AND v.project_id=p.id AND p.owner_id=u AND p.tenant_id='eicagency'
    AND j.status='running' AND j.lease_expires_at <= clock_timestamp() AND j.attempts >= 3;
  SELECT j.id INTO jid FROM creative_studio.jobs j
    JOIN creative_studio.versions v ON v.id=j.version_id JOIN creative_studio.projects p ON p.id=v.project_id
    WHERE p.owner_id=u AND p.tenant_id='eicagency' AND j.attempts < 3
    AND (j.status='queued' OR (j.status='running' AND j.lease_expires_at <= clock_timestamp()))
    ORDER BY j.created_at, j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1;
  IF jid IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE creative_studio.jobs SET status='running', attempts=attempts+1,
    lease_token=gen_random_uuid(), lease_expires_at=clock_timestamp()+interval '120 seconds', error_code=NULL
    WHERE id=jid RETURNING *;
END $$;

-- Upload BEFORE finalize, create-only, to the exact attempt-token-qualified key.
-- DB cannot verify Storage bytes: trusted worker verifies hash, MIME, dimensions,
-- byte limit, QA and object existence before invoking this transaction.
CREATE FUNCTION creative_studio.finish(p_job uuid, p_token uuid, p_success boolean,
  p_sha256 text DEFAULT NULL, p_mime text DEFAULT NULL, p_bytes bigint DEFAULT NULL,
  p_width integer DEFAULT NULL, p_height integer DEFAULT NULL, p_qa boolean DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); j creative_studio.jobs; pid uuid; aid uuid; key text; placement jsonb;
BEGIN
  SELECT jobs.* INTO j FROM creative_studio.jobs jobs
    JOIN creative_studio.versions v ON v.id=jobs.version_id JOIN creative_studio.projects p ON p.id=v.project_id
    WHERE jobs.id=p_job AND p.owner_id=u AND p.tenant_id='eicagency' FOR UPDATE OF jobs;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE = '42501'; END IF;
  IF j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_token OR j.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Stale lease' USING ERRCODE = '40001';
  END IF;
  IF p_success IS NULL THEN RAISE EXCEPTION 'Missing result'; END IF;
  IF NOT p_success THEN
    UPDATE creative_studio.jobs SET status=CASE WHEN attempts < 3 THEN 'queued' ELSE 'failed' END,
      lease_token=NULL,lease_expires_at=NULL,error_code='render_failed' WHERE id=p_job;
    RETURN NULL;
  END IF;
  SELECT project_id, recipes->j.placement_id->'placement' INTO pid, placement FROM creative_studio.versions WHERE id=j.version_id;
  IF p_width IS DISTINCT FROM (placement->>'width')::integer OR p_height IS DISTINCT FROM (placement->>'height')::integer
    OR p_mime IS DISTINCT FROM placement->>'mimeType' OR p_bytes > (placement->>'maxBytes')::bigint THEN
    RAISE EXCEPTION 'Placement mismatch';
  END IF;
  key := 'eicagency/'||u::text||'/'||pid::text||'/'||j.version_id::text||'/'||j.placement_id||'/'||p_job::text||'/'||p_token::text;
  INSERT INTO creative_studio.assets(job_id,object_key,sha256,mime_type,size_bytes,width,height,qa_passed)
    VALUES(p_job,key,p_sha256,p_mime,p_bytes,p_width,p_height,p_qa) RETURNING id INTO aid;
  UPDATE creative_studio.jobs SET status='complete',lease_token=NULL,lease_expires_at=NULL,
    error_code=CASE WHEN p_qa THEN NULL ELSE 'qa_failed' END WHERE id=p_job;
  RETURN aid;
END $$;

CREATE FUNCTION creative_studio.review_asset(p_project uuid, p_expected uuid, p_asset uuid, p_approved boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); v uuid;
BEGIN
  SELECT latest_version_id INTO v FROM creative_studio.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  IF v IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE = '40001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM creative_studio.assets a JOIN creative_studio.jobs j ON j.id=a.job_id
      WHERE a.id=p_asset AND j.version_id=v AND j.status='complete' AND (NOT p_approved OR a.qa_passed)) THEN
    RAISE EXCEPTION 'Asset not reviewable'; END IF;
  INSERT INTO creative_studio.reviews(asset_id,approved) VALUES(p_asset,p_approved)
    ON CONFLICT (asset_id) DO UPDATE SET approved=excluded.approved,reviewed_at=now();
  UPDATE creative_studio.projects SET approved_version_id=NULL,approved_at=NULL WHERE id=p_project;
END $$;
CREATE FUNCTION creative_studio.approve(p_project uuid, p_expected uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); v uuid;
BEGIN
  SELECT latest_version_id INTO v FROM creative_studio.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501'; END IF;
  IF v IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE = '40001'; END IF;
  IF v IS NULL THEN RAISE EXCEPTION 'Artwork version required' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM creative_studio.versions ver CROSS JOIN LATERAL jsonb_each(ver.recipes) r
    WHERE ver.id=v AND NOT EXISTS (
      SELECT 1 FROM creative_studio.jobs j JOIN creative_studio.assets a ON a.job_id=j.id
      JOIN creative_studio.reviews review ON review.asset_id=a.id
      WHERE j.version_id=v AND j.placement_id=r.key AND j.recipe_sha256=r.value->>'sha256'
      AND j.status='complete' AND a.qa_passed AND review.approved)) THEN
    RAISE EXCEPTION 'Every placement requires QA and human review'; END IF;
  UPDATE creative_studio.projects SET approved_version_id=v,approved_at=now() WHERE id=p_project;
END $$;

-- Defense in depth: clients have no table access, no permissive policies.

ALTER TABLE creative_studio.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA creative_studio FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creative_studio FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION creative_studio.save_version(uuid,uuid,jsonb,jsonb,jsonb,jsonb),
  creative_studio.save_direction(uuid,uuid,jsonb,jsonb,jsonb),
  creative_studio.list_projects(integer,timestamptz,uuid), creative_studio.read_project(uuid),
  creative_studio.enqueue(uuid,uuid,text), creative_studio.claim(),
  creative_studio.finish(uuid,uuid,boolean,text,text,bigint,integer,integer,boolean),
  creative_studio.review_asset(uuid,uuid,uuid,boolean), creative_studio.approve(uuid,uuid)
TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('creative-studio-private','creative-studio-private',false,20971520,ARRAY['image/png','image/jpeg']);
-- Restrictive denial guards existing permissive policies from other features.
-- Storage bytes only through an authorized backend proxy. service_role bypasses RLS:
-- never expose it, never upsert/delete finalized keys; scoped storage adapter needed.
CREATE POLICY studio_no_client_storage ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'creative-studio-private') WITH CHECK (bucket_id <> 'creative-studio-private');
COMMIT;
