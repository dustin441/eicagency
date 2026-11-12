-- Run only in an isolated fixture database after ingestion and reporting SQL.
begin;
do $$ declare r jsonb; v uuid := gen_random_uuid(); begin
  r := public.prepass_marketo_database_report();
  if r->>'available' <> 'false' then raise exception 'must fail closed without full snapshot'; end if;
  insert into public.prepass_marketo_mirror_runs(run_id,status,smart_list_id,completed_at,metadata)
  values(v,'completed',1,now(),'{"reporting_scope":"all_accessible_people","full_field_dictionary":true,"requested_fields":["dateMQL","dateSQL","dateClosedWon"]}');
  insert into public.prepass_marketo_active_snapshot values(true,v,now());
  update public.prepass_marketo_mirror_runs set metadata='{"snapshot_mode":"full_replace"}' where run_id=v;
  r := public.prepass_marketo_database_report();
  if r->>'available' <> 'false' then raise exception 'replacement mode is not full population proof'; end if;
  update public.prepass_marketo_mirror_runs set metadata='{"reporting_scope":"all_accessible_people","full_field_dictionary":true,"requested_fields":["dateMQL","dateSQL","dateClosedWon"]}' where run_id=v;
  insert into public.prepass_marketo_mirror_contacts(run_id,marketo_id,source_updated_at,source_created_at,date_mql,date_sql,date_won,original_source_type,lead_source,original_utm_source,fleet_size_segment,payload,payload_sha256)
  values(v,1,now(),'2026-01-01','2026-01-03','2026-01-05','2026-01-09','Web','Partner','google','SMB','{}',repeat('a',64)),
  (v,2,now(),'2026-02-01','2026-01-01',null,null,null,null,'meta','ABM','{}',repeat('b',64)),
  (v,3,now(),null,null,null,'2026-03-01',null,null,null,null,'{}',repeat('c',64));
  r := public.prepass_marketo_database_report();
  if (r#>>'{lifetime,people}')::int <> 3 then raise exception 'unique population %',r; end if;
  if (r#>>'{cohort,won}')::int <> 2 then raise exception 'ever won independent of mql/sql %',r; end if;
  if (r#>>'{cohort,unknown_source}')::int <> 2 then raise exception 'unknown must remain %',r; end if;
  if (select sum((s->>'people')::int) from jsonb_array_elements(r->'sources') s) <> 3 then raise exception 'source conservation %',r; end if;
  if (r#>>'{velocity,0,n}')::int <> 1 then raise exception 'exclude reversed intervals %',r; end if;
  if (r#>>'{velocity,0,median_days}')::numeric <> 2 then raise exception 'median lead mql %',r; end if;
  if (r#>>'{cohort,mql_sql}')::int <> 1 then raise exception 'intersection numerator %',r; end if;
  if (r#>>'{cohort,invalid_transitions}')::int <> 1 then raise exception 'invalid transition evidence %',r; end if;
  r := public.prepass_marketo_database_report(null,null,'Unknown','ABM');
  if (r#>>'{cohort,people}')::int <> 1 then raise exception 'raw source segment filters %',r; end if;
  r := public.prepass_marketo_database_report('2026-01-01','2026-01-31');
  if (r#>>'{cohort,people}')::int <> 1 or (r#>>'{lifetime,people}')::int <> 3 then raise exception 'cohort lifetime scope %',r; end if;
  r := public.prepass_marketo_database_report(null,null,'google',null,'originalutmsource');
  if (r#>>'{cohort,people}')::int <> 1 or (r#>>'{sources,0,won}')::int <> 1 or (r#>>'{sources,0,won_pairs}')::int <> 1 then raise exception 'source-field filtering and quality %',r; end if;
  r := public.prepass_marketo_database_report(null,null,'Web',null,'originalSourceType');
  if (r#>>'{cohort,people}')::int <> 1 then raise exception 'original type stays independent %',r; end if;
  r := public.prepass_marketo_database_report(null,null,'google',null,'utmsource');
  if (r#>>'{cohort,people}')::int <> 0 then raise exception 'never mix original into latest %',r; end if;
  if has_function_privilege('anon','public.prepass_marketo_database_report(date,date,text,text,text)','execute') then raise exception 'anon privilege leak'; end if;
  if has_function_privilege('authenticated','public.prepass_marketo_database_report(date,date,text,text,text)','execute') then raise exception 'authenticated privilege leak'; end if;
end $$;
rollback;
