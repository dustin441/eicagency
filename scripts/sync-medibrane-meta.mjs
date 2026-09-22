#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const MEDIBRANE_ACCOUNT_ID = '1532993340786486';
export const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || '';
// Meta can expose the same lead conversion under multiple aliases. Use the
// canonical aggregate first and fall back to progressively narrower aliases;
// never sum aliases, which would double-count the same conversion.
const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'offsite_conversion.fb_pixel_lead',
];

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function extractLeads(actions = []) {
  for (const actionType of LEAD_ACTION_TYPES) {
    const action = actions.find((candidate) => candidate?.action_type === actionType);
    if (action) return number(action.value);
  }
  return 0;
}

export function toDailyRow(insight) {
  if (String(insight.account_id ?? '') !== MEDIBRANE_ACCOUNT_ID) {
    throw new Error(`Meta account mismatch: expected Medibrane account ${MEDIBRANE_ACCOUNT_ID}`);
  }
  if (!insight.date_start || insight.date_start !== insight.date_stop) {
    throw new Error('Expected one daily Meta insight row with matching date_start/date_stop');
  }
  if (!insight.campaign_id || !insight.campaign_name) {
    throw new Error('Meta insight is missing immutable campaign identity');
  }
  return {
    date: insight.date_start,
    account_id: MEDIBRANE_ACCOUNT_ID,
    campaign_id: String(insight.campaign_id),
    campaign_name: String(insight.campaign_name),
    ad_channel: 'Meta',
    impressions: number(insight.impressions),
    clicks: number(insight.clicks),
    link_clicks: number(insight.inline_link_clicks),
    cost: number(insight.spend),
    conversions: extractLeads(insight.actions),
  };
}

export function parseUsage(headers) {
  let maximum = 0;
  const percentageKeys = new Set(['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct']);

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (percentageKeys.has(key)) maximum = Math.max(maximum, number(nested));
      else if (typeof nested === 'object') visit(nested);
    }
  }

  for (const name of ['x-app-usage', 'x-business-use-case-usage', 'x-ad-account-usage']) {
    const raw = headers.get(name);
    if (!raw) continue;
    try {
      visit(JSON.parse(raw));
    } catch {
      throw new Error(`Meta returned an invalid ${name} header`);
    }
  }
  return maximum;
}

export function assertSafeGraphUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'graph.facebook.com') {
    throw new Error('Refusing to send Meta credentials to an untrusted pagination URL');
  }
  return url.toString();
}

async function graphPage(url, token) {
  const response = await fetch(assertSafeGraphUrl(url), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Meta API ${response.status}: ${body?.error?.message || 'request failed'}`);
  const usage = parseUsage(response.headers);
  if (usage >= 80) throw new Error(`Meta usage reached ${usage}%; stopping before account throttling`);
  if (usage >= 60) await new Promise((resolve) => setTimeout(resolve, 5_000));
  return body;
}

async function fetchDailyInsights({ token, since, until }) {
  const fields = [
    'account_id', 'campaign_id', 'campaign_name', 'spend', 'impressions',
    'clicks', 'inline_link_clicks', 'actions', 'date_start', 'date_stop',
  ].join(',');
  const params = new URLSearchParams({
    level: 'campaign',
    fields,
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
  });
  let next = `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${MEDIBRANE_ACCOUNT_ID}/insights?${params}`;
  const rows = [];
  while (next) {
    const page = await graphPage(next, token);
    rows.push(...(page.data ?? []).map(toDailyRow));
    next = page.paging?.next || '';
  }
  return rows;
}

async function upsertRows({ rows, supabaseUrl, serviceKey }) {
  if (!rows.length) return 0;
  const updatedAt = new Date().toISOString();
  const payload = rows.map(row => ({ ...row, updated_at: updatedAt }));
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/medibrane_meta?on_conflict=date,campaign_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase upsert failed (${response.status}): ${body.slice(0, 500)}`);
  const saved = body ? JSON.parse(body) : [];
  if (saved.length !== rows.length) throw new Error(`Supabase returned ${saved.length} rows after ${rows.length} upserts`);
  return saved.length;
}

function defaultWindow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prior = new Date(yesterday);
  prior.setUTCDate(prior.getUTCDate() - 27);
  return {
    since: prior.toISOString().slice(0, 10),
    until: yesterday.toISOString().slice(0, 10),
  };
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseArgs(argv) {
  const defaults = defaultWindow();
  const value = (flag) => argv[argv.indexOf(flag) + 1];
  return {
    since: argv.includes('--since') ? value('--since') : defaults.since,
    until: argv.includes('--until') ? value('--until') : defaults.until,
    apply: argv.includes('--apply'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isIsoDate(args.since) || !isIsoDate(args.until) || args.since > args.until) {
    throw new Error('Use a valid inclusive --since YYYY-MM-DD --until YYYY-MM-DD range');
  }
  if (!/^v\d+\.\d+$/.test(META_GRAPH_VERSION)) {
    throw new Error('META_GRAPH_API_VERSION is required and must look like v25.0');
  }
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('META_ACCESS_TOKEN is required');

  const rows = await fetchDailyInsights({ token, since: args.since, until: args.until });
  if (!args.apply) {
    console.log(JSON.stringify({ dryRun: true, accountId: MEDIBRANE_ACCOUNT_ID, since: args.since, until: args.until, rows: rows.length }));
    return;
  }

  const supabaseUrl = process.env.SPARTACO_SUPABASE_URL?.trim();
  const serviceKey = process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error('SPARTACO_SUPABASE_URL and SPARTACO_SUPABASE_SERVICE_ROLE_KEY are required with --apply');
  const saved = await upsertRows({ rows, supabaseUrl, serviceKey });
  console.log(JSON.stringify({ applied: true, accountId: MEDIBRANE_ACCOUNT_ID, since: args.since, until: args.until, saved }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
