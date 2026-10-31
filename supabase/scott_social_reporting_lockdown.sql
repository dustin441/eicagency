-- Lock every Scott Social reporting relation to server-side service-role access.
-- Idempotent. The dashboard reads these relations through SUPABASE_SERVICE_ROLE_KEY.
begin;

do $lockdown$
declare
  relation record;
  qualified_name text;
begin
  for relation in
    select n.nspname, c.relname, c.relkind
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and (
        c.relname = 'budgets'
        or c.relname like 'arabella\_%' escape '\'
        or c.relname like 'kinsey\_%' escape '\'
        or c.relname like 'bloom\_%' escape '\'
        or c.relname like 'champagne\_%' escape '\'
        or c.relname like 'aurit\_%' escape '\'
      )
  loop
    qualified_name := pg_catalog.format('%I.%I', relation.nspname, relation.relname);

    if relation.relkind in ('r', 'p') then
      execute pg_catalog.format('alter table %s enable row level security', qualified_name);
    end if;

    if relation.relkind = 'S' then
      execute pg_catalog.format('revoke all privileges on sequence %s from public, anon, authenticated', qualified_name);
      execute pg_catalog.format('grant usage, select, update on sequence %s to service_role', qualified_name);
    else
      execute pg_catalog.format('revoke all privileges on table %s from public, anon, authenticated', qualified_name);
      execute pg_catalog.format('grant all privileges on table %s to service_role', qualified_name);
    end if;
  end loop;
end
$lockdown$;

commit;
