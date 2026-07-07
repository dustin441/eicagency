import fs from 'node:fs';
import crypto from 'node:crypto';

const baseUrl = process.env.N8N_EIC_BASE_URL || process.env.EIC_N8N_BASE_URL;
const apiKey = process.env.N8N_EIC_API_KEY || process.env.EIC_N8N_API_TOKEN || process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) throw new Error('Missing n8n API env');

const ddl = fs.readFileSync('supabase/goodgame_organic_social.sql', 'utf8');
const suffix = crypto.randomBytes(4).toString('hex');
const name = `TEMP - Good Game Organic Social DDL ${suffix}`;
const path = `goodgame-organic-social-ddl-${suffix}`;
const workflow = {
  name,
  nodes: [
    {
      id: 'webhook',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [-420, 0],
      parameters: { httpMethod: 'POST', path, responseMode: 'responseNode', options: {} },
      webhookId: path,
    },
    {
      id: 'execute-ddl',
      name: 'Execute DDL',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [-120, 0],
      parameters: { operation: 'executeQuery', query: ddl, options: {} },
      credentials: { postgres: { id: '08FLqGwkHOBRkypq', name: 'Postgres account 3' } },
    },
    {
      id: 'respond',
      name: 'Respond Success',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.4,
      position: [180, 0],
      parameters: { respondWith: 'json', responseBody: '={{ { ok: true, result: $json } }}', options: {} },
    },
  ],
  connections: {
    Webhook: { main: [[{ node: 'Execute DDL', type: 'main', index: 0 }]] },
    'Execute DDL': { main: [[{ node: 'Respond Success', type: 'main', index: 0 }]] },
  },
  settings: {},
};

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const saved = await fetchJson(`${baseUrl}/api/v1/workflows`, { method: 'POST', body: workflow });
await fetchJson(`${baseUrl}/api/v1/workflows/${saved.id}/activate`, { method: 'POST' });
const webhookUrl = `${baseUrl.replace(/\/$/, '')}/webhook/${path}`;
const run = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: true }) });
const runText = await run.text();
console.log(JSON.stringify({ workflowId: saved.id, webhookUrl, status: run.status, body: runText.slice(0, 1000) }, null, 2));
await fetchJson(`${baseUrl}/api/v1/workflows/${saved.id}/deactivate`, { method: 'POST' });
await fetchJson(`${baseUrl}/api/v1/workflows/${saved.id}`, { method: 'DELETE' });
