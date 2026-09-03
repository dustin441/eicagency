begin;

do $$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
     or to_regclass('public.master_spartaco') is null then
    raise exception 'Spartaco Client Health lane views require the EIC managed postgres owner';
  end if;
  if to_regclass('public.client_health_spartaco_leads_daily') is not null
     or to_regclass('public.client_health_spartaco_sales_daily') is not null then
    raise exception 'Spartaco Client Health lane views already exist';
  end if;
end$$;

create view public.client_health_spartaco_leads_daily
with (security_invoker=false, security_barrier=true) as
select date::text as row_key, date,
       sum(cost)::double precision as spend,
       sum(conversions)::double precision as results
from public.master_spartaco
where type='LEAD'
group by date
having date is not null and count(*)>0
   and bool_and(cost is not null and conversions is not null
     and cost::text not in ('NaN','Infinity','-Infinity')
     and conversions::text not in ('NaN','Infinity','-Infinity')
     and cost>=0 and conversions>=0);

create view public.client_health_spartaco_sales_daily
with (security_invoker=false, security_barrier=true) as
select date::text as row_key, date,
       sum(cost)::double precision as spend,
       sum(revenue)::double precision as results
from public.master_spartaco
where type='SALES'
group by date
having date is not null and count(*)>0
   and bool_and(cost is not null and revenue is not null
     and cost::text not in ('NaN','Infinity','-Infinity')
     and revenue::text not in ('NaN','Infinity','-Infinity')
     and cost>=0 and revenue>=0);

alter view public.client_health_spartaco_leads_daily owner to postgres;
alter view public.client_health_spartaco_sales_daily owner to postgres;
revoke all on public.client_health_spartaco_leads_daily, public.client_health_spartaco_sales_daily from public,anon,authenticated;
grant select on public.client_health_spartaco_leads_daily, public.client_health_spartaco_sales_daily to service_role;
comment on view public.client_health_spartaco_leads_daily is 'Client Health-only daily Spartaco LEAD spend and conversions; service-role only.';
comment on view public.client_health_spartaco_sales_daily is 'Client Health-only daily Spartaco SALES spend and revenue; service-role only.';
comment on column public.client_health_spartaco_leads_daily.results is 'Verified lead-generation conversions only.';
comment on column public.client_health_spartaco_sales_daily.results is 'Verified eCommerce revenue only; divide by spend for ROAS.';

commit;
