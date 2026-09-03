begin;

-- Cross-project mutation boundary. Dashboard authentication lives in the PrePass
-- Supabase project, while Client Health data lives in EIC Clients. A dedicated
-- shared HMAC secret attests that an agency-authenticated server action approved
-- the exact canonical request. The EIC service-role JWT alone is insufficient.
do $$
declare v_postgres_oid oid;
begin
  if current_user<>'postgres' or session_user<>'postgres' then
    raise exception 'client health config write API requires a direct postgres session';
  end if;
  select oid into v_postgres_oid from pg_catalog.pg_roles
  where rolname='postgres' and not rolsuper and rolcanlogin and rolbypassrls and rolcreaterole;
  if v_postgres_oid is null or to_regclass('public.master_spartaco') is null then
    raise exception 'client health config write API requires the EIC Clients project and managed postgres role';
  end if;
  if to_regprocedure('private.client_health_stage_config_revision(uuid,text,jsonb)') is null
     or to_regprocedure('private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)') is null
     or to_regprocedure('private.client_health_assert_config_revision_v3(uuid,text,jsonb)') is null
     or to_regprocedure('public.client_health_canonical_json(jsonb)') is null then
    raise exception 'client health config write API requires the complete v3 config installation';
  end if;
  if to_regclass('private.client_health_config_write_secrets') is not null
     or to_regclass('private.client_health_config_write_nonces') is not null
     or to_regprocedure('private.client_health_set_config_write_secret(text)') is not null
     or to_regprocedure('public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text)') is not null then
    raise exception 'client health config write API found a prior or partial installation';
  end if;
  if not exists(select 1 from pg_roles where rolname='service_role')
     or has_schema_privilege('service_role','private','USAGE')
     or has_function_privilege('service_role','private.client_health_stage_config_revision(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','private.client_health_activate_config_revision(uuid,uuid,text,text,text,uuid)','EXECUTE') then
    raise exception 'client health config write API requires the exact private privilege boundary';
  end if;
end
$$;

create table private.client_health_config_write_secrets(
  singleton boolean primary key default true check(singleton),
  secret bytea not null check(octet_length(secret)=32),
  rotated_at timestamptz not null default clock_timestamp()
);

create table private.client_health_config_write_nonces(
  nonce uuid primary key,
  issued_at_unix_ms bigint not null,
  operator_identity text not null check(operator_identity=trim(operator_identity) and length(operator_identity) between 1 and 256),
  revision_id uuid not null references private.client_health_config_revisions(id) on delete restrict,
  activation_id uuid not null references private.client_health_config_revision_activations(id) on delete restrict,
  consumed_at timestamptz not null default clock_timestamp()
);

alter table private.client_health_config_write_secrets enable row level security;
alter table private.client_health_config_write_secrets force row level security;
alter table private.client_health_config_write_nonces enable row level security;
alter table private.client_health_config_write_nonces force row level security;

create function private.client_health_set_config_write_secret(p_secret_hex text)
returns void language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_secret bytea;
begin
  if current_user<>'postgres' or session_user<>'postgres' then
    raise exception 'config write secret provisioning requires direct postgres' using errcode='42501';
  end if;
  if p_secret_hex is null or p_secret_hex!~'^[0-9a-f]{64}$' then
    raise exception 'config write secret must be exactly 32 lowercase hex bytes';
  end if;
  v_secret:=decode(p_secret_hex,'hex');
  insert into private.client_health_config_write_secrets(singleton,secret,rotated_at)
  values(true,v_secret,clock_timestamp())
  on conflict(singleton) do update set secret=excluded.secret,rotated_at=excluded.rotated_at;
end
$$;

create function public.client_health_apply_config_revision(
  p_revision_id uuid,
  p_revision_hash text,
  p_revision jsonb,
  p_activation_id uuid,
  p_reviewed_commit_sha text,
  p_reason text,
  p_expected_current_activation_id uuid,
  p_operator_identity text,
  p_issued_at_unix_ms bigint,
  p_nonce uuid,
  p_signature text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
  v_secret bytea;
  v_payload jsonb;
  v_expected bytea;
  v_now_ms bigint;
  v_receipt jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then
    raise exception 'service-role transport required' using errcode='42501';
  end if;
  if p_operator_identity is null or p_operator_identity<>trim(p_operator_identity) or length(p_operator_identity) not between 1 and 256
     or p_reason is null or p_reason<>trim(p_reason) or length(p_reason) not between 1 and 1024
     or p_signature is null or p_signature!~'^[0-9a-f]{64}$'
     or p_issued_at_unix_ms is null or p_nonce is null then
    raise exception 'signed config request is malformed';
  end if;
  v_now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if p_issued_at_unix_ms < v_now_ms-300000 or p_issued_at_unix_ms > v_now_ms+30000 then
    raise exception 'signed config request is expired or from the future' using errcode='22023';
  end if;
  select secret into v_secret from private.client_health_config_write_secrets where singleton=true;
  if v_secret is null then raise exception 'config write secret is not provisioned' using errcode='55000'; end if;

  v_payload:=jsonb_build_object(
    'action','apply-client-health-config-v1',
    'activationId',p_activation_id,
    'expectedCurrentActivationId',p_expected_current_activation_id,
    'issuedAtUnixMs',p_issued_at_unix_ms,
    'nonce',p_nonce,
    'operatorIdentity',p_operator_identity,
    'reason',p_reason,
    'revision',p_revision,
    'revisionHash',p_revision_hash,
    'revisionId',p_revision_id,
    'reviewedCommitSha',p_reviewed_commit_sha
  );
  v_expected:=extensions.hmac(convert_to(public.client_health_canonical_json(v_payload),'UTF8'),v_secret,'sha256');
  if decode(p_signature,'hex')<>v_expected then
    raise exception 'signed config request authentication failed' using errcode='42501';
  end if;

  perform private.client_health_stage_config_revision(p_revision_id,p_revision_hash,p_revision);
  v_receipt:=private.client_health_activate_config_revision(
    p_activation_id,p_revision_id,p_reviewed_commit_sha,p_operator_identity,p_reason,p_expected_current_activation_id
  );
  insert into private.client_health_config_write_nonces(nonce,issued_at_unix_ms,operator_identity,revision_id,activation_id)
  values(p_nonce,p_issued_at_unix_ms,p_operator_identity,p_revision_id,p_activation_id);
  return v_receipt;
exception when unique_violation then
  raise exception 'signed config request nonce was already consumed' using errcode='23505';
end
$$;

alter table private.client_health_config_write_secrets owner to postgres;
alter table private.client_health_config_write_nonces owner to postgres;
alter function private.client_health_set_config_write_secret(text) owner to postgres;
alter function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) owner to postgres;

revoke all on table private.client_health_config_write_secrets from public,anon,authenticated,service_role;
revoke all on table private.client_health_config_write_nonces from public,anon,authenticated,service_role;
revoke all on function private.client_health_set_config_write_secret(text) from public,anon,authenticated,service_role;
revoke all on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) to service_role;
revoke all on schema private from public,anon,authenticated,service_role;

comment on function public.client_health_apply_config_revision(uuid,text,jsonb,uuid,text,text,uuid,text,bigint,uuid,text) is 'Atomic signed cross-project stage-and-activate boundary. Requires service-role transport plus a fresh one-time HMAC attestation from the agency-authenticated settings server.';
comment on table private.client_health_config_write_nonces is 'Immutable replay ledger for consumed signed Client Health configuration mutations.';
comment on table private.client_health_config_write_secrets is 'Private singleton HMAC key for cross-project configuration attestations; provision and rotate only through direct postgres.';

commit;
