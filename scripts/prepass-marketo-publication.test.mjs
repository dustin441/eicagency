import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, checksum, REQUIRED_CORE_FIELDS } from './prepass-marketo-mirror-sync.mjs';

// Deterministic integration fixture only. No provider or production network calls.
test('publication receipt enables the dashboard only after exact full-field export validation', async () => {
  const oldFetch = globalThis.fetch;
  const keys = ['PREPASS_MARKETO_BASE_URL','PREPASS_MARKETO_CLIENT_ID','PREPASS_MARKETO_CLIENT_SECRET','PREPASS_SUPABASE_URL','PREPASS_SUPABASE_SERVICE_ROLE_KEY'];
  const oldEnv = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, {
    PREPASS_MARKETO_BASE_URL: 'https://marketo.fixture.test', PREPASS_MARKETO_CLIENT_ID: 'fixture',
    PREPASS_MARKETO_CLIENT_SECRET: 'fixture', PREPASS_SUPABASE_URL: 'https://supabase.fixture.test',
    PREPASS_SUPABASE_SERVICE_ROLE_KEY: 'fixture',
  });
  const fields = [...REQUIRED_CORE_FIELDS, 'newCustomField'];
  const rules = { filters: [{ name: 'Created At', operator: 'is not empty' }] };
  const source = { singleton: true, smart_list_id: 999, smart_list_name: 'Reporting v2 | Full Marketo Snapshot', smart_list_rules_checksum: checksum(JSON.stringify(rules)), minimum_provider_count: 1, maximum_drop_fraction: 0.2 };
  const calls = [];
  let omitCustomField = false;
  const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type':'application/json' } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    assert.ok(['marketo.fixture.test','supabase.fixture.test'].includes(url.hostname), 'network escape');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: url.pathname, body });
    if (url.pathname === '/identity/oauth/token') return json({ access_token: 'fixture-token' });
    if (url.pathname === '/rest/v1/prepass_marketo_source_contract') return json([source]);
    if (url.pathname.endsWith('/prepass_begin_marketo_mirror_run')) return json('11111111-1111-4111-8111-111111111111');
    if (url.pathname === '/rest/asset/v1/smartList/999.json') return json({ success:true,result:[{ id:999,name:source.smart_list_name,rules }] });
    if (url.pathname === '/rest/v1/leads/describe2.json') return json({ success:true,result:[{fields:fields.map(name => ({name,dataType:'string'}))}] });
    if (url.pathname === '/bulk/v1/leads/export/create.json') {
      assert.equal(body.fields.length, fields.length);
      assert.deepEqual(body.filter, { smartListId:999 });
      return json({success:true,result:[{exportId:'fixture-export'}]});
    }
    if (url.pathname.endsWith('/enqueue.json')) return json({success:true});
    if (url.pathname.endsWith('/status.json')) return json({success:true,result:[{status:'Completed',numberOfRecords:1}]});
    if (url.pathname.endsWith('/file.json')) {
      const exportedFields = omitCustomField ? fields.filter(f => f !== 'newCustomField') : fields;
      const values = { id:'1', createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-11-12T00:00:00Z', newCustomField:'raw custom value' };
      return new Response(exportedFields.join(',')+'\n'+exportedFields.map(f => JSON.stringify(values[f] ?? '')).join(',')+'\n');
    }
    if (url.pathname.endsWith('/prepass_finalize_marketo_mirror_run')) return json({status:'completed'});
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json({});
    throw new Error('Unexpected fixture URL '+url.pathname);
  };
  try {
    await run(['--poll-seconds','0']);
    const receipt = calls.find(c => c.path.endsWith('/prepass_record_marketo_mirror_receipt'));
    assert.ok(receipt);
    assert.equal(receipt.body.p_metadata.reporting_scope, 'all_accessible_people');
    assert.equal(receipt.body.p_metadata.full_field_dictionary, true);
    assert.equal(receipt.body.p_metadata.field_dictionary.length, fields.length);
    assert.ok(receipt.body.p_metadata.requested_fields.includes('newCustomField'));
    assert.equal(receipt.body.p_provider_count, receipt.body.p_parsed_count);
    const stage = calls.find(c => c.path.endsWith('/prepass_stage_marketo_mirror_rows'));
    assert.equal(stage.body.p_rows[0].newCustomField, 'raw custom value');
    assert.ok(calls.indexOf(stage) < calls.indexOf(receipt));
    calls.length = 0;
    omitCustomField = true;
    await assert.rejects(run(['--poll-seconds','0']), /field coverage mismatch/);
    assert.ok(!calls.some(c => c.path.endsWith('/prepass_record_marketo_mirror_receipt')));
    assert.ok(!calls.some(c => c.path.endsWith('/prepass_finalize_marketo_mirror_run')));
    assert.ok(calls.some(c => c.path.endsWith('/prepass_fail_marketo_mirror_run')));
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of keys) {
      if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    }
  }
});
