const prepassWorkflowId = 'hq4AP24YUl9oRyam';
const arabellaCredentialWorkflowId = 'bLHmg4lfvbmjesVc';
const arabellaAdAccountId = '859012066875552';
const targetWorkflowName = 'Meta Ads Puller Creatives to Supabase - Arabella ✅';

const baseUrl = process.env.EIC_N8N_BASE_URL;
const apiKey = process.env.EIC_N8N_API_TOKEN;

if (!baseUrl || !apiKey) {
  throw new Error('Missing EIC_N8N_BASE_URL or EIC_N8N_API_TOKEN');
}

const [prepassWorkflow, arabellaWorkflow] = await Promise.all([
  fetchJson(`${baseUrl}/api/v1/workflows/${prepassWorkflowId}`),
  fetchJson(`${baseUrl}/api/v1/workflows/${arabellaCredentialWorkflowId}`),
]);

const arabellaNodes = new Map(arabellaWorkflow.nodes.map((node) => [node.name, node]));
const arabellaPullData = requireNode(arabellaNodes, 'Pull Data');
const arabellaUpsert = requireNode(arabellaNodes, 'Insert or update rows in a table');

const workflow = structuredClone(prepassWorkflow);
workflow.name = targetWorkflowName;
workflow.nodes = workflow.nodes.map((node) => {
  const next = structuredClone(node);

  if (next.type === 'n8n-nodes-base.httpRequest') {
    next.credentials = structuredClone(arabellaPullData.credentials);
  }

  if (next.type === 'n8n-nodes-base.postgres') {
    next.credentials = structuredClone(arabellaUpsert.credentials);
  }

  if (next.name === 'Pull Data') {
    next.parameters.url = `https://graph.facebook.com/v19.0/act_${arabellaAdAccountId}/insights`;
    next.parameters.queryParameters.parameters = [
      {
        name: 'fields',
        value: 'campaign_id,campaign_name,ad_id,ad_name,adset_id,adset_name,impressions,clicks,spend,actions,action_values,date_start,date_stop',
      },
      { name: 'time_increment', value: '1' },
      { name: 'level', value: 'ad' },
      { name: 'time_range[since]', value: '={{ $json.start }}' },
      { name: 'time_range[until]', value: '={{ $json.end }}' },
      { name: 'limit', value: '500' },
      { name: 'filtering', value: '[{"field":"impressions","operator":"GREATER_THAN","value":"0"}]' },
    ];
  }

  if (next.name === 'Array By Day') {
    next.parameters.jsCode = arrayByDayCode();
  }

  if (next.name === 'Fetch Image URLs') {
    next.parameters.url = `=https://graph.facebook.com/v19.0/act_${arabellaAdAccountId}/adimages?hashes[]={{ $json.image_hash }}&fields=hash,url`;
  }

  if (next.name === 'Insert or update rows in a table') {
    next.parameters.table = {
      __rl: true,
      mode: 'name',
      value: 'arabella_meta_ads_creatives',
    };
    next.parameters.columns = {
      mappingMode: 'defineBelow',
      value: upsertColumnMap(),
      matchingColumns: ['ad_id', 'date'],
      schema: upsertSchema(),
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    };
    next.parameters.options = {};
  }

  return next;
});

const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));
const injectVideoUrls = requireNode(nodeByName, 'Inject Video URLs');
const loopOverItems = requireNode(nodeByName, 'Loop Over Items');

workflow.nodes = workflow.nodes.filter((node) => !['Ensure Creative Columns', 'Restore Creative Rows'].includes(node.name));
workflow.nodes.push(
  {
    parameters: {
      operation: 'executeQuery',
      query: alterTableSql(),
      options: {},
    },
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [2912, -160],
    id: 'a0a77fe2-44dd-4be7-a1cb-fd63ca21be7d',
    name: 'Ensure Creative Columns',
    credentials: structuredClone(arabellaUpsert.credentials),
  },
  {
    parameters: {
      jsCode: `return $('Inject Video URLs').all();`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [3136, -160],
    id: '10b97aa8-3afe-4df4-8999-20f1e58280a8',
    name: 'Restore Creative Rows',
  },
);

workflow.connections[injectVideoUrls.name] = {
  main: [[{ node: 'Ensure Creative Columns', type: 'main', index: 0 }]],
};
workflow.connections['Ensure Creative Columns'] = {
  main: [[{ node: 'Restore Creative Rows', type: 'main', index: 0 }]],
};
workflow.connections['Restore Creative Rows'] = {
  main: [[{ node: loopOverItems.name, type: 'main', index: 0 }]],
};

const existing = await findWorkflowByName(targetWorkflowName);
const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: {},
};

let saved;
if (existing) {
  saved = await fetchJson(`${baseUrl}/api/v1/workflows/${existing.id}`, {
    method: 'PUT',
    body,
  });
  console.log(`updated workflow ${existing.id}: ${saved.name}`);
} else {
  saved = await fetchJson(`${baseUrl}/api/v1/workflows`, {
    method: 'POST',
    body,
  });
  console.log(`created workflow ${saved.id}: ${saved.name}`);
}

if (!saved.active) {
  const activated = await fetchJson(`${baseUrl}/api/v1/workflows/${saved.id}/activate`, {
    method: 'POST',
  });
  console.log(`activated workflow ${saved.id}: ${activated.active}`);
}

console.log(`Arabella creative workflow URL: ${baseUrl}/workflow/${saved.id}`);

function requireNode(nodeByName, name) {
  const node = nodeByName.get(name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
}

async function findWorkflowByName(name) {
  let cursor;
  do {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const page = await fetchJson(`${baseUrl}/api/v1/workflows?${qs.toString()}`);
    const match = (page.data ?? []).find((workflow) => workflow.name === name);
    if (match) return match;
    cursor = page.nextCursor;
  } while (cursor);
  return null;
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} failed ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function upsertColumnMap() {
  return {
    date: '={{ $json.date }}',
    ad_id: '={{ $json.ad_id }}',
    ad_name: '={{ $json.ad_name }}',
    adset_id: '={{ $json.adset_id }}',
    adset_name: '={{ $json.adset_name }}',
    campaign_id: '={{ $json.campaign_id }}',
    campaign_name: '={{ $json.campaign_name }}',
    impressions: '={{ $json.impressions }}',
    clicks: '={{ $json.clicks }}',
    cost: '={{ $json.cost }}',
    purchases: '={{ $json.purchases }}',
    revenue: '={{ $json.revenue }}',
    ad_channel: 'Meta',
    preview_url: '={{ $json.preview_url }}',
    leads: '={{ $json.leads }}',
    final_creative_link: '={{ $json.final_creative_link }}',
    primary_text: '={{ $json.primary_text }}',
    headline: '={{ $json.headline }}',
    destination_url: '={{ $json.destination_url }}',
    cta_type: '={{ $json.cta_type }}',
    ad_status: '={{ $json.ad_status }}',
    is_video: '={{ $json.is_video }}',
    video_id: '={{ $json.video_id }}',
    video_url: '={{ $json.video_url }}',
  };
}

function upsertSchema() {
  return [
    schemaCol('id', 'number', true, false, true),
    schemaCol('date', 'dateTime', false, true),
    schemaCol('ad_id', 'string', false, true),
    schemaCol('ad_name', 'string'),
    schemaCol('adset_id', 'string'),
    schemaCol('adset_name', 'string'),
    schemaCol('campaign_id', 'string'),
    schemaCol('campaign_name', 'string'),
    schemaCol('impressions', 'number'),
    schemaCol('clicks', 'number'),
    schemaCol('cost', 'number'),
    schemaCol('purchases', 'number'),
    schemaCol('revenue', 'number'),
    schemaCol('ad_channel', 'string'),
    schemaCol('preview_url', 'string'),
    schemaCol('leads', 'number'),
    schemaCol('final_creative_link', 'string'),
    schemaCol('primary_text', 'string'),
    schemaCol('headline', 'string'),
    schemaCol('destination_url', 'string'),
    schemaCol('cta_type', 'string'),
    schemaCol('ad_status', 'string'),
    schemaCol('is_video', 'boolean'),
    schemaCol('video_id', 'string'),
    schemaCol('video_url', 'string'),
  ];
}

function schemaCol(id, type, defaultMatch = false, canBeUsedToMatch = false, removed = false) {
  return {
    id,
    displayName: id,
    required: false,
    defaultMatch,
    display: true,
    type,
    canBeUsedToMatch,
    removed,
  };
}

function alterTableSql() {
  return `CREATE TABLE IF NOT EXISTS public.arabella_meta_ads_creatives (
  id bigserial PRIMARY KEY,
  date date NOT NULL,
  ad_id text NOT NULL,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  impressions numeric,
  clicks numeric,
  cost numeric,
  purchases numeric,
  revenue numeric,
  ad_channel text,
  preview_url text,
  leads numeric,
  final_creative_link text,
  primary_text text,
  headline text,
  destination_url text,
  cta_type text,
  ad_status text,
  is_video boolean DEFAULT false,
  video_id text,
  video_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_id, date)
);

ALTER TABLE public.arabella_meta_ads_creatives
ADD COLUMN IF NOT EXISTS leads numeric,
ADD COLUMN IF NOT EXISTS final_creative_link text,
ADD COLUMN IF NOT EXISTS primary_text text,
ADD COLUMN IF NOT EXISTS headline text,
ADD COLUMN IF NOT EXISTS destination_url text,
ADD COLUMN IF NOT EXISTS cta_type text,
ADD COLUMN IF NOT EXISTS ad_status text,
ADD COLUMN IF NOT EXISTS is_video boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS video_id text,
ADD COLUMN IF NOT EXISTS video_url text;`;
}

function arrayByDayCode() {
  return `const out = [];

for (const item of items) {
  const rows = item.json.data || [];
  for (const r of rows) {
    const impressions = Number(r.impressions || 0);
    const clicks = Number(r.clicks || 0);
    const spend = Number(r.spend || 0);
    let purchases = 0;
    let revenue = 0;

    const purchaseTypes = [
      'offsite_conversion.fb_pixel_purchase',
      'onsite_conversion.purchase',
      'purchase'
    ];

    if (Array.isArray(r.actions)) {
      for (const type of purchaseTypes) {
        const match = r.actions.find((action) => action.action_type === type);
        if (match) {
          purchases = Number(match.value || 0);
          break;
        }
      }
    }

    if (Array.isArray(r.action_values)) {
      for (const type of purchaseTypes) {
        const match = r.action_values.find((value) => value.action_type === type);
        if (match) {
          revenue = Number(match.value || 0);
          break;
        }
      }
    }

    const date = r.date_start || '';
    const adId = String(r.ad_id || '');
    if (!date || !adId) continue;

    out.push({
      json: {
        id: adId + '_' + date,
        date,
        ad_id: adId,
        ad_name: String(r.ad_name || ''),
        adset_id: String(r.adset_id || ''),
        adset_name: String(r.adset_name || ''),
        campaign_id: String(r.campaign_id || ''),
        campaign_name: String(r.campaign_name || ''),
        impressions,
        clicks,
        spend,
        cost: spend,
        purchases,
        revenue,
        leads: purchases,
        ad_channel: 'Meta',
        preview_url: 'https://www.facebook.com/ads/library/?id=' + adId,
      },
    });
  }
}

return out;`;
}
