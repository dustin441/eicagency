do $verify$
declare
  exposed_count integer;
  rls_gap_count integer;
begin
  select pg_catalog.count(*)
  into exposed_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (
      c.relname = 'budgets'
      or c.relname like 'arabella\_%' escape '\'
      or c.relname like 'kinsey\_%' escape '\'
      or c.relname like 'bloom\_%' escape '\'
      or c.relname like 'champagne\_%' escape '\'
      or c.relname like 'aurit\_%' escape '\'
    )
    and (
      pg_catalog.has_table_privilege('anon', c.oid, 'select')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'select')
      or pg_catalog.has_table_privilege('anon', c.oid, 'insert')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'insert')
      or pg_catalog.has_table_privilege('anon', c.oid, 'update')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'update')
      or pg_catalog.has_table_privilege('anon', c.oid, 'delete')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'delete')
    );

  if exposed_count <> 0 then
    raise exception 'VERIFY FAILED: % Scott reporting relations retain anon/authenticated privileges', exposed_count;
  end if;

  select pg_catalog.count(*)
  into rls_gap_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      c.relname = 'budgets'
      or c.relname like 'arabella\_%' escape '\'
      or c.relname like 'kinsey\_%' escape '\'
      or c.relname like 'bloom\_%' escape '\'
      or c.relname like 'champagne\_%' escape '\'
      or c.relname like 'aurit\_%' escape '\'
    )
    and not c.relrowsecurity;

  if rls_gap_count <> 0 then
    raise exception 'VERIFY FAILED: % Scott reporting tables do not have RLS enabled', rls_gap_count;
  end if;
end
$verify$;
