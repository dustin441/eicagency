#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REQUIRED_FIELDS = [
  'id','createdAt','updatedAt','email','phone','mktoAcquisitionDate','acquisitionProgramId','annualRevenue',
  'dateMQL','dateSQL','dateClosedWon','dateClosedLost','leadRevenueStageId','leadSource','leadSourceDetail',
  'leadStatus','lifecycleStage','mQLScore','originalSourceType','originalSourceInfo','originalutmsource',
  'originalutmmedium','originalutmcampaign','originalutmcontent','originalutmterm','registrationSourceInfo',
  'registrationSourceType','statuscode','utmsource','utmmedium','utmcampaign','utmcampaignid','utmcampaignname',
  'utmcontent','utmterm','utmadgroupname','utmadsetid','utmadsetname','utmadid','utmadname','gclid','fbclid',
  'pp_fleetsize','pp_fleetsizesegment','pp_marketoleadsource','pp_marketoleadsourcedetail',
  'pp_marketolifecyclestatus','uTMHistory',
];

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ''));
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate Marketo CSV headers');
  return rows.filter((values) => values.some(Boolean)).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Marketo CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, fieldIndex) => [header, values[fieldIndex] ?? '']));
  });
}

export function normalizeRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    if (!/^[1-9][0-9]*$/.test(id)) throw new Error(`Invalid Marketo ID: ${id || '<blank>'}`);
    if (!row.updatedAt || Number.isNaN(Date.parse(row.updatedAt))) throw new Error(`Invalid updatedAt for Marketo ID ${id}`);
    const normalized = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, row[field] ?? '']));
    const existing = byId.get(id);
    if (!existing || Date.parse(normalized.updatedAt) >= Date.parse(existing.updatedAt)) byId.set(id, normalized);
  }
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export function checksum(text) {
  return createHash('sha256').update(text).digest('hex');
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function parseArgs(argv) {
  const args = { dryRun: false, pollSeconds: 60 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--smart-list-id') args.smartListId = argv[++index];
    else if (value === '--poll-seconds') args.pollSeconds = Number(argv[++index]);
    else throw new Error(`Unknown argument ${value}`);
  }
  if (!Number.isFinite(args.pollSeconds) || args.pollSeconds < 0) throw new Error('--poll-seconds must be a non-negative number');
  return args;
}

export function resolveSmartListId(args, env = process.env) {
  const raw = args.smartListId ?? env.PREPASS_MARKETO_FULL_SMART_LIST_ID;
  if (raw === undefined || raw === '') throw new Error('Missing required environment variable PREPASS_MARKETO_FULL_SMART_LIST_ID (or pass --smart-list-id)');
  if (!/^[1-9][0-9]*$/.test(String(raw))) throw new Error('Marketo full smart-list ID must be a positive integer');
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new Error('Marketo full smart-list ID must be a positive safe integer');
  return id;
}

export function buildExportRequest(smartListId) {
  return { fields: REQUIRED_FIELDS, format: 'CSV', filter: { smartListId } };
}

async function responseJson(response, label) {
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function marketoToken(baseUrl, clientId, clientSecret) {
  const url = new URL('/identity/oauth/token', baseUrl);
  url.searchParams.set('grant_type', 'client_credentials');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  const payload = await responseJson(await fetch(url), 'Marketo token request');
  if (!payload.access_token) throw new Error('Marketo token response did not include access_token');
  return payload.access_token;
}

async function marketoRequest(baseUrl, token, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return responseJson(await fetch(new URL(path, baseUrl), { ...init, headers }), `Marketo ${path}`);
}

async function exportSnapshot({ baseUrl, token, smartListId, pollSeconds }) {
  const create = await marketoRequest(baseUrl, token, '/bulk/v1/leads/export/create.json', {
    method: 'POST',
    body: JSON.stringify(buildExportRequest(smartListId)),
  });
  const exportId = create.result?.[0]?.exportId;
  if (!create.success || !exportId) throw new Error(`Marketo did not create export: ${JSON.stringify(create.errors ?? create)}`);
  await marketoRequest(baseUrl, token, `/bulk/v1/leads/export/${exportId}/enqueue.json`, { method: 'POST' });
  let status;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
    const payload = await marketoRequest(baseUrl, token, `/bulk/v1/leads/export/${exportId}/status.json`);
    status = payload.result?.[0];
    if (status?.status === 'Completed') break;
    if (['Failed','Cancelled'].includes(status?.status)) throw new Error(`Marketo export ${exportId} ${status.status}`);
  }
  if (status?.status !== 'Completed') throw new Error(`Marketo export ${exportId} timed out`);
  const fileResponse = await fetch(new URL(`/bulk/v1/leads/export/${exportId}/file.json`, baseUrl), { headers: { Authorization: `Bearer ${token}` } });
  if (!fileResponse.ok) throw new Error(`Marketo export download failed (${fileResponse.status})`);
  const csv = await fileResponse.text();
  const parsedRows = parseCsv(csv);
  const rows = normalizeRows(parsedRows);
  const providerCount = Number(status.numberOfRecords);
  if (!Number.isSafeInteger(providerCount) || providerCount < 0) throw new Error(`Marketo export ${exportId} did not report a valid numberOfRecords`);
  if (providerCount !== parsedRows.length) throw new Error(`Provider count ${providerCount} does not equal parsed count ${parsedRows.length}`);
  if (parsedRows.length !== rows.length) throw new Error(`Parsed count ${parsedRows.length} does not equal unique Marketo IDs ${rows.length}`);
  return { exportId, csv, rows, providerCount, parsedCount: parsedRows.length, uniqueCount: rows.length };
}

async function supabaseRequest(url, key, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return responseJson(await fetch(new URL(path, url), { ...init, headers }), `Supabase ${path}`);
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const smartListId = resolveSmartListId(args);
  const marketoBaseUrl = requiredEnv('PREPASS_MARKETO_BASE_URL');
  const clientId = requiredEnv('PREPASS_MARKETO_CLIENT_ID');
  const clientSecret = requiredEnv('PREPASS_MARKETO_CLIENT_SECRET');
  const supabaseUrl = args.dryRun ? process.env.PREPASS_SUPABASE_URL : requiredEnv('PREPASS_SUPABASE_URL');
  const supabaseKey = args.dryRun ? process.env.PREPASS_SUPABASE_SERVICE_ROLE_KEY : requiredEnv('PREPASS_SUPABASE_SERVICE_ROLE_KEY');

  if (args.dryRun) {
    const token = await marketoToken(marketoBaseUrl, clientId, clientSecret);
    const exported = await exportSnapshot({ baseUrl: marketoBaseUrl, token, smartListId, pollSeconds: args.pollSeconds });
    const summary = {
      smartListId,
      providerCount: exported.providerCount,
      parsedCount: exported.parsedCount,
      uniqueIds: exported.uniqueCount,
      checksum: checksum(exported.csv),
      exportId: exported.exportId,
    };
    console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
    return summary;
  }

  const runId = await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_begin_marketo_mirror_run', {
    method: 'POST',
    body: JSON.stringify({
      p_smart_list_id: smartListId,
      p_metadata: {
        writer: 'scripts/prepass-marketo-mirror-sync.mjs',
        field_set_version: 'prepass-reporting-v2',
        requested_field_count: REQUIRED_FIELDS.length,
      },
    }),
  });
  if (!runId || typeof runId !== 'string') throw new Error('Supabase did not return a mirror run ID');
  try {
    const token = await marketoToken(marketoBaseUrl, clientId, clientSecret);
    const exported = await exportSnapshot({ baseUrl: marketoBaseUrl, token, smartListId, pollSeconds: args.pollSeconds });
    const summary = {
      smartListId,
      providerCount: exported.providerCount,
      parsedCount: exported.parsedCount,
      uniqueIds: exported.uniqueCount,
      checksum: checksum(exported.csv),
      exportId: exported.exportId,
    };
    await supabaseRequest(supabaseUrl, supabaseKey, `/rest/v1/prepass_marketo_mirror_runs?run_id=eq.${runId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        provider_export_id: exported.exportId,
        provider_count: exported.providerCount,
        parsed_count: exported.parsedCount,
        unique_count: exported.uniqueCount,
        source_checksum: summary.checksum,
      }),
    });
    for (let offset = 0; offset < exported.rows.length; offset += 250) {
      await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_stage_marketo_mirror_rows', {
        method: 'POST',
        body: JSON.stringify({ p_run_id: runId, p_rows: exported.rows.slice(offset, offset + 250) }),
      });
    }
    const finalized = await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_finalize_marketo_mirror_run', {
      method: 'POST',
      body: JSON.stringify({ p_run_id: runId }),
    });
    if (finalized.status !== 'completed') throw new Error(`Mirror snapshot blocked: ${JSON.stringify(finalized)}`);
    console.log(JSON.stringify({ mode: 'publish', runId, ...summary }, null, 2));
    return { runId, ...summary };
  } catch (error) {
    await supabaseRequest(supabaseUrl, supabaseKey, `/rest/v1/prepass_marketo_mirror_runs?run_id=eq.${runId}&status=eq.staging`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString(), error_code: 'WRITER_FAILURE', error_detail: String(error).slice(0, 1000) }),
    }).catch(() => {});
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
