begin;

do $$
declare p oid:='public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)'::regprocedure;
begin
  if current_user<>'postgres' or session_user<>'postgres'
     or (select r.rolname from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid=p)<>'postgres'
     or not (select prosecdef from pg_proc where oid=p)
     or (select proconfig from pg_proc where oid=p)<>array['search_path=pg_catalog, public, private, extensions']
     or encode(extensions.digest(convert_to(pg_get_functiondef(p),'UTF8'),'sha256'),'hex')<>'a438b0210e1625b81b5a9fbf45c453e93db2c900b03c351ac7cf764021517255'
     or has_function_privilege('public',p,'execute') or has_function_privilege('anon',p,'execute')
     or has_function_privilege('authenticated',p,'execute') or not has_function_privilege('service_role',p,'execute') then
    raise exception 'config write transport compatibility preflight failed';
  end if;
end$$;

create or replace function public.client_health_apply_config_revision(
  p_revision_id uuid,p_revision_hash text,p_revision jsonb,p_activation_id uuid,
  p_reviewed_commit_sha text,p_reason text,p_expected_current_activation_id uuid,
  p_operator_identity text,p_issued_at_unix_ms bigint,p_nonce uuid,p_signature text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_secret bytea;v_payload jsonb;v_expected bytea;v_now_ms bigint;v_receipt jsonb;
begin
  if coalesce(
       nullif(current_setting('request.jwt.claim.role',true),''),
       case when nullif(current_setting('request.jwt.claims',true),'') is null then null
            else current_setting('request.jwt.claims',true)::jsonb->>'role' end,
       ''
     )<>'service_role' then
    raise exception 'service-role transport required' using errcode='42501';
  end if;
  if p_operator_identity is null or p_operator_identity<>trim(p_operator_identity) or length(p_operator_identity) not between 1 and 256
     or p_reason is null or p_reason<>trim(p_reason) or length(p_reason) not between 1 and 1024
     or p_signature is null or p_signature!~'^[0-9a-f]{64}$' or p_issued_at_unix_ms is null or p_nonce is null then
    raise exception 'signed config request is malformed';
  end if;
  v_now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if p_issued_at_unix_ms < v_now_ms-300000 or p_issued_at_unix_ms > v_now_ms+30000 then
    raise exception 'signed config request is expired or from the future' using errcode='22023';
  end if;
  select secret into v_secret from private.client_health_config_write_secrets where singleton=true;
  if v_secret is null then raise exception 'config write secret is not provisioned' using errcode='55000';end if;
  v_payload:=jsonb_build_object('action','apply-client-health-config-v1','activationId',p_activation_id,
    'expectedCurrentActivationId',p_expected_current_activation_id,'issuedAtUnixMs',p_issued_at_unix_ms,
    'nonce',p_nonce,'operatorIdentity',p_operator_identity,'reason',p_reason,'revision',p_revision,
    'revisionHash',p_revision_hash,'revisionId',p_revision_id,'reviewedCommitSha',p_reviewed_commit_sha);
  v_expected:=extensions.hmac(convert_to(public.client_health_canonical_json(v_payload),'UTF8'),v_secret,'sha256');
  if decode(p_signature,'hex')<>v_expected then raise exception 'signed config request authentication failed' using errcode='42501';end if;
  perform private.client_health_stage_config_revision(p_revision_id,p_revision_hash,p_revision);
  v_receipt:=private.client_health_activate_config_revision(p_activation_id,p_revision_id,p_reviewed_commit_sha,p_operator_identity,p_reason,p_expected_current_activation_id);
  insert into private.client_health_config_write_nonces(nonce,issued_at_unix_ms,operator_identity,revision_id,activation_id)
  values(p_nonce,p_issued_at_unix_ms,p_operator_identity,p_revision_id,p_activation_id);
  return v_receipt;
exception when unique_violation then raise exception 'signed config request nonce was already consumed' using errcode='23505';
end$$;

alter function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) owner to postgres;
revoke all on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) to service_role;

do $$
declare p oid:='public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)'::regprocedure;d text:=pg_get_functiondef(p);
begin
 if strpos(d,'request.jwt.claims')=0 or strpos(d,'''role''')=0
    or has_function_privilege('public',p,'execute') or has_function_privilege('anon',p,'execute')
    or has_function_privilege('authenticated',p,'execute') or not has_function_privilege('service_role',p,'execute') then
   raise exception 'config write transport compatibility postcondition failed';
 end if;
end$$;

commit;
