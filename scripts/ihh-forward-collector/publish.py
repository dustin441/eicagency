#!/usr/bin/env python3
"""Collect read-only source; atomically publish ONLY dedicated IHH reporting tables."""
import argparse,datetime as dt,fcntl,hashlib,json,os,subprocess,sys
from pathlib import Path
import requests
from collect import ROOT,LOC,env,stamp
os.umask(0o077)
def literal(obj):return "'"+json.dumps(obj,separators=(',',':')).replace("'","''")+"'::jsonb"
def run():
 p=argparse.ArgumentParser();p.add_argument('--publish',action='store_true');p.add_argument('--skip-collect',action='store_true');a=p.parse_args()
 lock=(ROOT/'publisher.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 if not a.skip_collect:subprocess.run([sys.executable,str(ROOT/'collect.py'),'--seconds','240','--max-requests','2000'],check=True,capture_output=True,text=True)
 latest=json.loads((ROOT/'secure/latest-complete.json').read_text());directory=ROOT/'secure'/latest['run'];mb=(directory/'manifest.json').read_bytes()
 assert hashlib.sha256(mb).hexdigest()==latest['manifestSha256']
 m=json.loads(mb);assert m['status']=='complete' and m['sourceScanComplete'] and m['locationId']==LOC
 assert (dt.datetime.now(dt.timezone.utc)-stamp(m['completedAt'])).total_seconds()<1800
 rb=(directory/'records.json').read_bytes();ab=(directory/'audit.json').read_bytes()
 assert hashlib.sha256(rb).hexdigest()==m['sha256']['records.json'] and hashlib.sha256(ab).hexdigest()==m['sha256']['audit.json']
 records=json.loads(rb);audit=json.loads(ab);assert len(records)==m['eligibleRecords'] and len(audit)==m['sourceContacts']
 digest=hashlib.sha256(mb+rb).hexdigest();seen=set();rows=[];missing_schedule=False
 for r in records:
  assert r['location_id']==LOC and r['contact_id'] not in seen and r['contact_key']=='ghl:'+r['contact_id'];seen.add(r['contact_id'])
  assert r['attribution_channel']=='paid_social' and r['attribution_source'] in ['facebook','instagram'] and r['snapshot_schema_version']
  assert stamp(m['coverageStart'])<=stamp(r['lead_at'])<stamp(m['asOf']) and stamp(r['snapshot_at'])<=stamp(m['asOf'])
  assert r['quiz_taker'] is True and r['opportunity_resolution'] in ['unique_opportunity','consistent_explicit_ledger_opportunity']
  missing_schedule |= bool(r['appointment_scheduled'] and not r['appointment_at'])
  keys=['location_id','contact_id','contact_key','lead_at','quiz_taker','appointment_scheduled','appointment_at','opportunity_id','attribution_channel','attribution_source','snapshot_at','snapshot_schema_version','source_table','lifecycle_tracking_start']
  row={k:r[k] for k in keys};row['export_sha256']=digest
  events=[]
  for e in r['lifecycle_events']:
   assert e['contact_id']==r['contact_id'] and e['is_qa'] is False and stamp(e['event_at'])<stamp(m['asOf'])
   events.append({k:e.get(k) for k in ['id','event_key','event_type','contact_id','opportunity_id','appointment_id','event_at','is_qa','reverses_event_key']})
  row['payload']={'lifecycle_events':events};rows.append(row)
 coverage={s:{'status':'complete','evidence':'Complete bounded current source scan; observed original acknowledged Meta-paid subset, not all native submissions or eventual outcomes.'} for s in ['quizLead','appointmentScheduled','closerScheduled','closedWon']}
 if missing_schedule:coverage['appointmentScheduled']={'status':'partial','evidence':'Existing scheduled flag without source timestamp; not inferred.'}
 manifest={'location_id':LOC,'export_sha256':digest,'status':'published','source_table':'ihh_funnel_contacts','classifier_version':'preserved_native_snapshots','classification_evidence':'Native immutable source/channel/schema retained; full forward source cohort and ambiguity checks completed.','cohort_start':m['coverageStart'],'cohort_end_exclusive':m['asOf'],'observation_cutoff':m['asOf'],'published_at':dt.datetime.now(dt.timezone.utc).isoformat(),'row_count':len(rows),'coverage':coverage}
 output={'mode':'publish' if a.publish else 'dry-run','row_count':len(rows),'source_contacts':len(audit),'coverage_start':m['coverageStart'],'as_of':m['asOf'],'export_sha256':digest}
 if a.publish:
  v=env();url='https://api.supabase.com/v1/projects/'+v['SPARTACO_SUPABASE_URL'].split('//')[1].split('.')[0]+'/database/query'
  sql="BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; "
  sql+='INSERT INTO public.ihh_meta_paid_original_cohort SELECT * FROM jsonb_populate_recordset(NULL::public.ihh_meta_paid_original_cohort,'+literal(rows)+") ON CONFLICT DO NOTHING; " if rows else ''
  # imported_at is omitted by row projection below so database default is preserved.
  if rows:
   cols=list(rows[0]);sql="BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; INSERT INTO public.ihh_meta_paid_original_cohort ("+','.join(cols)+') SELECT '+','.join(cols)+' FROM jsonb_populate_recordset(NULL::public.ihh_meta_paid_original_cohort,'+literal(rows)+') ON CONFLICT DO NOTHING; '
  sql+="DO $gate$ BEGIN IF (SELECT count(*) FROM public.ihh_meta_paid_original_cohort WHERE location_id='"+LOC+"' AND export_sha256='"+digest+"') <> "+str(len(rows))+" THEN RAISE EXCEPTION 'incomplete reporting batch'; END IF; END $gate$; "
  sql+='INSERT INTO public.ihh_meta_paid_cohort_manifests SELECT * FROM jsonb_populate_record(NULL::public.ihh_meta_paid_cohort_manifests,'+literal(manifest)+') ON CONFLICT DO NOTHING; COMMIT;'
  response=requests.post(url,headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN']},json={'query':sql},timeout=45);response.raise_for_status()
  q="SELECT row_count,cohort_start,observation_cutoff FROM public.ihh_meta_paid_cohort_manifests WHERE location_id='"+LOC+"' AND export_sha256='"+digest+"'"
  check=requests.post(url,headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN']},json={'query':q},timeout=30);check.raise_for_status();got=check.json();assert len(got)==1 and got[0]['row_count']==len(rows)
  output['readback_verified']=True
 (ROOT/'last-publication.json').write_text(json.dumps(output,indent=2));print(json.dumps(output))
if __name__=='__main__':
 try:run()
 except Exception as e:print(json.dumps({'status':'failed','error_type':type(e).__name__}),file=sys.stderr);sys.exit(1)
