-- DRAFT local-only extension. No production role/login provisioning.
BEGIN;
CREATE FUNCTION creative_studio.claim_project(p_project uuid) RETURNS SETOF creative_studio.jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); jid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM creative_studio.projects WHERE id=p_project AND owner_id=u AND tenant_id='eicagency') THEN
  RAISE EXCEPTION 'Project not found' USING ERRCODE='42501';
 END IF;
 -- Same global single-live-lease slot as legacy claim(); never one slot per owner.
 PERFORM pg_advisory_xact_lock(hashtextextended('studio-worker:global',0));
 IF EXISTS(SELECT 1 FROM creative_studio.jobs WHERE status='running' AND lease_expires_at>clock_timestamp()) THEN RETURN; END IF;
 UPDATE creative_studio.jobs j SET status='failed',lease_token=NULL,lease_expires_at=NULL,error_code='lease_expired'
 FROM creative_studio.versions v WHERE j.version_id=v.id AND v.project_id=p_project AND j.status='running' AND j.lease_expires_at<=clock_timestamp() AND j.attempts>=3;
 SELECT j.id INTO jid FROM creative_studio.jobs j JOIN creative_studio.versions v ON v.id=j.version_id
 WHERE v.project_id=p_project AND j.attempts<3 AND (j.status='queued' OR (j.status='running' AND j.lease_expires_at<=clock_timestamp()))
 AND v.recipes->j.placement_id->'placement'->>'mimeType'='image/png'
 ORDER BY j.created_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF jid IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE creative_studio.jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '120 seconds',error_code=NULL WHERE id=jid RETURNING *;
END $$;
REVOKE ALL ON FUNCTION creative_studio.claim_project(uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Approval-gated provisioner must create a NOLOGIN NOSUPERUSER NOBYPASSRLS
-- creative_studio_worker role with schema USAGE and ONLY EXECUTE on:
-- claim_project(uuid), read_project(uuid), finish(uuid,uuid,boolean,text,text,bigint,integer,integer,boolean).
-- Dedicated NOINHERIT login: membership ONLY in worker role, no table grants,
-- no service_role or repository membership. Legacy claim() is NOT granted.
COMMIT;
