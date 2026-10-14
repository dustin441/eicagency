#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { parse as parseCsvRecords } from '@fast-csv/parse';

export const REQUIRED_CORE_FIELDS = [
  'id','createdAt','updatedAt','email','phone','mktoAcquisitionDate','acquisitionProgramId','annualRevenue',
  'dateMQL','dateSQL','dateClosedWon','dateClosedLost','leadRevenueStageId','leadSource','leadSourceDetail',
  'leadStatus','lifecycleStage','mQLScore','originalSourceType','originalSourceInfo','originalutmsource',
  'originalutmmedium','originalutmcampaign','originalutmcontent','originalutmterm','registrationSourceInfo',
  'registrationSourceType','statuscode','utmsource','utmmedium','utmcampaign','utmcampaignid','utmcampaignname',
  'utmcontent','utmterm','utmadgroupname','utmadsetid','utmadsetname','utmadid','utmadname','gclid','FBCLID',
  'pp_fleetsize','pp_fleetsizesegment','pp_marketoleadsource','pp_marketoleadsourcedetail',
  'pp_marketolifecyclestatus','uTMHistory',
];

function normalizeRow(row) {
  const id = String(row.id ?? '').trim();
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error(`Invalid Marketo ID: ${id || '<blank>'}`);
  if (!row.updatedAt || Number.isNaN(Date.parse(row.updatedAt))) throw new Error(`Invalid updatedAt for Marketo ID ${id}`);
  return { ...row, id };
}

export async function consumeCsvStream(readable, onBatch = async () => {}, batchSize = 250) {
  if (!readable || typeof readable.pipe !== 'function') throw new Error('Marketo CSV response body is unavailable');
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('CSV batch size must be a positive integer');
  const sourceHash = createHash('sha256');
  const hashTap = new Transform({
    transform(chunk, encoding, callback) {
      sourceHash.update(chunk);
      callback(null, chunk);
    },
  });
  const parser = parseCsvRecords({
    headers(headers) {
      const normalized = headers.map((header, index) => index === 0 ? String(header).replace(/^\uFEFF/, '') : String(header));
      if (new Set(normalized).size !== normalized.length) throw new Error('Duplicate Marketo CSV headers');
      return normalized;
    },
    ignoreEmpty: true,
    strictColumnHandling: true,
  });
  parser.on('data-invalid', (_row, rowNumber, reason) => {
    parser.destroy(new Error(`Marketo CSV row ${rowNumber} is invalid${reason ? `: ${reason}` : ''}`));
  });
  const seenIds = new Set();
  let parsedCount = 0;
  let batch = [];
  await pipeline(readable, hashTap, parser, async (records) => {
    for await (const rawRow of records) {
      const row = normalizeRow(rawRow);
      if (seenIds.has(row.id)) throw new Error(`Duplicate Marketo ID in full snapshot: ${row.id}`);
      seenIds.add(row.id);
      parsedCount += 1;
      batch.push(row);
      if (batch.length >= batchSize) {
        await onBatch(batch);
        batch = [];
      }
    }
    if (batch.length) await onBatch(batch);
  });
  return { parsedCount, uniqueCount: seenIds.size, sourceChecksum: sourceHash.digest('hex') };
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

export function validatePublicationArgs(args) {
  if (!args.dryRun && args.smartListId !== undefined) throw new Error('--smart-list-id is dry-run only; publishing uses the database-approved source contract');
}

export function validateFieldDictionary(fields) {
  if (!Array.isArray(fields) || fields.length === 0) throw new Error('Marketo field dictionary is empty');
  const descriptors = fields
    .filter((field) => field && typeof field.name === 'string' && field.name.trim())
    .map((field) => ({ ...field, name: field.name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = descriptors.map((field) => field.name);
  if (new Set(names).size !== names.length) throw new Error('Marketo field dictionary contains duplicate REST names');
  const missing = REQUIRED_CORE_FIELDS.filter((field) => !names.includes(field));
  if (missing.length) throw new Error(`Marketo field dictionary is missing required fields: ${missing.join(', ')}`);
  return {
    descriptors,
    names,
    dictionaryChecksum: checksum(JSON.stringify(descriptors)),
  };
}

export function buildExportRequest(smartListId, fields) {
  if (!Array.isArray(fields) || fields.length === 0) throw new Error('Full Marketo export requires a non-empty field dictionary');
  return { fields, format: 'CSV', filter: { smartListId } };
}

export function validateSourceContract(payload) {
  const contract = Array.isArray(payload) ? payload[0] : payload;
  if (!contract || contract.singleton !== true) throw new Error('Approved Marketo source contract is not configured');
  const smartListId = Number(contract.smart_list_id);
  const minimumProviderCount = Number(contract.minimum_provider_count);
  const maximumDropFraction = Number(contract.maximum_drop_fraction);
  if (!Number.isSafeInteger(smartListId) || smartListId <= 0) throw new Error('Approved source contract has an invalid smart-list ID');
  if (!String(contract.smart_list_name ?? '').trim()) throw new Error('Approved source contract has no smart-list name');
  if (!/^[0-9a-f]{64}$/.test(String(contract.smart_list_rules_checksum ?? ''))) throw new Error('Approved source contract has an invalid rules checksum');
  if (!Number.isSafeInteger(minimumProviderCount) || minimumProviderCount <= 0) throw new Error('Approved source contract must require a positive minimum population');
  if (!Number.isFinite(maximumDropFraction) || maximumDropFraction < 0 || maximumDropFraction >= 1) throw new Error('Approved source contract has an invalid maximum drop fraction');
  return {
    smartListId,
    smartListName: String(contract.smart_list_name),
    smartListRulesChecksum: String(contract.smart_list_rules_checksum),
    minimumProviderCount,
    maximumDropFraction,
  };
}

export function validateSourceAgainstContract(source, contract) {
  if (source.smartListId !== contract.smartListId
      || source.smartListName !== contract.smartListName
      || source.smartListRulesChecksum !== contract.smartListRulesChecksum) {
    throw new Error(`Live Marketo source does not match approved contract: live=${source.smartListId}/${source.smartListName}/${source.smartListRulesChecksum} approved=${contract.smartListId}/${contract.smartListName}/${contract.smartListRulesChecksum}`);
  }
}

export function validatePopulation(providerCount, minimumProviderCount) {
  if (!Number.isSafeInteger(providerCount) || providerCount <= 0) throw new Error('Marketo full snapshot population must be nonzero');
  if (!Number.isSafeInteger(minimumProviderCount) || minimumProviderCount <= 0) throw new Error('Approved minimum provider count must be positive');
  if (providerCount < minimumProviderCount) throw new Error(`Marketo population ${providerCount} is below approved minimum ${minimumProviderCount}`);
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

async function fetchSourceDefinition({ baseUrl, token, smartListId }) {
  const [smartListPayload, fieldPayload] = await Promise.all([
    marketoRequest(baseUrl, token, `/rest/asset/v1/smartList/${smartListId}.json?includeRules=true`),
    marketoRequest(baseUrl, token, '/rest/v1/leads/describe2.json'),
  ]);
  const smartList = smartListPayload.result?.[0];
  if (!smartListPayload.success || !smartList || Number(smartList.id) !== smartListId) {
    throw new Error(`Marketo smart list ${smartListId} is unavailable: ${JSON.stringify(smartListPayload.errors ?? smartListPayload)}`);
  }
  const fields = validateFieldDictionary(fieldPayload.result?.[0]?.fields);
  return {
    smartListId,
    smartListName: String(smartList.name ?? ''),
    smartListRulesChecksum: checksum(JSON.stringify(smartList.rules ?? null)),
    fieldNames: fields.names,
    fieldCount: fields.names.length,
    fieldDictionaryChecksum: fields.dictionaryChecksum,
  };
}

async function exportSnapshot({ baseUrl, token, smartListId, fields, pollSeconds, onBatch, minimumProviderCount = 1 }) {
  const create = await marketoRequest(baseUrl, token, '/bulk/v1/leads/export/create.json', {
    method: 'POST',
    body: JSON.stringify(buildExportRequest(smartListId, fields)),
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
  const providerCount = Number(status.numberOfRecords);
  if (!Number.isSafeInteger(providerCount) || providerCount < 0) throw new Error(`Marketo export ${exportId} did not report a valid numberOfRecords`);
  validatePopulation(providerCount, minimumProviderCount);
  const fileResponse = await fetch(new URL(`/bulk/v1/leads/export/${exportId}/file.json`, baseUrl), { headers: { Authorization: `Bearer ${token}` } });
  if (!fileResponse.ok) throw new Error(`Marketo export download failed (${fileResponse.status})`);
  if (!fileResponse.body) throw new Error(`Marketo export ${exportId} returned no response body`);
  const streamed = await consumeCsvStream(Readable.fromWeb(fileResponse.body), onBatch);
  if (providerCount !== streamed.parsedCount) throw new Error(`Provider count ${providerCount} does not equal parsed count ${streamed.parsedCount}`);
  if (streamed.parsedCount !== streamed.uniqueCount) throw new Error(`Parsed count ${streamed.parsedCount} does not equal unique Marketo IDs ${streamed.uniqueCount}`);
  return { exportId, providerCount, ...streamed };
}

async function supabaseRequest(url, key, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return responseJson(await fetch(new URL(path, url), { ...init, headers }), `Supabase ${path}`);
}

async function fetchApprovedSourceContract(url, key) {
  const payload = await supabaseRequest(
    url,
    key,
    '/rest/v1/prepass_marketo_source_contract?singleton=eq.true&select=singleton,smart_list_id,smart_list_name,smart_list_rules_checksum,minimum_provider_count,maximum_drop_fraction',
  );
  return validateSourceContract(payload);
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  validatePublicationArgs(args);
  const marketoBaseUrl = requiredEnv('PREPASS_MARKETO_BASE_URL');
  const clientId = requiredEnv('PREPASS_MARKETO_CLIENT_ID');
  const clientSecret = requiredEnv('PREPASS_MARKETO_CLIENT_SECRET');
  const supabaseUrl = args.dryRun ? process.env.PREPASS_SUPABASE_URL : requiredEnv('PREPASS_SUPABASE_URL');
  const supabaseKey = args.dryRun ? process.env.PREPASS_SUPABASE_SERVICE_ROLE_KEY : requiredEnv('PREPASS_SUPABASE_SERVICE_ROLE_KEY');
  const contract = args.dryRun ? null : await fetchApprovedSourceContract(supabaseUrl, supabaseKey);
  const smartListId = contract?.smartListId ?? resolveSmartListId(args);

  if (args.dryRun) {
    const token = await marketoToken(marketoBaseUrl, clientId, clientSecret);
    const source = await fetchSourceDefinition({ baseUrl: marketoBaseUrl, token, smartListId });
    const exported = await exportSnapshot({
      baseUrl: marketoBaseUrl,
      token,
      smartListId,
      fields: source.fieldNames,
      pollSeconds: args.pollSeconds,
    });
    validatePopulation(exported.providerCount, 1);
    const summary = {
      smartListId,
      smartListName: source.smartListName,
      fieldCount: source.fieldCount,
      fieldDictionaryChecksum: source.fieldDictionaryChecksum,
      smartListRulesChecksum: source.smartListRulesChecksum,
      providerCount: exported.providerCount,
      parsedCount: exported.parsedCount,
      uniqueIds: exported.uniqueCount,
      checksum: exported.sourceChecksum,
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
        snapshot_mode: 'full_replace',
        approved_source_contract: {
          smart_list_id: contract.smartListId,
          smart_list_name: contract.smartListName,
          smart_list_rules_checksum: contract.smartListRulesChecksum,
          minimum_provider_count: contract.minimumProviderCount,
          maximum_drop_fraction: contract.maximumDropFraction,
        },
      },
    }),
  });
  if (!runId || typeof runId !== 'string') throw new Error('Supabase did not return a mirror run ID');
  try {
    const token = await marketoToken(marketoBaseUrl, clientId, clientSecret);
    const source = await fetchSourceDefinition({ baseUrl: marketoBaseUrl, token, smartListId });
    validateSourceAgainstContract(source, contract);
    const exported = await exportSnapshot({
      baseUrl: marketoBaseUrl,
      token,
      smartListId,
      fields: source.fieldNames,
      pollSeconds: args.pollSeconds,
      minimumProviderCount: contract.minimumProviderCount,
      onBatch: async (rows) => {
        await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_stage_marketo_mirror_rows', {
          method: 'POST',
          body: JSON.stringify({ p_run_id: runId, p_rows: rows }),
        });
      },
    });
    validatePopulation(exported.providerCount, contract.minimumProviderCount);
    const summary = {
      smartListId,
      smartListName: source.smartListName,
      fieldCount: source.fieldCount,
      fieldDictionaryChecksum: source.fieldDictionaryChecksum,
      smartListRulesChecksum: source.smartListRulesChecksum,
      providerCount: exported.providerCount,
      parsedCount: exported.parsedCount,
      uniqueIds: exported.uniqueCount,
      checksum: exported.sourceChecksum,
      exportId: exported.exportId,
    };
    await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_record_marketo_mirror_receipt', {
      method: 'POST',
      body: JSON.stringify({
        p_run_id: runId,
        p_smart_list_name: source.smartListName,
        p_smart_list_rules_checksum: source.smartListRulesChecksum,
        p_field_count: source.fieldCount,
        p_field_dictionary_checksum: source.fieldDictionaryChecksum,
        p_provider_export_id: exported.exportId,
        p_provider_count: exported.providerCount,
        p_parsed_count: exported.parsedCount,
        p_unique_count: exported.uniqueCount,
        p_source_checksum: summary.checksum,
        p_metadata: {
          writer: 'scripts/prepass-marketo-mirror-sync.mjs',
          snapshot_mode: 'full_replace',
          approved_source_contract: {
            smart_list_id: contract.smartListId,
            smart_list_name: contract.smartListName,
            smart_list_rules_checksum: contract.smartListRulesChecksum,
            minimum_provider_count: contract.minimumProviderCount,
            maximum_drop_fraction: contract.maximumDropFraction,
          },
          requested_fields: source.fieldNames,
        },
      }),
    });
    const finalized = await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_finalize_marketo_mirror_run', {
      method: 'POST',
      body: JSON.stringify({ p_run_id: runId }),
    });
    if (finalized.status !== 'completed') throw new Error(`Mirror snapshot blocked: ${JSON.stringify(finalized)}`);
    console.log(JSON.stringify({ mode: 'publish', runId, ...summary }, null, 2));
    return { runId, ...summary };
  } catch (error) {
    await supabaseRequest(supabaseUrl, supabaseKey, '/rest/v1/rpc/prepass_fail_marketo_mirror_run', {
      method: 'POST',
      body: JSON.stringify({ p_run_id: runId, p_error_code: 'WRITER_FAILURE', p_error_detail: String(error).slice(0, 1000) }),
    }).catch(() => {});
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
