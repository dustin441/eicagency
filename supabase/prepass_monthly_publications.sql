begin;

-- PROPOSAL ONLY. Additive schema for immutable PrePass monthly report publications.
-- Apply only through a reviewed, direct postgres session in the EIC project.
do $$
declare
  v_postgres_oid oid;
begin
  if current_user <> 'postgres' or session_user <> 'postgres' then
    raise exception 'PrePass monthly publications require a direct postgres session (current_user and session_user must both be postgres)';
  end if;

  select r.oid into v_postgres_oid
  from pg_catalog.pg_roles r
  where r.rolname = 'postgres'
    and r.rolbypassrls
    and r.rolcreaterole;
  if v_postgres_oid is null then
    raise exception 'PrePass monthly publications require managed Supabase postgres with BYPASSRLS and CREATEROLE';
  end if;

  if not pg_catalog.has_schema_privilege('postgres', 'public', 'USAGE')
     or not pg_catalog.has_schema_privilege('postgres', 'public', 'CREATE') then
    raise exception 'PrePass monthly publications require postgres USAGE and CREATE on public';
  end if;

  if pg_catalog.to_regclass('public.master_marketing_performance') is null then
    raise exception 'PrePass monthly publications require public.master_marketing_performance in the EIC project';
  end if;

  if pg_catalog.to_regclass('public.prepass_monthly_publications') is not null
     or pg_catalog.to_regclass('public.prepass_monthly_publication_active') is not null
     or pg_catalog.to_regclass('public.prepass_monthly_publications_active') is not null
     or pg_catalog.to_regprocedure('public.prepass_guard_monthly_publication_immutable()') is not null
     or pg_catalog.to_regprocedure('public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text)') is not null then
    raise exception 'PrePass monthly publication preflight found a partial or prior installation';
  end if;
end
$$;

create table public.prepass_monthly_publications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  report_month date not null,
  revision integer not null check (revision > 0),
  source_period_start date not null,
  source_period_end date not null,
  source_cutoff_at timestamptz not null,
  source_row_count bigint not null check (source_row_count >= 0),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (
    pg_catalog.jsonb_typeof(payload) = 'object'
    and pg_catalog.octet_length(payload::text) <= 5000000
  ),
  correction_reason text,
  published_at timestamptz not null,
  published_by text not null check (
    published_by <> ''
    and published_by = pg_catalog.btrim(published_by)
    and pg_catalog.length(published_by) <= 256
  ),
  constraint prepass_monthly_publications_month_start check (
    report_month = pg_catalog.date_trunc('month', report_month)::date
  ),
  constraint prepass_monthly_publications_exact_period check (
    source_period_start = report_month
    and source_period_end = (report_month + interval '1 month - 1 day')::date
  ),
  constraint prepass_monthly_publications_cutoff_after_period check (
    source_cutoff_at >= ((source_period_end + 1)::timestamp at time zone 'UTC')
  ),
  constraint prepass_monthly_publications_correction_provenance check (
    (revision = 1 and correction_reason is null)
    or (
      revision > 1
      and correction_reason is not null
      and correction_reason <> ''
      and correction_reason = pg_catalog.btrim(correction_reason)
      and pg_catalog.length(correction_reason) <= 2000
    )
  ),
  constraint prepass_monthly_publications_month_revision_unique
    unique (report_month, revision),
  constraint prepass_monthly_publications_idempotency_unique
    unique (report_month, source_hash, payload_hash),
  constraint prepass_monthly_publications_month_id_unique
    unique (report_month, id)
);

create table public.prepass_monthly_publication_active (
  report_month date primary key check (
    report_month = pg_catalog.date_trunc('month', report_month)::date
  ),
  publication_id uuid not null unique,
  activated_at timestamptz not null,
  activated_by text not null check (
    activated_by <> ''
    and activated_by = pg_catalog.btrim(activated_by)
    and pg_catalog.length(activated_by) <= 256
  ),
  constraint prepass_monthly_publication_active_publication_fk
    foreign key (report_month, publication_id)
    references public.prepass_monthly_publications(report_month, id)
);

alter table public.prepass_monthly_publications enable row level security;
alter table public.prepass_monthly_publication_active enable row level security;

create function public.prepass_guard_monthly_publication_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'PrePass monthly publications are immutable';
end
$$;

create trigger prepass_monthly_publications_immutable
before update or delete on public.prepass_monthly_publications
for each row execute function public.prepass_guard_monthly_publication_immutable();

create function public.prepass_publish_monthly_publication(
  p_report_month date,
  p_source_period_start date,
  p_source_period_end date,
  p_source_cutoff_at timestamptz,
  p_source_row_count bigint,
  p_source_hash text,
  p_payload_hash text,
  p_payload jsonb,
  p_correction_reason text default null
)
returns table (
  publication_id uuid,
  publication_revision integer,
  publication_source_hash text,
  publication_payload_hash text,
  publication_published_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_publication_id uuid;
  v_revision integer;
  v_published_at timestamptz;
  v_idempotent boolean := false;
  v_actor text;
begin
  if p_report_month is null
     or p_report_month <> pg_catalog.date_trunc('month', p_report_month)::date then
    raise exception 'report month must be the first calendar day of a month';
  end if;
  if p_report_month >= pg_catalog.date_trunc('month', pg_catalog.clock_timestamp() at time zone 'UTC')::date then
    raise exception 'report month must be a completed UTC calendar month';
  end if;
  if p_source_period_start is distinct from p_report_month
     or p_source_period_end is distinct from (p_report_month + interval '1 month - 1 day')::date then
    raise exception 'source period must exactly cover report month';
  end if;
  if p_source_cutoff_at is null
     or p_source_cutoff_at < ((p_source_period_end + 1)::timestamp at time zone 'UTC') then
    raise exception 'source cutoff must be at or after the end of report month';
  end if;
  if p_source_row_count is null or p_source_row_count < 0 then
    raise exception 'source row count must be nonnegative';
  end if;
  if p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
     or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'source and payload hashes must be lowercase SHA-256 hex';
  end if;
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or pg_catalog.octet_length(p_payload::text) > 5000000 then
    raise exception 'publication payload must be a JSON object no larger than 5 MB';
  end if;
  if p_correction_reason is not null and (
    p_correction_reason = ''
    or p_correction_reason <> pg_catalog.btrim(p_correction_reason)
    or pg_catalog.length(p_correction_reason) > 2000
  ) then
    raise exception 'correction reason is malformed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_report_month::text, 20260903)
  );

  select p.id, p.revision, p.published_at
  into v_publication_id, v_revision, v_published_at
  from public.prepass_monthly_publications p
  where p.report_month = p_report_month
    and p.source_hash = p_source_hash
    and p.payload_hash = p_payload_hash;

  v_actor := coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    session_user
  );

  if found then
    v_idempotent := true;
  else
    select coalesce(pg_catalog.max(p.revision), 0) + 1
    into v_revision
    from public.prepass_monthly_publications p
    where p.report_month = p_report_month;

    if v_revision = 1 and p_correction_reason is not null then
      raise exception 'correction reason is only valid after revision 1';
    end if;
    if v_revision > 1 and p_correction_reason is null then
      raise exception 'correction reason is required after revision 1';
    end if;

    v_published_at := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());
    insert into public.prepass_monthly_publications (
      report_month,
      revision,
      source_period_start,
      source_period_end,
      source_cutoff_at,
      source_row_count,
      source_hash,
      payload_hash,
      payload,
      correction_reason,
      published_at,
      published_by
    ) values (
      p_report_month,
      v_revision,
      p_source_period_start,
      p_source_period_end,
      p_source_cutoff_at,
      p_source_row_count,
      p_source_hash,
      p_payload_hash,
      p_payload,
      p_correction_reason,
      v_published_at,
      v_actor
    )
    returning id into v_publication_id;
  end if;

  insert into public.prepass_monthly_publication_active (
    report_month,
    publication_id,
    activated_at,
    activated_by
  ) values (
    p_report_month,
    v_publication_id,
    pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp()),
    v_actor
  )
  on conflict (report_month) do update
    set publication_id = excluded.publication_id,
        activated_at = excluded.activated_at,
        activated_by = excluded.activated_by
    where prepass_monthly_publication_active.publication_id is distinct from excluded.publication_id
      and exists (
        select 1
        from public.prepass_monthly_publications current_publication
        where current_publication.report_month = prepass_monthly_publication_active.report_month
          and current_publication.id = prepass_monthly_publication_active.publication_id
          and current_publication.revision < v_revision
      );

  return query
  select
    v_publication_id,
    v_revision,
    p_source_hash,
    p_payload_hash,
    v_published_at,
    v_idempotent;
end
$$;

create view public.prepass_monthly_publications_active
with (security_invoker = true)
as
select
  p.id,
  p.report_month,
  p.revision,
  p.source_period_start,
  p.source_period_end,
  p.source_cutoff_at,
  p.source_row_count,
  p.source_hash,
  p.payload_hash,
  p.payload,
  p.correction_reason,
  p.published_at,
  p.published_by,
  active.activated_at,
  active.activated_by
from public.prepass_monthly_publication_active active
join public.prepass_monthly_publications p
  on p.report_month = active.report_month
 and p.id = active.publication_id;

alter table public.prepass_monthly_publications owner to postgres;
alter table public.prepass_monthly_publication_active owner to postgres;
alter view public.prepass_monthly_publications_active owner to postgres;
alter function public.prepass_guard_monthly_publication_immutable() owner to postgres;
alter function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text) owner to postgres;

revoke all on table public.prepass_monthly_publications from public, anon, authenticated, service_role;
revoke all on table public.prepass_monthly_publication_active from public, anon, authenticated, service_role;
revoke all on table public.prepass_monthly_publications_active from public, anon, authenticated, service_role;
revoke all on function public.prepass_guard_monthly_publication_immutable() from public, anon, authenticated, service_role;
revoke all on function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text) from public, anon, authenticated, service_role;

grant select on table public.prepass_monthly_publications to service_role;
grant select on table public.prepass_monthly_publication_active to service_role;
grant select on table public.prepass_monthly_publications_active to service_role;
grant execute on function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text) to service_role;

comment on table public.prepass_monthly_publications is
  'Immutable, versioned monthly report payloads sourced from master_marketing_performance.';
comment on table public.prepass_monthly_publication_active is
  'Mutable one-row-per-month pointer to the active immutable PrePass publication revision.';
comment on function public.prepass_publish_monthly_publication(date,date,date,timestamptz,bigint,text,text,jsonb,text) is
  'Atomically and idempotently appends a monthly publication revision and advances the active pointer only to a newer revision.';

commit;
