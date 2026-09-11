#!/usr/bin/env python3
"""Forward-only, GET-only source collector. Local secure artifacts only."""
import argparse, collections, datetime as dt, fcntl, hashlib, json, os, re, sys, time, uuid
from pathlib import Path
import requests
os.umask(0o077)
ROOT=Path(__file__).resolve().parent
LOC='m1hqL3irI6uiyW5tCGhR'
PROSPECTIVE='2026-09-11T20:53:10Z'
FIELDS={'snapshot_at':'mkVW3XhVQhfNh42gdQaH','channel':'C266Xez6E0GTTslItRwp','source':'fEIl5XjPbR9zRkLJZcLe','schema_version':'OL1jQeb2xJpGkjImxN6Z'}
COLUMNS='contact_key,lead_at,quiz_taker,appointment_scheduled,appointment_at,lead_source,appointment_source,synced_at'
def stamp(s):
 d=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
 if d.tzinfo is None: raise ValueError('timezone_required')
 return d.astimezone(dt.timezone.utc)
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def save(p,obj):
 temp=p.with_name(p.name+'.tmp-'+uuid.uuid4().hex)
 with temp.open('x') as f:
  json.dump(obj,f,sort_keys=True);f.flush();os.fsync(f.fileno())
 os.replace(temp,p)
def env():
 e={}
 for p in ['/opt/data/.env','/tmp/eicagency-prod.env']:
  if Path(p).exists():
   for line in Path(p).read_text().splitlines():
    if '=' in line and not line.startswith('#'):
     k,v=line.split('=',1);e[k]=v.strip().strip('"').strip("'").replace('\\n','\n').strip()
 return {**e,**os.environ}
def identity(s):
 if not re.fullmatch('[A-Za-z0-9_-]+',s):raise ValueError('invalid_identity')
 return s
def classify(opps,events,asof):
 if not opps:return 'missing_opportunity',None
 if len(opps)>1:
  links={e['opportunity_id'] for e in events if e.get('opportunity_id')}
  selected=[o for o in opps if o['id'] in links]
  if len(links)!=1 or len(selected)!=1:return 'ambiguous_multi_opportunity',None
  o=selected[0]
 else:o=opps[0]
 fm={f['id']:f.get('fieldValue',f.get('value',f.get('field_value'))) for f in o.get('customFields',[])}
 s={k:fm.get(v) for k,v in FIELDS.items()};s['opportunity_id']=o['id']
 try:t=stamp(s['snapshot_at'])
 except (ValueError,TypeError,AttributeError):return 'missing_immutable_snapshot',s
 if not s['schema_version']:return 'missing_immutable_snapshot',s
 if t>stamp(asof):return 'snapshot_after_asof',s
 if s['channel']=='unknown' or s['source']=='unknown':return 'unknown_snapshot',s
 if s['channel']!='paid_social':return 'excluded_channel',s
 if s['source'] not in {'facebook','instagram'}:return 'excluded_non_meta_source',s
 return 'verified_meta_paid',s
class Client:
 def __init__(self,e,max_requests=500,seconds=150):
  self.e=e;self.calls=0;self.max_requests=max_requests;self.deadline=time.monotonic()+seconds
 def get(self,path,params=None,sb=False):
  base=self.e['SPARTACO_SUPABASE_URL'].rstrip('/')+'/rest/v1' if sb else 'https://services.leadconnectorhq.com'
  key=self.e['SPARTACO_SUPABASE_SERVICE_ROLE_KEY'] if sb else self.e['HIGHLEVEL_INFINITEHEART_PRIVATE_INTEGRATION_TOKEN']
  headers={'Authorization':'Bearer '+key}
  headers.update({'apikey':key} if sb else {'Version':'2021-07-28'})
  for attempt in range(4):
   if self.calls>=self.max_requests or time.monotonic()>=self.deadline:raise RuntimeError('request_budget_exceeded')
   self.calls+=1
   try:r=requests.get(base+path,params=params,headers=headers,timeout=min(20,max(1,self.deadline-time.monotonic())),allow_redirects=False)
   except requests.RequestException:
    if attempt==3:raise RuntimeError('source_transport_failed') from None
    time.sleep(2**attempt);continue
   if r.status_code==429 or r.status_code>=500:
    time.sleep(2**attempt);continue
   if r.status_code!=200:raise RuntimeError('source_http_'+str(r.status_code))
   return r.json()
  raise RuntimeError('source_retries_exhausted')
def pages(client,table,params,key,max_pages=100):
 # Keyset pagination remains correct even with server-enforced page caps.
 out=[];last=None
 for _ in range(max_pages):
  p={**params,'limit':200,'order':key+'.asc'}
  if last is not None:p[key]='gt.'+str(last)
  rows=client.get('/'+table,p,True)
  if not isinstance(rows,list):raise RuntimeError('invalid_page')
  if not rows:return out
  for r in rows:
   value=r[key]
   if last is not None and value<=last:raise RuntimeError('nonmonotonic_page')
   last=value;out.append(r)
 raise RuntimeError('page_budget_exceeded')
def collect(client,start,asof,cache):
 contacts=pages(client,'ihh_funnel_contacts',{'select':COLUMNS,'quiz_taker':'eq.true','and':f'(lead_at.gte.{start},lead_at.lt.{asof})'},'contact_key')
 records=[];audit=[];states=collections.Counter();hits=0
 for c in contacts:
  if not c['contact_key'].startswith('ghl:') or not c['quiz_taker'] or not stamp(start)<=stamp(c['lead_at'])<stamp(asof):raise RuntimeError('invalid_cohort')
  cid=identity(c['contact_key'][4:])
  events=pages(client,'ihh_lifecycle_events',{'select':'*','contact_id':'eq.'+cid,'is_qa':'eq.false','event_at':'lt.'+asof},'id')
  if any(e.get('contact_id')!=cid or e.get('is_qa') is not False for e in events):raise RuntimeError('ledger_scope_mismatch')
  opps=[];seen=set()
  for page in range(1,101):
   data=client.get('/opportunities/search',{'location_id':LOC,'contact_id':cid,'limit':100,'page':page})
   batch=data.get('opportunities')
   if not isinstance(batch,list):raise RuntimeError('invalid_opportunity_page')
   if not batch:break
   for brief in batch:
    oid=identity(brief['id'])
    if oid in seen:raise RuntimeError('repeated_opportunity_page')
    seen.add(oid);p=cache/(oid+'.json')
    if p.exists():o=json.loads(p.read_text());hits+=1
    else:
     d=client.get('/opportunities/'+oid);o=d.get('opportunity',d)
     if o.get('id')!=oid or (o.get('contactId') or o.get('contact',{}).get('id'))!=cid or o.get('locationId')!=LOC:raise RuntimeError('opportunity_identity_mismatch')
     # Cache immutable fields only, never opportunity membership or missing snapshots.
     o={'id':oid,'contactId':cid,'locationId':LOC,'customFields':[f for f in o.get('customFields',[]) if f.get('id') in FIELDS.values()]}
     state,_=classify([o],[],asof)
     if state not in {'missing_immutable_snapshot','snapshot_after_asof'}:save(p,o)
    if o.get('contactId')!=cid or o.get('locationId')!=LOC:raise RuntimeError('cache_identity_mismatch')
    opps.append(o)
  else:raise RuntimeError('opportunity_page_budget_exceeded')
  state,s=classify(opps,events,asof);states[state]+=1
  audit.append({'contact_key':c['contact_key'],'lead_at':c['lead_at'],'state':state})
  if state=='verified_meta_paid':
   records.append({**c,'location_id':LOC,'contact_id':cid,'opportunity_id':s['opportunity_id'],'attribution_channel':s['channel'],'attribution_source':s['source'],'snapshot_at':s['snapshot_at'],'snapshot_schema_version':s['schema_version'],'source_table':'ihh_funnel_contacts','population_label':'Verified Meta-paid — original CAPI-acknowledged quiz-lead subset','lifecycle_tracking_start':'2026-08-28','lifecycle_events':events,'opportunity_resolution':'unique_opportunity' if len(opps)==1 else 'consistent_explicit_ledger_opportunity'})
 return records,audit,{'sourceContacts':len(contacts),'eligibleRecords':len(records),'resolutionCounts':dict(states),'immutableCacheHits':hits}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--coverage-start',default=PROSPECTIVE);p.add_argument('--as-of',default=None);p.add_argument('--output',type=Path,default=ROOT/'secure');p.add_argument('--max-requests',type=int,default=500);p.add_argument('--seconds',type=int,default=150);a=p.parse_args()
 asof=a.as_of or now()
 if not stamp(PROSPECTIVE)<=stamp(a.coverage_start)<stamp(asof)<=stamp(now()):raise ValueError('invalid_forward_window')
 root=a.output.resolve();root.mkdir(parents=True,exist_ok=True,mode=0o700);root.chmod(0o700)
 lock=(root/'collector.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 cache=root/'snapshot-cache';cache.mkdir(exist_ok=True,mode=0o700)
 run=root/('run-'+uuid.uuid4().hex);run.mkdir(mode=0o700)
 manifest={'contractVersion':1,'status':'running','coverageStart':a.coverage_start,'asOf':asof,'endExclusive':True,'prospectiveStart':PROSPECTIVE,'startedAt':now(),'sourceTable':'ihh_funnel_contacts','locationId':LOC,'productionWrites':0,'scanMode':'full-forward-window-replay','ledgerScope':{'contactIds':'source cohort','sourceTable':'ihh_lifecycle_events','locationScope':'IHH-specific table; no location column; native opportunity location verified','isQa':False,'eventAtEndExclusive':asof,'lowerBound':None},'limitations':['CAPI-acknowledged quiz-lead subset, not all quiz submissions','Source GETs are not a transactional point-in-time snapshot','Complete scan is not mature lifecycle conversion completeness']}
 save(run/'manifest.json',manifest)
 try:
  client=Client(env(),a.max_requests,a.seconds);records,audit,counts=collect(client,a.coverage_start,asof,cache)
  save(run/'records.json',records);save(run/'audit.json',audit)
  manifest.update(status='complete',completedAt=now(),sourceScanComplete=True,healthyEmpty=len(audit)==0,**counts,sourceGetRequests=client.calls,sha256={n:hashlib.sha256((run/n).read_bytes()).hexdigest() for n in ['records.json','audit.json']})
  save(run/'manifest.json',manifest);save(root/'latest-complete.json',{'run':run.name,'manifestSha256':hashlib.sha256((run/'manifest.json').read_bytes()).hexdigest()})
  print(json.dumps({'status':'complete',**counts,'healthyEmpty':manifest['healthyEmpty'],'sourceGetRequests':client.calls,'manifest':str(run/'manifest.json'),'productionWrites':0}))
 except Exception as exc:
  manifest.update(status='failed',completedAt=now(),sourceScanComplete=False,errorCode=type(exc).__name__)
  save(run/'manifest.json',manifest)
  print(json.dumps({'status':'failed','sourceScanComplete':False,'errorCode':type(exc).__name__,'manifest':str(run/'manifest.json')}));return 1
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:print(json.dumps({'status':'failed','errorCode':type(exc).__name__}));sys.exit(1)
