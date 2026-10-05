-- Executable fixture for prepass_utm_attribution_2026_ytd.sql.
-- Run only against a disposable/test database after applying the migration.
begin;

do $$
declare
  v_platform text;
  v_campaign text;
  v_kind text;
  v_count integer;
  v_raw record;
  v_corrected record;
begin
  select target_platform, canonical_campaign, evidence_kind
    into v_platform, v_campaign, v_kind
  from public.prepass_resolve_paid_attribution('abm_brand_defense', 'google', 'cpc');
  if row(v_platform,v_campaign,v_kind) is distinct from
     row('Google'::text,'Search | ABM | Brand Defense'::text,'paid-utm'::text) then
    raise exception 'valid Google paid UTM fixture failed';
  end if;

  select target_platform, canonical_campaign, evidence_kind
    into v_platform, v_campaign, v_kind
  from public.prepass_resolve_paid_attribution(
    'Lead | VIDEOS | FD360 | Interests - NEW LP', null, null, null, 'fbclid-fixture'
  );
  if row(v_platform,v_campaign,v_kind) is distinct from
     row('Meta'::text,'Lead | VIDEOS | FD360 | Interests - NEW LP'::text,'fbclid'::text) then
    raise exception 'valid Meta ad identifier fixture failed';
  end if;

  select target_platform, canonical_campaign, evidence_kind
    into v_platform, v_campaign, v_kind
  from public.prepass_resolve_paid_attribution(
    'regInvite?utm_source=b2c,regInvite', 'b2c', 'email'
  );
  if row(v_platform,v_campaign,v_kind) is distinct from
     row('Email'::text,'Registration invite'::text,'email-utm'::text) then
    raise exception 'valid Email UTM fixture failed';
  end if;

  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('abm_brand_defense');
  if v_count <> 0 then raise exception 'missing evidence must fail closed'; end if;

  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('abm_brand_defense', 'facebook', 'cpc');
  if v_count <> 0 then raise exception 'platform-mismatched evidence must fail closed'; end if;

  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('unknown campaign', 'google', 'cpc', 'gclid-fixture');
  if v_count <> 0 then raise exception 'unknown campaign must fail closed'; end if;

  select count(*) into v_count
  from public.prepass_resolve_paid_attribution('tempRegistrationCode', 'google', 'cpc', 'gclid-fixture')
  where target_platform = 'Unattributed' and evidence_kind = 'technical-unattributed';
  if v_count <> 1 then raise exception 'technical code must remain unattributed'; end if;

  select count(*)::bigint rows, sum(mqls)::numeric mqls, sum(sqls)::numeric sqls,
         sum(closed_won)::numeric won
    into v_raw
    from prepass_utm_attribution_20261003.raw_mmp_source
   where date::date >= date '2026-01-01';
  select count(*)::bigint rows, sum(mqls)::numeric mqls, sum(sqls)::numeric sqls,
         sum(closed_won)::numeric won
    into v_corrected
    from prepass_utm_attribution_20261003.corrected_source
   where date::date >= date '2026-01-01';
  if v_corrected is distinct from v_raw then
    raise exception 'lifecycle totals changed without proven duplicate identities';
  end if;
end $$;

rollback;
