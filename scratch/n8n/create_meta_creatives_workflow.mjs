const sourceWorkflowId = 'hq4AP24YUl9oRyam';

const configs = {
  arabella: {
    credentialWorkflowId: 'bLHmg4lfvbmjesVc',
    adAccountId: '859012066875552',
    tableName: 'arabella_meta_ads_creatives',
    workflowName: 'Meta Ads Puller Creatives to Supabase - Arabella ✅',
  },
  kinsey: {
    credentialWorkflowId: 'JowOQLH0aenhf28O',
    adAccountId: '243586875018967',
    tableName: 'kinsey_meta_ads_creatives',
    workflowName: 'Meta Ads Puller Creatives to Supabase - Kinsey Design ✅',
  },
};

const clientKey = process.argv[2];
const config = configs[clientKey];
const baseUrl = process.env.EIC_N8N_BASE_URL;
const apiKey = process.env.EIC_N8N_API_TOKEN;

if (!config) {
  throw new Error(`Usage: node scratch/n8n/create_meta_creatives_workflow.mjs <${Object.keys(configs).join('|')}>`);
}
if (!baseUrl || !apiKey) {
  throw new Error('Missing EIC_N8N_BASE_URL or EIC_N8N_API_TOKEN');
}

const [sourceWorkflow, credentialWorkflow] = await Promise.all([
  fetchJson(`${baseUrl}/api/v1/workflows/${sourceWorkflowId}`),
  fetchJson(`${baseUrl}/api/v1/workflows/${config.credentialWorkflowId}`),
]);

const credentialNodes = new Map(credentialWorkflow.nodes.map((node) => [node.name, node]));
const credentialPullData = requireNode(credentialNodes, 'Pull Data');
const credentialUpsert = requireNode(credentialNodes, 'Insert or update rows in a table');

const workflow = structuredClone(sourceWorkflow);
workflow.name = config.workflowName;

const nodesByName = new Map(workflow.nodes.map((node) => [node.name, node]));
const scheduleTrigger = requireNode(nodesByName, 'Schedule Trigger');
const formatDate = requireNode(nodesByName, 'Format Date');
const pullData = requireNode(nodesByName, 'Pull Data');
const arrayByDay = requireNode(nodesByName, 'Array By Day');
const upsertNode = requireNode(nodesByName, 'Insert or update rows in a table');
const waitNode = requireNode(nodesByName, 'Wait');
const loopNode = requireNode(nodesByName, 'Loop Over Items');

pullData.credentials = structuredClone(credentialPullData.credentials);
pullData.parameters.url = `https://graph.facebook.com/v19.0/act_${config.adAccountId}/insights`;
pullData.parameters.queryParameters.parameters = [
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
arrayByDay.parameters.jsCode = arrayByDayCode();

upsertNode.credentials = structuredClone(credentialUpsert.credentials);
upsertNode.parameters.table = {
  __rl: true,
  mode: 'name',
  value: config.tableName,
};
upsertNode.parameters.columns = {
  mappingMode: 'defineBelow',
  value: upsertColumnMap(),
  matchingColumns: ['ad_id', 'date'],
  schema: upsertSchema(),
  attemptToConvertTypes: false,
  convertFieldsToString: false,
};
upsertNode.parameters.options = {};

const ensureColumnsNode = {
  parameters: {
    operation: 'executeQuery',
    query: tableSql(config.tableName),
    options: {},
  },
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [2720, 0],
  id: 'a0a77fe2-44dd-4be7-a1cb-fd63ca21be7d',
  name: 'Ensure Creative Columns',
  credentials: structuredClone(credentialUpsert.credentials),
};

const restoreRowsNode = {
  parameters: {
    jsCode: `return $('Merge Creative Data').all();`,
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2912, 0],
  id: '10b97aa8-3afe-4df4-8999-20f1e58280a8',
  name: 'Restore Creative Rows',
};

const uniqueAdsNode = {
  parameters: {
    jsCode: `const seen = new Set();
const out = [];

for (const item of items) {
  const adId = String(item.json.ad_id || '');
  if (!adId || seen.has(adId)) continue;
  seen.add(adId);
  out.push({ json: { ad_id: adId } });
}

return out;`,
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [896, 80],
  id: '7ebb8bc6-c2bf-4a29-a693-88d4da69e4ea',
  name: 'Get Unique Ad IDs',
};

const pullCreativeNode = {
  parameters: {
    url: '=https://graph.facebook.com/v19.0/{{ $json.ad_id }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    queryParameters: {
      parameters: [
        {
          name: 'fields',
          value: 'id,status,creative{id,image_hash,image_url,thumbnail_url,object_story_spec,asset_feed_spec,body,title,link_url,call_to_action_type,object_story_id,effective_object_story_id,effective_instagram_story_id}',
        },
      ],
    },
    options: {
      batching: {
        batch: {
          batchSize: 100,
          batchInterval: 5000,
        },
      },
      response: {
        response: {
          neverError: true,
        },
      },
    },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1088, 80],
  id: '76674b08-a503-470c-b8dc-eae01f4927f6',
  name: 'Pull Creative Data',
  credentials: structuredClone(credentialPullData.credentials),
};

const prepCreativePayloadNode = {
  parameters: {
    jsCode: prepCreativePayloadCode(),
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1280, 80],
  id: '04f6a115-9d14-426c-a2e4-f1bcdfe5e42a',
  name: 'Prep Creative Payload',
};

const fetchHighResImagesNode = {
  parameters: {
    url: `https://graph.facebook.com/v19.0/act_${config.adAccountId}/adimages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    queryParameters: {
      parameters: [
        { name: 'fields', value: 'hash,permalink_url,url,original_width,original_height' },
        { name: 'hashes', value: '={{ JSON.stringify($json.image_hash ? [$json.image_hash] : []) }}' },
      ],
    },
    options: {
      batching: {
        batch: {
          batchSize: 20,
          batchInterval: 2000,
        },
      },
      response: {
        response: {
          neverError: true,
        },
      },
    },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1472, 80],
  id: '171f3780-f5dc-488f-9499-c64bc9f6e25c',
  name: 'Fetch High Res Images',
  credentials: structuredClone(credentialPullData.credentials),
};

const prepVideoLookupsNode = lookupPrepNode(
  'Prep Video Lookups',
  'video_id',
  [1664, -120],
  '663053f1-b445-403b-af3f-14c92c0d4d33'
);

const fetchVideoSourcesNode = {
  parameters: {
    url: '=https://graph.facebook.com/v19.0/{{ $json.video_id || "0" }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    queryParameters: {
      parameters: [{ name: 'fields', value: 'id,source' }],
    },
    options: {
      batching: {
        batch: {
          batchSize: 20,
          batchInterval: 2000,
        },
      },
      response: {
        response: {
          neverError: true,
        },
      },
    },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1856, -120],
  id: '796208e1-e5b7-4fc2-bbf7-0af22f18fd1f',
  name: 'Fetch Video Sources',
  credentials: structuredClone(credentialPullData.credentials),
};

const prepPageLookupsNode = lookupPrepNode(
  'Prep Page Lookups',
  'page_id',
  [1664, 80],
  'd0f14e3d-482d-4bd1-ac1d-c91500ac8182'
);

const fetchPageDataNode = {
  parameters: {
    url: '=https://graph.facebook.com/v19.0/{{ $json.page_id || "0" }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    queryParameters: {
      parameters: [{ name: 'fields', value: 'id,name,picture{url}' }],
    },
    options: {
      batching: {
        batch: {
          batchSize: 20,
          batchInterval: 2000,
        },
      },
      response: {
        response: {
          neverError: true,
        },
      },
    },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1856, 80],
  id: 'd6618338-0c50-4ce2-a9f2-1eaf0fcd4028',
  name: 'Fetch Page Data',
  credentials: structuredClone(credentialPullData.credentials),
};

const prepStoryLookupsNode = lookupPrepNode(
  'Prep Story Lookups',
  'story_id',
  [1664, 280],
  '3de2dfb9-9fcc-476b-8d3e-e54d0972642f'
);

const fetchStoryDataNode = {
  parameters: {
    url: '=https://graph.facebook.com/v19.0/{{ $json.story_id || "0" }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    queryParameters: {
      parameters: [
        {
          name: 'fields',
          value: 'id,permalink_url,attachments{media_type,type,url,unshimmed_url,target,media,subattachments}',
        },
      ],
    },
    options: {
      batching: {
        batch: {
          batchSize: 20,
          batchInterval: 2000,
        },
      },
      response: {
        response: {
          neverError: true,
        },
      },
    },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1856, 280],
  id: '21e23f88-7113-4915-8a4c-9a82422655bc',
  name: 'Fetch Story Data',
  credentials: structuredClone(credentialPullData.credentials),
};

const mergeCreativeDataNode = {
  parameters: {
    jsCode: mergeCreativeDataCode(),
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2528, 80],
  id: 'f65113b2-6753-418a-bc0c-3716c8174db1',
  name: 'Merge Creative Data',
};

workflow.nodes = workflow.nodes.filter((node) => ![
  'Ensure Creative Columns',
  'Restore Creative Rows',
  'Get Unique Ad IDs',
  'Pull Data1',
  'Code in JavaScript',
  'Prep Image Hash Lookups',
  'Fetch Image URLs',
  'Inject Image URLs',
  'Prep Video Lookups',
  'Fetch Video Sources',
  'Inject Video URLs',
  'Pull Creative Data',
  'Prep Creative Payload',
  'Fetch High Res Images',
  'Prep Page Lookups',
  'Fetch Page Data',
  'Prep Story Lookups',
  'Fetch Story Data',
  'Merge Creative Data',
].includes(node.name));

workflow.nodes.push(
  ensureColumnsNode,
  restoreRowsNode,
  uniqueAdsNode,
  pullCreativeNode,
  prepCreativePayloadNode,
  fetchHighResImagesNode,
  prepVideoLookupsNode,
  fetchVideoSourcesNode,
  prepPageLookupsNode,
  fetchPageDataNode,
  prepStoryLookupsNode,
  fetchStoryDataNode,
  mergeCreativeDataNode,
);

workflow.connections = {
  [scheduleTrigger.name]: {
    main: [[{ node: formatDate.name, type: 'main', index: 0 }]],
  },
  [formatDate.name]: {
    main: [[{ node: pullData.name, type: 'main', index: 0 }]],
  },
  [pullData.name]: {
    main: [[{ node: arrayByDay.name, type: 'main', index: 0 }]],
  },
  [arrayByDay.name]: {
    main: [[{ node: uniqueAdsNode.name, type: 'main', index: 0 }]],
  },
  [uniqueAdsNode.name]: {
    main: [[{ node: pullCreativeNode.name, type: 'main', index: 0 }]],
  },
  [pullCreativeNode.name]: {
    main: [[{ node: prepCreativePayloadNode.name, type: 'main', index: 0 }]],
  },
  [prepCreativePayloadNode.name]: {
    main: [[
      { node: fetchHighResImagesNode.name, type: 'main', index: 0 },
      { node: prepVideoLookupsNode.name, type: 'main', index: 0 },
      { node: prepPageLookupsNode.name, type: 'main', index: 0 },
      { node: prepStoryLookupsNode.name, type: 'main', index: 0 },
    ]],
  },
  [fetchHighResImagesNode.name]: {
    main: [[{ node: mergeCreativeDataNode.name, type: 'main', index: 0 }]],
  },
  [prepVideoLookupsNode.name]: {
    main: [[{ node: fetchVideoSourcesNode.name, type: 'main', index: 0 }]],
  },
  [fetchVideoSourcesNode.name]: {
    main: [[{ node: mergeCreativeDataNode.name, type: 'main', index: 0 }]],
  },
  [prepPageLookupsNode.name]: {
    main: [[{ node: fetchPageDataNode.name, type: 'main', index: 0 }]],
  },
  [fetchPageDataNode.name]: {
    main: [[{ node: mergeCreativeDataNode.name, type: 'main', index: 0 }]],
  },
  [prepStoryLookupsNode.name]: {
    main: [[{ node: fetchStoryDataNode.name, type: 'main', index: 0 }]],
  },
  [fetchStoryDataNode.name]: {
    main: [[{ node: mergeCreativeDataNode.name, type: 'main', index: 0 }]],
  },
  [mergeCreativeDataNode.name]: {
    main: [[{ node: ensureColumnsNode.name, type: 'main', index: 0 }]],
  },
  [ensureColumnsNode.name]: {
    main: [[{ node: restoreRowsNode.name, type: 'main', index: 0 }]],
  },
  [restoreRowsNode.name]: {
    main: [[{ node: loopNode.name, type: 'main', index: 0 }]],
  },
  [loopNode.name]: {
    main: [
      [],
      [{ node: upsertNode.name, type: 'main', index: 0 }],
    ],
  },
  [upsertNode.name]: {
    main: [[{ node: waitNode.name, type: 'main', index: 0 }]],
  },
  [waitNode.name]: {
    main: [[{ node: loopNode.name, type: 'main', index: 0 }]],
  },
};

const existing = await findWorkflowByName(config.workflowName);
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

console.log(`${clientKey} creative workflow URL: ${baseUrl}/workflow/${saved.id}`);

function lookupPrepNode(name, key, position, id) {
  return {
    parameters: {
      jsCode: `const seen = new Set();
const out = [];

for (const item of $('Prep Creative Payload').all()) {
  const value = String(item.json.${key} || '');
  if (!value || seen.has(value)) continue;
  seen.add(value);
  out.push({ json: { ${key}: value } });
}

if (out.length === 0) {
  out.push({ json: { ${key}: '0', skip_lookup: true } });
}

return out;`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    id,
    name,
  };
}

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

function upsertColumnMap() {
  return {
    ad_id: '={{ $json.ad_id }}',
    date: '={{ $json.date }}',
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
    leads: '={{ $json.leads }}',
    ad_channel: '={{ $json.ad_channel }}',
    preview_url: '={{ $json.preview_url }}',
    final_creative_link: '={{ $json.final_creative_link }}',
    primary_text: '={{ $json.primary_text }}',
    headline: '={{ $json.headline }}',
    destination_url: '={{ $json.destination_url }}',
    cta_type: '={{ $json.cta_type }}',
    ad_status: '={{ $json.ad_status }}',
    image_hash: '={{ $json.image_hash }}',
    page_id: '={{ $json.page_id }}',
    page_name: '={{ $json.page_name }}',
    page_profile_image_url: '={{ $json.page_profile_image_url }}',
    is_video: '={{ $json.is_video }}',
    video_id: '={{ $json.video_id }}',
    video_url: '={{ $json.video_url }}',
    created_at: '={{ $now.toISO() }}',
  };
}

function upsertSchema() {
  return [
    schemaCol('id', 'number', true, false, true),
    schemaCol('ad_id', 'string', false, true),
    schemaCol('date', 'dateTime', false, true),
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
    schemaCol('leads', 'number'),
    schemaCol('ad_channel', 'string'),
    schemaCol('preview_url', 'string'),
    schemaCol('final_creative_link', 'string'),
    schemaCol('primary_text', 'string'),
    schemaCol('headline', 'string'),
    schemaCol('destination_url', 'string'),
    schemaCol('cta_type', 'string'),
    schemaCol('ad_status', 'string'),
    schemaCol('image_hash', 'string'),
    schemaCol('page_id', 'string'),
    schemaCol('page_name', 'string'),
    schemaCol('page_profile_image_url', 'string'),
    schemaCol('is_video', 'boolean'),
    schemaCol('video_id', 'string'),
    schemaCol('video_url', 'string'),
    schemaCol('created_at', 'dateTime'),
  ];
}

function tableSql(tableName) {
  return `CREATE TABLE IF NOT EXISTS public.${tableName} (
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
  leads numeric,
  ad_channel text,
  preview_url text,
  final_creative_link text,
  primary_text text,
  headline text,
  destination_url text,
  cta_type text,
  ad_status text,
  image_hash text,
  page_id text,
  page_name text,
  page_profile_image_url text,
  is_video boolean DEFAULT false,
  video_id text,
  video_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_id, date)
);

ALTER TABLE public.${tableName}
ADD COLUMN IF NOT EXISTS leads numeric,
ADD COLUMN IF NOT EXISTS final_creative_link text,
ADD COLUMN IF NOT EXISTS primary_text text,
ADD COLUMN IF NOT EXISTS headline text,
ADD COLUMN IF NOT EXISTS destination_url text,
ADD COLUMN IF NOT EXISTS cta_type text,
ADD COLUMN IF NOT EXISTS ad_status text,
ADD COLUMN IF NOT EXISTS image_hash text,
ADD COLUMN IF NOT EXISTS page_id text,
ADD COLUMN IF NOT EXISTS page_name text,
ADD COLUMN IF NOT EXISTS page_profile_image_url text,
ADD COLUMN IF NOT EXISTS is_video boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS video_id text,
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS created_at timestamptz;`;
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

function prepCreativePayloadCode() {
  return `const out = [];

for (const item of items) {
  const creativeData = item.json || {};
  const adId = String(creativeData.id || '');
  const creative = creativeData.creative || {};
  const story = creative.object_story_spec || {};
  const assetFeed = creative.asset_feed_spec || {};
  const linkData = story.link_data || {};
  const videoData = story.video_data || {};
  const assetImage = Array.isArray(assetFeed.images) ? assetFeed.images[0] || {} : {};
  const storyId = creative.effective_object_story_id || creative.object_story_id || creative.effective_instagram_story_id || null;

  const imageCandidates = [
    creative.image_url,
    linkData.picture,
    videoData.image_url,
    assetImage.url,
    creative.thumbnail_url,
  ].filter(Boolean);

  let primaryText = null;
  let headline = null;
  let destinationUrl = null;

  if (linkData && Object.keys(linkData).length > 0) {
    primaryText = linkData.message || null;
    headline = linkData.name || linkData.title || null;
    destinationUrl = linkData.link || null;
  } else if (videoData && Object.keys(videoData).length > 0) {
    primaryText = videoData.message || null;
    headline = videoData.title || null;
    if (videoData.call_to_action && videoData.call_to_action.value) {
      destinationUrl = videoData.call_to_action.value.link || null;
    }
  } else if (assetFeed && Object.keys(assetFeed).length > 0) {
    primaryText = assetFeed.bodies?.[0]?.text || null;
    headline = assetFeed.titles?.[0]?.text || null;
    destinationUrl = assetFeed.link_urls?.[0]?.website_url || null;
  }

  if (!primaryText && creative.body) primaryText = creative.body;
  if (!headline && creative.title) headline = creative.title;
  if (!destinationUrl && creative.link_url) destinationUrl = creative.link_url;

  out.push({
    json: {
      ad_id: adId,
      ad_status: creativeData.status || null,
      image_hash: creative.image_hash || assetImage.hash || null,
      fallback_images: imageCandidates,
      primary_text: primaryText,
      headline,
      destination_url: destinationUrl,
      cta_type: creative.call_to_action_type || null,
      page_id: story.page_id ? String(story.page_id) : null,
      story_id: storyId ? String(storyId) : null,
      page_name: null,
      page_profile_image_url: null,
      is_video: Boolean(videoData && Object.keys(videoData).length > 0),
      video_id: videoData.video_id ? String(videoData.video_id) : null,
      video_url: null
    }
  });
}

return out;`;
}

function mergeCreativeDataCode() {
  return `const performanceItems = $('Array By Day').all();
const creativePayloadItems = $('Prep Creative Payload').all();
const imageLookupItems = $('Fetch High Res Images').all();
const videoLookupItems = $('Fetch Video Sources').all();
const pageLookupItems = $('Fetch Page Data').all();
const storyLookupItems = $('Fetch Story Data').all();

const creativeMap = new Map();
const videoUrlMap = new Map();
const pageMap = new Map();
const storyMap = new Map();

function normalizeImageUrl(url) {
  if (!url || url === 'null' || url === 'undefined') return null;
  let current = String(url);
  for (let i = 0; i < 2; i += 1) {
    try {
      const parsed = new URL(current);
      const nested = parsed.searchParams.get('url');
      if (!nested) break;
      current = decodeURIComponent(nested);
    } catch {
      break;
    }
  }
  return current;
}

function isThumbnailLike(url) {
  return /p64x64|_p64x64|s64x64|64x64|p100x100|s100x100|_q75/i.test(url || '');
}

function imageScore(url) {
  if (!url) return -1;
  const normalized = normalizeImageUrl(url) || '';
  let score = 0;
  if (/facebook\\.com\\/ads\\/image/i.test(normalized)) score += 100;
  if (/\\/t45\\.1600-4\\//i.test(normalized)) score += 90;
  if (/scontent|fbcdn/i.test(normalized)) score += 40;
  if (!isThumbnailLike(normalized)) score += 30;
  if (/permalink/i.test(normalized)) score += 10;
  return score;
}

function pickBestImage(candidates) {
  const normalized = candidates
    .map(normalizeImageUrl)
    .filter(Boolean);
  if (normalized.length === 0) return null;
  return normalized.sort((a, b) => imageScore(b) - imageScore(a))[0] || null;
}

for (const item of videoLookupItems) {
  const row = item.json || {};
  const videoId = String(row.id || row.video_id || '');
  const videoUrl = row.source || null;
  if (videoId && videoUrl) videoUrlMap.set(videoId, videoUrl);
}

for (const item of pageLookupItems) {
  const row = item.json || {};
  const pageId = String(row.id || row.page_id || '');
  if (!pageId) continue;
  pageMap.set(pageId, {
    page_name: row.name || null,
    page_profile_image_url: row.picture?.data?.url || null,
  });
}

for (const item of storyLookupItems) {
  const row = item.json || {};
  const storyId = String(row.id || row.story_id || '');
  if (!storyId) continue;
  const attachments = Array.isArray(row.attachments?.data) ? row.attachments.data : [];
  const attachmentPool = [];
  for (const attachment of attachments) {
    attachmentPool.push(attachment);
    const subattachments = Array.isArray(attachment.subattachments?.data) ? attachment.subattachments.data : [];
    attachmentPool.push(...subattachments);
  }

  const imageCandidates = [];
  let storyVideoUrl = null;

  for (const attachment of attachmentPool) {
    const media = attachment.media || {};
    if (!storyVideoUrl && media.source) storyVideoUrl = String(media.source);
    imageCandidates.push(
      media.image?.src,
      media.picture,
      attachment.url,
      attachment.unshimmed_url,
      attachment.target?.url
    );
  }

  storyMap.set(storyId, {
    story_video_url: storyVideoUrl,
    story_fallback_image: pickBestImage(imageCandidates),
    story_permalink_url: row.permalink_url || null,
  });
}

const imageMap = new Map();
for (const item of imageLookupItems) {
  const rows = Array.isArray(item.json?.data) ? item.json.data : [];
  for (const row of rows) {
    if (!row.hash) continue;
    imageMap.set(String(row.hash), pickBestImage([row.permalink_url, row.url]));
  }
}

for (const creativeItem of creativePayloadItems) {
  const creative = creativeItem.json || {};
  const pageInfo = pageMap.get(String(creative.page_id || '')) || {};
  const storyInfo = storyMap.get(String(creative.story_id || '')) || {};
  const highResImage = creative.image_hash ? imageMap.get(String(creative.image_hash)) : null;
  const fallbackImages = Array.isArray(creative.fallback_images) ? creative.fallback_images : [creative.fallback_image];

  creativeMap.set(String(creative.ad_id || ''), {
    final_creative_link: pickBestImage([
      highResImage,
      storyInfo.story_fallback_image,
      ...fallbackImages,
    ]),
    primary_text: creative.primary_text || null,
    headline: creative.headline || null,
    destination_url: creative.destination_url || null,
    cta_type: creative.cta_type || null,
    ad_status: creative.ad_status || null,
    image_hash: creative.image_hash || null,
    page_id: creative.page_id || null,
    page_name: pageInfo.page_name || creative.page_name || null,
    page_profile_image_url: pageInfo.page_profile_image_url || creative.page_profile_image_url || null,
    is_video: Boolean(creative.is_video || storyInfo.story_video_url),
    video_id: creative.video_id || null,
    video_url: videoUrlMap.get(String(creative.video_id || '')) || storyInfo.story_video_url || creative.video_url || null
  });
}

return performanceItems.map((item) => {
  const perf = item.json;
  const creative = creativeMap.get(String(perf.ad_id || '')) || {
    final_creative_link: null,
    primary_text: null,
    headline: null,
    destination_url: null,
    cta_type: null,
    ad_status: null,
    image_hash: null,
    page_id: null,
    page_name: null,
    page_profile_image_url: null,
    is_video: false,
    video_id: null,
    video_url: null
  };

  return {
    json: {
      ...perf,
      ...creative
    }
  };
});`;
}
