-- REVIEW DRAFT. Apply only after creative_studio.sql and creative_builder.sql.
-- Additive, collision-sensitive bridge; legacy Studio RPCs and tables are unchanged.
BEGIN;

CREATE ROLE creative_studio_repository NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA creative_studio TO creative_studio_repository;

CREATE TABLE creative_builder.studio_handoffs (
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id='eicagency'),
  handoff_key text NOT NULL CHECK (handoff_key ~ '^[0-9a-f]{64}$'),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  builder_project_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  selection_content_sha256 text NOT NULL CHECK (selection_content_sha256 ~ '^[0-9a-f]{64}$'),
  studio_project_id uuid,
  studio_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  linked_at timestamptz,
  PRIMARY KEY(owner_id,handoff_key),
  UNIQUE(builder_project_id,selection_id),
  FOREIGN KEY(builder_project_id,selection_id) REFERENCES creative_builder.selections(project_id,id),
  CHECK ((studio_project_id IS NULL)=(studio_version_id IS NULL)),
  CHECK ((studio_project_id IS NULL)=(linked_at IS NULL))
);

CREATE TABLE creative_studio.builder_handoffs (
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id text NOT NULL DEFAULT 'eicagency' CHECK (tenant_id='eicagency'),
  handoff_key text NOT NULL CHECK (handoff_key ~ '^[0-9a-f]{64}$'),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  project_id uuid NOT NULL,
  version_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(owner_id,handoff_key),
  UNIQUE(project_id,version_id),
  FOREIGN KEY(project_id,version_id) REFERENCES creative_studio.versions(project_id,id)
);

CREATE FUNCTION creative_builder.reserve_studio_handoff(p_project uuid,p_expected_revision integer,p_selection uuid,p_handoff_key text,p_artifact_sha256 text,p_selection_sha256 text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); r creative_builder.studio_handoffs;
BEGIN
 IF p_handoff_key !~ '^[0-9a-f]{64}$' OR p_artifact_sha256 !~ '^[0-9a-f]{64}$' OR p_selection_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid handoff' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('builder-handoff:'||u::text||':'||p_handoff_key,0));
 IF NOT EXISTS(SELECT 1 FROM creative_builder.projects p JOIN creative_builder.selections s ON s.project_id=p.id WHERE p.id=p_project AND p.owner_id=u AND p.tenant_id='eicagency' AND p.tombstoned_at IS NULL AND p.revision=p_expected_revision AND p.latest_selection_id=p_selection AND s.id=p_selection AND s.owner_id=u AND s.content_hash=p_selection_sha256) THEN RAISE EXCEPTION 'Stale handoff' USING ERRCODE='40001'; END IF;
 INSERT INTO creative_builder.studio_handoffs(owner_id,handoff_key,artifact_sha256,builder_project_id,selection_id,selection_content_sha256)
 VALUES(u,p_handoff_key,p_artifact_sha256,p_project,p_selection,p_selection_sha256) ON CONFLICT(owner_id,handoff_key) DO NOTHING;
 SELECT * INTO r FROM creative_builder.studio_handoffs WHERE owner_id=u AND handoff_key=p_handoff_key;
 IF r.artifact_sha256 IS DISTINCT FROM p_artifact_sha256 OR r.builder_project_id IS DISTINCT FROM p_project OR r.selection_id IS DISTINCT FROM p_selection OR r.selection_content_sha256 IS DISTINCT FROM p_selection_sha256 THEN RAISE EXCEPTION 'Handoff conflict' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('handoff_key',r.handoff_key,'artifact_sha256',r.artifact_sha256,'builder_project_id',r.builder_project_id,'selection_id',r.selection_id,'selection_content_sha256',r.selection_content_sha256,'studio_project_id',r.studio_project_id,'studio_version_id',r.studio_version_id);
END $$;

CREATE FUNCTION creative_builder.read_studio_handoff(p_handoff_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); r creative_builder.studio_handoffs;
BEGIN
 SELECT * INTO r FROM creative_builder.studio_handoffs WHERE owner_id=u AND tenant_id='eicagency' AND handoff_key=p_handoff_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('handoff_key',r.handoff_key,'artifact_sha256',r.artifact_sha256,'builder_project_id',r.builder_project_id,'selection_id',r.selection_id,'selection_content_sha256',r.selection_content_sha256,'studio_project_id',r.studio_project_id,'studio_version_id',r.studio_version_id);
END $$;

CREATE FUNCTION creative_builder.link_studio_handoff(p_handoff_key text,p_artifact_sha256 text,p_studio_project uuid,p_studio_version uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_builder.actor(); r creative_builder.studio_handoffs;
BEGIN
 SELECT * INTO r FROM creative_builder.studio_handoffs WHERE owner_id=u AND tenant_id='eicagency' AND handoff_key=p_handoff_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Handoff not found' USING ERRCODE='42501'; END IF;
 IF r.artifact_sha256 IS DISTINCT FROM p_artifact_sha256 OR (r.studio_project_id IS NOT NULL AND (r.studio_project_id IS DISTINCT FROM p_studio_project OR r.studio_version_id IS DISTINCT FROM p_studio_version)) THEN RAISE EXCEPTION 'Handoff conflict' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creative_studio.builder_handoffs h WHERE h.owner_id=u AND h.handoff_key=p_handoff_key AND h.artifact_sha256=p_artifact_sha256 AND h.project_id=p_studio_project AND h.version_id=p_studio_version) THEN RAISE EXCEPTION 'Studio handoff mismatch' USING ERRCODE='40001'; END IF;
 UPDATE creative_builder.studio_handoffs SET studio_project_id=p_studio_project,studio_version_id=p_studio_version,linked_at=coalesce(linked_at,clock_timestamp()) WHERE owner_id=u AND handoff_key=p_handoff_key AND studio_project_id IS NULL;
 UPDATE creative_builder.projects SET linked_studio_project_id=p_studio_project,linked_studio_version_id=p_studio_version,updated_at=clock_timestamp() WHERE id=r.builder_project_id AND owner_id=u AND latest_selection_id=r.selection_id;
END $$;

CREATE FUNCTION creative_studio.create_handoff_artwork(p_handoff_key text,p_artifact_sha256 text,p_brief jsonb,p_scene jsonb,p_sources jsonb,p_recipes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_studio.actor(); h creative_studio.builder_handoffs; vid uuid; pid uuid;
BEGIN
 IF p_handoff_key !~ '^[0-9a-f]{64}$' OR p_artifact_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid handoff' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('studio-handoff:'||u::text||':'||p_handoff_key,0));
 SELECT * INTO h FROM creative_studio.builder_handoffs WHERE owner_id=u AND handoff_key=p_handoff_key;
 IF FOUND THEN
  IF h.artifact_sha256 IS DISTINCT FROM p_artifact_sha256 THEN RAISE EXCEPTION 'Handoff conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('handoff_key',h.handoff_key,'artifact_sha256',h.artifact_sha256,'project_id',h.project_id,'version_id',h.version_id);
 END IF;
 vid:=creative_studio.save_version(NULL,NULL,p_brief,p_scene,p_sources,p_recipes);
 SELECT project_id INTO pid FROM creative_studio.versions WHERE id=vid;
 INSERT INTO creative_studio.builder_handoffs(owner_id,handoff_key,artifact_sha256,project_id,version_id) VALUES(u,p_handoff_key,p_artifact_sha256,pid,vid) RETURNING * INTO h;
 RETURN jsonb_build_object('handoff_key',h.handoff_key,'artifact_sha256',h.artifact_sha256,'project_id',h.project_id,'version_id',h.version_id);
END $$;

CREATE FUNCTION creative_studio.read_handoff_artwork(p_handoff_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=creative_studio.actor(); h creative_studio.builder_handoffs;
BEGIN
 SELECT * INTO h FROM creative_studio.builder_handoffs WHERE owner_id=u AND tenant_id='eicagency' AND handoff_key=p_handoff_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('handoff_key',h.handoff_key,'artifact_sha256',h.artifact_sha256,'project_id',h.project_id,'version_id',h.version_id);
END $$;

ALTER TABLE creative_builder.studio_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_studio.builder_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE creative_builder.studio_handoffs,creative_studio.builder_handoffs FROM PUBLIC,anon,authenticated,service_role,creative_builder_repository,creative_builder_worker,creative_studio_repository;
REVOKE ALL ON FUNCTION creative_builder.reserve_studio_handoff(uuid,integer,uuid,text,text,text),creative_builder.read_studio_handoff(text),creative_builder.link_studio_handoff(text,text,uuid,uuid),creative_studio.create_handoff_artwork(text,text,jsonb,jsonb,jsonb,jsonb),creative_studio.read_handoff_artwork(text) FROM PUBLIC,anon,authenticated,service_role,creative_builder_repository,creative_builder_worker,creative_studio_repository;
GRANT EXECUTE ON FUNCTION creative_builder.reserve_studio_handoff(uuid,integer,uuid,text,text,text),creative_builder.read_studio_handoff(text),creative_builder.link_studio_handoff(text,text,uuid,uuid) TO creative_builder_worker;
GRANT EXECUTE ON FUNCTION creative_studio.create_handoff_artwork(text,text,jsonb,jsonb,jsonb,jsonb),creative_studio.read_handoff_artwork(text) TO creative_studio_repository;
COMMIT;
