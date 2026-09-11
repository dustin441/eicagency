import unittest,tempfile,json
from pathlib import Path
from unittest.mock import patch
import collect as c
ASOF='2026-09-11T21:00:00Z'
def opp(channel='paid_social',source='facebook',snapshot='2026-09-11T20:54:00Z'):
 values=dict(channel=channel,source=source,snapshot_at=snapshot,schema_version='existing_v2')
 return {'id':'opp1','contactId':'contact1','locationId':c.LOC,'customFields':[{'id':c.FIELDS[k],'fieldValue':v} for k,v in values.items()]}
class Tests(unittest.TestCase):
 def test_paginated_server_cap(self):
  class Client:
   def get(self,path,p,sb):
    last=int(p.get('id','gt.0').split('.')[1]);return [{'id':n} for n in range(last+1,min(last+38,252))]
  rows=c.pages(Client(),'table',{},'id');self.assertEqual(len(rows),251);self.assertEqual(rows[-1]['id'],251)
 def test_repeated_page_fails(self):
  class Client:
   def get(self,*args):return [{'id':1}]
  with self.assertRaises(RuntimeError):c.pages(Client(),'table',{},'id')
 def test_empty_is_complete_scan(self):
  class Client:
   def get(self,*args):return []
  with tempfile.TemporaryDirectory() as d:
   rows,audit,counts=c.collect(Client(),c.PROSPECTIVE,ASOF,Path(d))
  self.assertEqual(rows,[]);self.assertEqual(audit,[]);self.assertEqual(counts['sourceContacts'],0)
 def test_existing_snapshot_preserved(self):
  state,s=c.classify([opp()],[],ASOF);self.assertEqual(state,'verified_meta_paid');self.assertEqual(s['schema_version'],'existing_v2')
 def test_exclusions_and_pending(self):
  for o,expected in [(opp(snapshot=None),'missing_immutable_snapshot'),(opp(channel='unknown'),'unknown_snapshot'),(opp(source='google'),'excluded_non_meta_source'),(opp(snapshot='2026-09-12T00:00:00Z'),'snapshot_after_asof')]:
   self.assertEqual(c.classify([o],[],ASOF)[0],expected)
 def test_ambiguity_ledger_resolution(self):
  a=opp();b={**opp(),'id':'opp2'}
  self.assertEqual(c.classify([a,b],[],ASOF)[0],'ambiguous_multi_opportunity')
  self.assertEqual(c.classify([a,b],[{'opportunity_id':'opp1'}],ASOF)[0],'verified_meta_paid')
 def test_atomic_secure_output(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'batch.json';c.save(p,{'status':'complete'})
   self.assertEqual(json.loads(p.read_text())['status'],'complete');self.assertEqual(p.stat().st_mode&0o777,0o600)
 def test_realistic_record_and_scoped_ledger(self):
  contact={'contact_key':'ghl:contact1','lead_at':'2026-09-11T20:54:00Z','quiz_taker':True,'appointment_scheduled':False,'appointment_at':None,'lead_source':'native','appointment_source':None,'synced_at':'2026-09-11T20:55:00Z'}
  class Client:
   def get(self,path,p=None,sb=False):
    if path=='/ihh_funnel_contacts':return [] if 'contact_key' in p else [contact]
    if path=='/ihh_lifecycle_events':
     assert p['is_qa']=='eq.false' and p['event_at']=='lt.'+ASOF and p['contact_id']=='eq.contact1'
     return []
    if path=='/opportunities/search':return {'opportunities':[{'id':'opp1'}] if p['page']==1 else []}
    if path=='/opportunities/opp1':return {'opportunity':opp()}
    raise AssertionError(path)
  with tempfile.TemporaryDirectory() as d:
   rows,audit,counts=c.collect(Client(),c.PROSPECTIVE,ASOF,Path(d))
   rows2,_,counts2=c.collect(Client(),c.PROSPECTIVE,ASOF,Path(d))
  self.assertEqual(rows,rows2);self.assertEqual(counts2['immutableCacheHits'],1)
  for key,value in contact.items():self.assertEqual(rows[0][key],value)
if __name__=='__main__':unittest.main(verbosity=2)
