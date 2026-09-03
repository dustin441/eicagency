begin;

do $$
begin
  if current_user<>'postgres' or session_user<>'postgres' or to_regclass('public.master_spartaco') is null then
    raise exception 'Client Health portfolio bootstrap requires the EIC managed postgres owner';
  end if;
  if exists(
    select 1 from public.client_health_clients c join (values
      ('0b687ba7-e0be-8b5b-8f4f-23937f0f470e'::uuid,'kinsey'),('0cbf9435-819f-81b3-9504-b790b57caf66','nsi'),('0de0feb5-485e-8dbf-9de8-6c7092c6b834','bridgeway'),('2656aab4-3742-88ca-ae6f-45913457678c','durodyne'),('4492f146-72c1-82eb-9aec-7ca41dd2763c','aurit'),('4af0e5ea-24e4-8a3f-8bdf-8431ddaaa270','prepass'),('667d91d4-67e3-8d72-8846-dc59b809812e','state48'),('83943185-f0ff-8810-bede-14eaf4e4b1e2','bloom'),('9135d6ff-2163-8f34-bbab-50dc742126c1','champagne'),('9523deff-b142-83a4-8f58-5d5350d560cf','medibrane'),('a3365f26-6e9b-8b1f-a5f5-9ca11bd0f1a1','arabella'),('bfa090de-bb5c-8e25-9f78-bdbf9796adb9','spartaco'),('c5051612-4b64-8100-9af3-338954536f51','ihh'),('e898e636-431b-84c5-a0c1-884e19482a46','cba'),('ecad2a5e-e065-89e7-b754-3a62dc95e6bf','goodgame')
    ) expected(id,client_key) on c.id=expected.id or c.client_key=expected.client_key
    where c.id<>expected.id or c.client_key<>expected.client_key
  ) then raise exception 'Client Health portfolio identity conflicts with existing durable client rows'; end if;
end$$;

insert into public.client_health_clients(id,client_key,display_name,dashboard_href,active,config_status,reporting_timezone,monthly_hours_allotment,clickup_list_ids,margin_aliases,metadata)
values
 ('0b687ba7-e0be-8b5b-8f4f-23937f0f470e','kinsey','Kinsey Design','/dashboard/kinsey',true,'configuration_required','America/Phoenix',null,array['901414385622'],array['Scott - Kinsey'],'{"identityVersion":"client-health-client-v1"}'),
 ('0cbf9435-819f-81b3-9504-b790b57caf66','nsi','NSI','/dashboard/nsi',true,'configuration_required','America/Phoenix',null,array['900900564386'],array['NSI Electrical','NSI Direct Electrical','NSI Data Electrical','NSI HVAC'],'{"identityVersion":"client-health-client-v1"}'),
 ('0de0feb5-485e-8dbf-9de8-6c7092c6b834','bridgeway','Bridgeway','/dashboard/bridgeway',true,'approved','America/Phoenix',null,array['901413196484'],array['Bridgeway'],'{"identityVersion":"client-health-client-v1"}'),
 ('2656aab4-3742-88ca-ae6f-45913457678c','durodyne','Duro Dyne','/dashboard/durodyne',true,'configuration_required','America/Phoenix',null,array['901415478138'],'{}','{"identityVersion":"client-health-client-v1"}'),
 ('4492f146-72c1-82eb-9aec-7ca41dd2763c','aurit','Aurit','/dashboard/eicagency/client-health',true,'configuration_required','America/Phoenix',null,array['901424611194'],array['Scott - Aurit'],'{"identityVersion":"client-health-client-v1"}'),
 ('4af0e5ea-24e4-8a3f-8bdf-8431ddaaa270','prepass','PrePass','/dashboard',true,'configuration_required','America/Phoenix',null,array['240062401'],array['Prepass'],'{"identityVersion":"client-health-client-v1"}'),
 ('667d91d4-67e3-8d72-8846-dc59b809812e','state48','State Forty Eight','/dashboard/state-forty-eight',true,'approved','America/Phoenix',null,array['900500452322'],array['State Forty Eight'],'{"identityVersion":"client-health-client-v1"}'),
 ('83943185-f0ff-8810-bede-14eaf4e4b1e2','bloom','Bloom Aesthetics','/dashboard/bloom',true,'approved','America/Phoenix',null,array['901414401917'],array['Scott - Bloom'],'{"identityVersion":"client-health-client-v1"}'),
 ('9135d6ff-2163-8f34-bbab-50dc742126c1','champagne','Champagne Haus','/dashboard/champagne',true,'configuration_required','America/Phoenix',null,array['901417128015'],array['Scott - Champagne Haus'],'{"identityVersion":"client-health-client-v1"}'),
 ('9523deff-b142-83a4-8f58-5d5350d560cf','medibrane','Medibrane','/dashboard/eicagency/client-health',true,'configuration_required','America/Phoenix',null,array['901424642458'],array['Medibrane'],'{"identityVersion":"client-health-client-v1"}'),
 ('a3365f26-6e9b-8b1f-a5f5-9ca11bd0f1a1','arabella','Arabella Hotels','/dashboard/arabella',true,'configuration_required','America/Phoenix',null,array['901414345904'],array['Scott - Arabella'],'{"identityVersion":"client-health-client-v1"}'),
 ('bfa090de-bb5c-8e25-9f78-bdbf9796adb9','spartaco','Spartaco','/dashboard/spartaco/leads',true,'approved','America/Phoenix',null,array['901407399216'],array['Spartaco'],'{"identityVersion":"client-health-client-v1"}'),
 ('c5051612-4b64-8100-9af3-338954536f51','ihh','InfiniteHeart Health','/dashboard/ihh',true,'approved','America/Phoenix',null,array['901418534831'],array['Infinite Health'],'{"identityVersion":"client-health-client-v1"}'),
 ('e898e636-431b-84c5-a0c1-884e19482a46','cba','CBA Glass','/dashboard/cba',true,'approved','America/Phoenix',null,array['901400944748'],array['CBA AutoGlass'],'{"identityVersion":"client-health-client-v1"}'),
 ('ecad2a5e-e065-89e7-b754-3a62dc95e6bf','goodgame','Good Game / Nappy Boy','/dashboard/goodgame/sales',true,'configuration_required','America/Phoenix',null,array['901414768821'],array['Nappy Boy'],'{"identityVersion":"client-health-client-v1"}')
on conflict(id) do update set display_name=excluded.display_name,dashboard_href=excluded.dashboard_href,active=excluded.active,config_status=excluded.config_status,reporting_timezone=excluded.reporting_timezone,clickup_list_ids=excluded.clickup_list_ids,margin_aliases=excluded.margin_aliases,metadata=excluded.metadata,updated_at=pg_catalog.clock_timestamp();

commit;
