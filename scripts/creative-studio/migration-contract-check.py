#!/usr/bin/env python3
"""Offline structural lint only: no SQL execution, writes or network access."""
from pathlib import Path
import re
import sys
SQL = Path(__file__).resolve().parents[2] / 'supabase/creative_studio.sql'
TOKENS = {
 'atomic migration': ['BEGIN;', 'COMMIT;'],
 'deny table DML': ['REVOKE ALL ON ALL TABLES IN SCHEMA creative_studio FROM PUBLIC, anon, authenticated, service_role;'],
 'deny default RPC execution': ['REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creative_studio FROM PUBLIC, anon, authenticated, service_role;'],
 'trusted claims': ["claims->>'role' IS DISTINCT FROM 'service_role'", "claims->>'creative_studio_tenant' IS DISTINCT FROM 'eicagency'", "claims->>'creative_studio_owner'", 'public.profiles p WHERE p.id = u', "p.role IN ('agency','super_admin')", "p.role = 'client' AND 'eicagency' = ANY(p.client_access)"],
 'global worker slot': ["pg_advisory_xact_lock(hashtextextended('studio-worker:global',0))", "IF EXISTS (SELECT 1 FROM creative_studio.jobs WHERE status='running' AND lease_expires_at>clock_timestamp()) THEN RETURN; END IF;"],
 'immutable history': ['studio_versions_immutable BEFORE UPDATE OR DELETE', 'studio_assets_immutable BEFORE UPDATE OR DELETE'],
 'recipe hash': ["encode(sha256(convert_to(r.value->>'html','UTF8')),'hex')"],
 'atomic revision': ['current_id IS DISTINCT FROM p_expected', 'FOR UPDATE;', 'latest_version_id = vid, approved_version_id = NULL, approved_at = NULL'],
 'render identity': ['UNIQUE (version_id, placement_id, recipe_sha256)'],
 'exclusive claim': ['FOR UPDATE OF j SKIP LOCKED', 'lease_token=gen_random_uuid()'],
 'bounded recovery': ['attempts BETWEEN 0 AND 3', 'j.attempts >= 3', "error_code='lease_expired'"],
 'stale finalize denial': ['j.lease_token IS DISTINCT FROM p_token', 'j.lease_expires_at <= clock_timestamp()'],
 'attempt-qualified key': ["p_job::text||'/'||p_token::text"],
 'human review': ['AND a.qa_passed AND review.approved'],
 'private storage': ["VALUES ('creative-studio-private','creative-studio-private',false", 'ON storage.objects AS RESTRICTIVE'],
}
TOKENS.update({
 'direction history': ['studio_directions_immutable BEFORE UPDATE OR DELETE', 'UNIQUE (project_id, revision)', 'REFERENCES creative_studio.directions(project_id, id)'],
 'full direction payload': ['VALUES(pid,current_id,rev,u,p_direction,p_style_snapshot)', 'VALUES(u,p_planning_brief)', "jsonb_typeof(p_direction) IS DISTINCT FROM 'object'"],
 'direction CAS': ["current_id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Direction conflict'", 'latest_direction_id=did, updated_at=clock_timestamp()'],
 'planning create only': ['ELSIF p_planning_brief IS NOT NULL THEN', "jsonb_typeof(p_planning_brief) IS DISTINCT FROM 'object'"],
 'bounded cursor': ['p_limit NOT BETWEEN 1 AND 100', '(p_after_created_at IS NULL) <> (p_after_id IS NULL)', '(p.created_at,p.id) > (p_after_created_at,p_after_id)', 'ORDER BY p.created_at,p.id LIMIT p_limit'],
 'empty artwork denial': ["IF v IS NULL THEN RAISE EXCEPTION 'Artwork version required'"],
})
FUNCTIONS = {'actor','immutable','save_direction','list_projects','read_project','save_version','enqueue','claim','finish','review_asset','approve'}
for table in ('projects','directions','versions','jobs','assets','reviews'):
 TOKENS[f'RLS {table}'] = [f'ALTER TABLE creative_studio.{table} ENABLE ROW LEVEL SECURITY;']
def checks(source):
 sql = re.sub(r'--[^\n]*', '', source)
 result = {k: all(t in sql for t in ts) for k,ts in TOKENS.items()}
 headers = re.findall(r'CREATE FUNCTION.*?AS \$\$', sql, re.S)
 names = re.findall(r'CREATE FUNCTION creative_studio\.(\w+)\(', sql)
 result['pinned search paths'] = len(headers)==len(FUNCTIONS) and set(names)==FUNCTIONS and all('SET search_path = pg_catalog' in h for h in headers)
 bodies = dict(re.findall(r'CREATE FUNCTION creative_studio\.(\w+)\(.*?AS \$\$(.*?)END \$\$;', sql, re.S))
 result['all backend RPCs authenticate'] = all('u uuid := creative_studio.actor()' in bodies.get(n,'') for n in FUNCTIONS-{'actor','immutable'})
 direction = bodies.get('save_direction','')
 result['direction lock before CAS before insert'] = all(t in direction for t in ['FOR UPDATE;', 'IF current_id IS DISTINCT FROM p_expected', 'INSERT INTO creative_studio.directions']) and direction.index('FOR UPDATE;') < direction.index('IF current_id IS DISTINCT FROM p_expected') < direction.index('INSERT INTO creative_studio.directions')
 result['direction lock scoped'] = "WHERE id = pid AND owner_id = u AND tenant_id = 'eicagency' FOR UPDATE;" in direction
 result['read owner scoped'] = "p.id=p_project AND p.owner_id=u AND p.tenant_id='eicagency'" in bodies.get('read_project','')
 result['list owner scoped'] = "WHERE p.owner_id=u AND p.tenant_id='eicagency'" in bodies.get('list_projects','')
 result['read child scoping'] = bodies.get('read_project','').count('WHERE v.project_id=p.id') == 4 and 'WHERE d.project_id=p.id' in bodies.get('read_project','')
 result['reads side effect free'] = all(not re.search(r'\b(INSERT|UPDATE|DELETE|claim|enqueue|finish)\b', bodies.get(n,'')) and 'STABLE SECURITY DEFINER' in next((h for h in headers if f'.{n}(' in h),'') for n in ('read_project','list_projects'))
 result['no owner transfer'] = not re.search(r'\bSET\s+(owner_id|created_by|tenant_id|planning_brief)\s*=',sql)
 result['collision fail closed'] = 'CREATE SCHEMA creative_studio;' in sql and not re.search(r'CREATE\s+(?:SCHEMA|TABLE|UNIQUE\s+INDEX|INDEX|SEQUENCE|EXTENSION)\s+IF NOT EXISTS|CREATE OR REPLACE|\bDROP\s',sql) and re.sub(r'--[^\n]*', '', sql).strip().startswith('BEGIN;') and sql.strip().endswith('COMMIT;')
 grants = re.findall(r'GRANT EXECUTE ON FUNCTION (.*?)TO service_role;',sql,re.S)
 result['exact RPC grant surface'] = len(grants)==1 and set(re.findall(r'creative_studio\.(\w+)\(',grants[0])) == FUNCTIONS-{'actor','immutable'} and not re.search(r'GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b',sql)
 result['no public grants'] = not re.search(r'GRANT\s+[^;]*\bTO\s+(PUBLIC|anon|authenticated)\b', sql)
 result['no seeded identity'] = 'INSERT INTO creative_studio.allowed_owners' not in sql
 return result
if __name__ == '__main__':
 source = SQL.read_text()
 results = checks(source)
 for name, passed in results.items(): print(f'{"PASS" if passed else "FAIL"} {name}')
 for name in TOKENS:
  token = TOKENS[name][0]
  if token not in source or checks(source.replace(token,'/* negative control */'))[name]:
   sys.exit('FAIL negative control: '+name)
 structural_controls = {
  'read owner scoped': ("p.id=p_project AND p.owner_id=u AND p.tenant_id='eicagency'", 'p.id=p_project'),
  'list owner scoped': ("WHERE p.owner_id=u AND p.tenant_id='eicagency'", 'WHERE true'),
  'direction lock scoped': ("WHERE id = pid AND owner_id = u AND tenant_id = 'eicagency' FOR UPDATE;", 'WHERE id = pid FOR UPDATE;'),
  'collision fail closed': ('CREATE SCHEMA creative_studio;', 'CREATE SCHEMA IF NOT EXISTS creative_studio;'),
  'exact RPC grant surface': ('TO service_role;', 'TO service_role; GRANT SELECT ON creative_studio.projects TO service_role;'),
 }
 for name,(old,new) in structural_controls.items():
  if old not in source or checks(source.replace(old,new))[name]: sys.exit('FAIL negative control: '+name)
 print(f'PASS {len(TOKENS)+len(structural_controls)} negative controls')
 print(f'{sum(results.values())}/{len(results)} static contracts passed. SQL UNEXECUTED; database/runtime checks NOT performed.')
 sys.exit(0 if all(results.values()) else 1)
