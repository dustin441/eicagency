-- DRAFT ONLY: apply after creative_studio.sql in an approved disposable database.
-- Existing save_version(uuid,uuid,jsonb,jsonb,jsonb,jsonb) return type stays unchanged.
BEGIN;
CREATE FUNCTION creative_studio.create_artwork(p_brief jsonb, p_scene jsonb,
  p_sources jsonb, p_recipes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := creative_studio.actor(); vid uuid; pid uuid;
BEGIN
  vid := creative_studio.save_version(NULL,NULL,p_brief,p_scene,p_sources,p_recipes);
  SELECT p.id INTO pid FROM creative_studio.projects p
    JOIN creative_studio.versions v ON v.project_id=p.id
    WHERE v.id=vid AND p.owner_id=u AND p.tenant_id='eicagency';
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('project_id',pid,'version_id',vid);
END $$;
REVOKE ALL ON FUNCTION creative_studio.create_artwork(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION creative_studio.create_artwork(jsonb,jsonb,jsonb,jsonb) TO service_role;
-- Dedicated repository role is provisioned separately; grant ONLY this exact signature.
COMMIT;
