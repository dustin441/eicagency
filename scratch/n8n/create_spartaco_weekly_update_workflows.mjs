import fs from 'node:fs';

const baseUrl = process.env.EIC_N8N_BASE_URL;
const apiKey = process.env.EIC_N8N_API_TOKEN || process.env.N8N_API_KEY;

const clickupTemplateId = 'kMwaWo7iO0628uLx';
const weeklyTemplateId = 'pJtUvLfLSl3Nt8w6';
const clickupWorkflowName = 'Spartaco ClickUp Sync';
const weeklyWorkflowName = 'Spartaco Weekly Readout Generator';
const spartacoListId = '901407399216';
const ddl = fs.readFileSync('scratch/spartaco/spartaco_weekly_update_tables.sql', 'utf8');

if (!baseUrl || !apiKey) {
  throw new Error('Missing EIC_N8N_BASE_URL and EIC_N8N_API_TOKEN/N8N_API_KEY');
}

const [clickupTemplate, weeklyTemplate] = await Promise.all([
  fetchJson(`${baseUrl}/api/v1/workflows/${clickupTemplateId}`),
  fetchJson(`${baseUrl}/api/v1/workflows/${weeklyTemplateId}`),
]);

const clickupWorkflow = buildClickupWorkflow(clickupTemplate);
const weeklyWorkflow = buildWeeklyWorkflow(weeklyTemplate);

const savedClickup = await upsertWorkflow(clickupWorkflowName, clickupWorkflow);
const savedWeekly = await upsertWorkflow(weeklyWorkflowName, weeklyWorkflow);

console.log(`Spartaco ClickUp Sync URL: ${baseUrl}/workflow/${savedClickup.id}`);
console.log(`Spartaco Weekly Readout Generator URL: ${baseUrl}/workflow/${savedWeekly.id}`);

function buildClickupWorkflow(template) {
  const workflow = structuredClone(template);
  workflow.name = clickupWorkflowName;

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));
  const schedule = requireNode(nodeByName, 'Run Daily at 3am');
  const getAllTasks = requireNode(nodeByName, 'Get All Tasks');
  const merge = requireNode(nodeByName, 'Merge Name + Comments');
  const formatTaskSql = requireNode(nodeByName, 'Format Task SQL');
  const formatCommentSql = requireNode(nodeByName, 'Format Comment SQL');
  const upsertTasks = requireNode(nodeByName, 'Upsert Tasks');

  getAllTasks.parameters.url = `https://api.clickup.com/api/v2/list/${spartacoListId}/task`;
  merge.parameters.jsCode = clickupMergeCode();
  formatTaskSql.parameters.jsCode = clickupTaskSqlCode();
  formatCommentSql.parameters.jsCode = clickupCommentSqlCode();

  const ensureTables = {
    id: 'spartaco-weekly-ensure-tables',
    name: 'Ensure Spartaco Weekly Tables',
    type: 'n8n-nodes-base.postgres',
    typeVersion: upsertTasks.typeVersion ?? 2.6,
    position: [120, -120],
    parameters: {
      operation: 'executeQuery',
      query: ddl,
      options: {},
    },
    credentials: structuredClone(upsertTasks.credentials),
  };

  const manualTrigger = {
    id: 'spartaco-clickup-manual-trigger',
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [-112, -120],
    parameters: {},
  };

  workflow.nodes = workflow.nodes
    .filter((node) => !['Ensure Spartaco Weekly Tables', 'Manual Trigger'].includes(node.name))
    .concat([ensureTables, manualTrigger]);

  workflow.connections[schedule.name] = {
    main: [[{ node: ensureTables.name, type: 'main', index: 0 }]],
  };
  workflow.connections[manualTrigger.name] = {
    main: [[{ node: ensureTables.name, type: 'main', index: 0 }]],
  };
  workflow.connections[ensureTables.name] = {
    main: [[{ node: getAllTasks.name, type: 'main', index: 0 }]],
  };

  return workflow;
}

function buildWeeklyWorkflow(template) {
  const workflow = structuredClone(template);
  workflow.name = weeklyWorkflowName;

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));
  const schedule = requireNode(nodeByName, 'Weekly Schedule (Mon 9 AM UTC)');
  const manual = requireNode(nodeByName, 'Manual Trigger');
  const setDateRanges = requireNode(nodeByName, 'Set Date Ranges');
  const getPerformance = requireNode(nodeByName, 'Get Weekly Performance');
  const getComments = requireNode(nodeByName, 'Get Weekly Comments');
  const getTasks = requireNode(nodeByName, 'Get All Tasks');
  const prepareWeeklyData = requireNode(nodeByName, 'Prepare Weekly Data');
  const agent = requireNode(nodeByName, 'Weekly Readout Generator');
  const schema = requireNode(nodeByName, 'Weekly Readout Schema');
  const formatSaveData = requireNode(nodeByName, 'Format Save Data');
  const saveReadout = requireNode(nodeByName, 'Save Weekly Readout');

  setDateRanges.parameters.jsCode = weeklyDateCode();
  getPerformance.parameters.query = weeklyPerformanceQuery();
  getPerformance.parameters.options = {
    queryReplacement: '={{ $json.current_start }},{{ $json.current_end }},{{ $json.previous_start }},{{ $json.previous_end }}',
  };
  getComments.parameters.query = "SELECT clickup_comment_id AS comment_id, clickup_task_id AS task_id, comment_text, posted_at::text AS comment_date, commenter AS user_name, business_focus FROM spartaco_clickup_comments WHERE posted_at >= $1::date AND posted_at < ($2::date + interval '1 day') ORDER BY posted_at ASC LIMIT 300";
  getComments.parameters.options = {
    queryReplacement: '={{ $json.comments_start }},{{ $json.comments_end }}',
  };
  getTasks.parameters.query = 'SELECT clickup_task_id AS task_id, name AS task_name, business_focus FROM spartaco_clickup_tasks';
  getTasks.parameters.options = {};
  prepareWeeklyData.parameters.jsCode = weeklyPrepareCode();
  agent.parameters.options = {
    systemMessage: weeklySystemMessage(),
  };
  schema.parameters.jsonSchemaExample = JSON.stringify({
    overall_story: 'Spartaco saw mixed performance across Jameson, Huskie, and Ronin, with clear opportunities to shift budget and creative testing toward the strongest lead or purchase pockets.',
    focus_insights: {
      jameson: {
        wins: ['Jameson generated the strongest purchase volume during the period.'],
        opportunities: ['Separate sale-focused performance from lead-gen CPL before scaling.'],
        next_steps: ['Audit active Jameson sale campaigns and isolate budget for the best converting campaign.'],
      },
      huskie: {
        wins: ['Huskie maintained efficient traffic quality on its strongest channel.'],
        opportunities: ['Refresh low-converting creative angles before increasing spend.'],
        next_steps: ['Review campaign-level CPL and move budget toward the best ad channel.'],
      },
      ronin: {
        wins: ['Ronin maintained baseline activity during the period.'],
        opportunities: ['Conversion volume was limited, so creative and audience tests should stay controlled.'],
        next_steps: ['Launch one focused test tied to the best-performing campaign theme.'],
      },
    },
    wins: ['Overall click volume improved in the strongest brand/channel combination.'],
    opportunities: ['Most budget pacing comments were general, so brand-specific optimization tagging should improve next week.'],
    accomplishments: ['Reviewed weekly budget pacing and optimization comments.'],
    focus_next_week: ['Tag new optimization notes by Jameson, Huskie, or Ronin when possible.'],
    execution_context: ['ClickUp comments are mostly stored in a general budget pacing task.'],
  });
  formatSaveData.parameters.jsCode = weeklyFormatSaveCode();

  const ensureTables = {
    id: 'spartaco-weekly-readout-ensure-tables',
    name: 'Ensure Spartaco Weekly Tables',
    type: 'n8n-nodes-base.postgres',
    typeVersion: saveReadout.typeVersion ?? 2.6,
    position: [112, -120],
    parameters: {
      operation: 'executeQuery',
      query: ddl,
      options: {},
    },
    credentials: structuredClone(saveReadout.credentials),
  };

  workflow.nodes = workflow.nodes
    .filter((node) => node.name !== 'Ensure Spartaco Weekly Tables')
    .concat([ensureTables]);

  workflow.connections[schedule.name] = {
    main: [[{ node: ensureTables.name, type: 'main', index: 0 }]],
  };
  workflow.connections[manual.name] = {
    main: [[{ node: ensureTables.name, type: 'main', index: 0 }]],
  };
  workflow.connections[ensureTables.name] = {
    main: [[{ node: setDateRanges.name, type: 'main', index: 0 }]],
  };

  return workflow;
}

async function upsertWorkflow(name, workflow) {
  const existing = await findWorkflowByName(name);
  const body = {
    name,
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
    console.log(`updated workflow ${saved.id}: ${saved.name}`);
  } else {
    saved = await fetchJson(`${baseUrl}/api/v1/workflows`, {
      method: 'POST',
      body,
    });
    console.log(`created workflow ${saved.id}: ${saved.name}`);
  }

  if (!saved.active) {
    saved = await fetchJson(`${baseUrl}/api/v1/workflows/${saved.id}/activate`, {
      method: 'POST',
    });
    console.log(`activated workflow ${saved.id}: ${saved.active}`);
  }

  return saved;
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

function clickupMergeCode() {
  return `const tasks = $('Loop (Batch 10)').all().map(i => i.json);
return items.map((item, index) => {
  const task = tasks[index] || {};
  return {
    json: {
      task_id: task.id,
      task_name: task.name,
      status: task.status?.status || task.status || null,
      url: task.url || null,
      assignees: task.assignees || [],
      tags: task.tags || [],
      due_at: task.due_date ? new Date(Number(task.due_date)).toISOString() : null,
      created_at: task.date_created ? new Date(Number(task.date_created)).toISOString() : null,
      updated_at: task.date_updated ? new Date(Number(task.date_updated)).toISOString() : null,
      is_empty: Boolean(task._empty),
      raw_payload: task,
      comments: item.json.comments || []
    }
  };
});`;
}

function focusInferenceHelperCode() {
  return `function inferFocus(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const matches = [];
  if (text.includes('jameson')) matches.push('jameson');
  if (text.includes('huskie') || text.includes('huskie tools')) matches.push('huskie');
  if (text.includes('ronin')) matches.push('ronin');
  return matches.length === 1 ? matches[0] : 'general';
}
function pgEscape(value) {
  return String(value ?? '').replace(/'/g, "''");
}
function pgNullable(value) {
  return value ? "'" + pgEscape(value) + "'" : 'NULL';
}
function pgJson(value) {
  return "'" + pgEscape(JSON.stringify(value ?? null)) + "'::jsonb";
}`;
}

function clickupTaskSqlCode() {
  return `${focusInferenceHelperCode()}
const rows = $input.all().filter(i => !i.json.is_empty);
if (rows.length === 0) return [{ json: { query: 'SELECT 1' } }];
const values = rows.map(({ json }) => {
  const focus = inferFocus(json.task_name);
  return "(" +
    pgNullable(json.task_id) + ", " +
    "'${spartacoListId}', " +
    pgNullable(json.task_name) + ", " +
    pgNullable(json.status) + ", " +
    pgNullable(json.url) + ", " +
    pgJson(json.assignees || []) + ", " +
    pgJson(json.tags || []) + ", " +
    pgNullable(focus) + ", " +
    pgNullable(json.due_at) + "::timestamptz, " +
    pgNullable(json.created_at) + "::timestamptz, " +
    pgNullable(json.updated_at) + "::timestamptz, " +
    "timezone('utc'::text, now()), " +
    pgJson(json.raw_payload || {}) +
  ")";
}).join(', ');
const query = "INSERT INTO public.spartaco_clickup_tasks (clickup_task_id, list_id, name, status, url, assignees, tags, business_focus, due_at, created_at, updated_at, synced_at, raw_payload) VALUES " + values +
  " ON CONFLICT (clickup_task_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, url = EXCLUDED.url, assignees = EXCLUDED.assignees, tags = EXCLUDED.tags, business_focus = EXCLUDED.business_focus, due_at = EXCLUDED.due_at, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, synced_at = EXCLUDED.synced_at, raw_payload = EXCLUDED.raw_payload";
return [{ json: { query } }];`;
}

function clickupCommentSqlCode() {
  return `${focusInferenceHelperCode()}
const batchItems = $('Merge Name + Comments').all();
const commentRows = [];
for (const item of batchItems) {
  const json = item.json;
  if (json.is_empty) continue;
  for (const c of (json.comments || [])) {
    const commentText = String(c.comment_text || '');
    commentRows.push({
      comment_id: String(c.id || ''),
      task_id: String(json.task_id || ''),
      task_name: String(json.task_name || ''),
      commenter: c.user ? String(c.user.username || c.user.email || 'Unknown') : 'Unknown',
      comment_text: commentText,
      business_focus: inferFocus(commentText, json.task_name),
      posted_at: c.date ? new Date(parseInt(String(c.date), 10)).toISOString() : null,
      raw_payload: c
    });
  }
}
if (commentRows.length === 0) return [{ json: { query: 'SELECT 1' } }];
const values = commentRows.map((row) => "(" +
  pgNullable(row.comment_id) + ", " +
  pgNullable(row.task_id) + ", " +
  "'${spartacoListId}', " +
  pgNullable(row.comment_text) + ", " +
  pgNullable(row.commenter) + ", " +
  pgNullable(row.business_focus) + ", " +
  pgNullable(row.posted_at) + "::timestamptz, " +
  "timezone('utc'::text, now()), " +
  pgJson(row.raw_payload || {}) +
")").join(', ');
const query = "INSERT INTO public.spartaco_clickup_comments (clickup_comment_id, clickup_task_id, list_id, comment_text, commenter, business_focus, posted_at, synced_at, raw_payload) VALUES " + values +
  " ON CONFLICT (clickup_comment_id) DO UPDATE SET clickup_task_id = EXCLUDED.clickup_task_id, comment_text = EXCLUDED.comment_text, commenter = EXCLUDED.commenter, business_focus = EXCLUDED.business_focus, posted_at = EXCLUDED.posted_at, synced_at = EXCLUDED.synced_at, raw_payload = EXCLUDED.raw_payload";
return [{ json: { query } }];`;
}

function weeklyDateCode() {
  return `const now = new Date();
function utcDate(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
function addDays(d, n) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; }
function fmt(d) { return d.toISOString().split('T')[0]; }
function label(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
const today = utcDate(now);
const yesterday = addDays(today, -1);
const currentStartDate = addDays(yesterday, -13);
const previousStartDate = addDays(yesterday, -27);
const previousEndDate = addDays(yesterday, -14);
const commentsStartDate = addDays(yesterday, -6);
return [{ json: {
  current_start: fmt(currentStartDate),
  current_end: fmt(yesterday),
  previous_start: fmt(previousStartDate),
  previous_end: fmt(previousEndDate),
  comments_start: fmt(commentsStartDate),
  comments_end: fmt(yesterday),
  week_of: fmt(currentStartDate),
  period_label: label(currentStartDate) + ' - ' + label(yesterday),
  activity_label: label(commentsStartDate) + ' - ' + label(yesterday)
} }];`;
}

function weeklyPerformanceQuery() {
  return `WITH raw AS (
  SELECT
    'current'::text AS period,
    COALESCE(NULLIF(brand, ''), 'Unknown') AS business_focus,
    COALESCE(NULLIF(ad_channel, ''), 'Unknown') AS ad_channel,
    COALESCE(cost, 0)::numeric AS cost,
    COALESCE(impressions, 0)::numeric AS impressions,
    COALESCE(clicks, 0)::numeric AS clicks,
    COALESCE(conversions, 0)::numeric AS conversions,
    COALESCE(purchases, 0)::numeric AS purchases,
    COALESCE(revenue, 0)::numeric AS revenue
  FROM master_spartaco
  WHERE date >= $1::date
    AND date <= $2::date
    AND lower(COALESCE(brand, '')) IN ('jameson', 'huskie', 'ronin')
  UNION ALL
  SELECT
    'previous'::text AS period,
    COALESCE(NULLIF(brand, ''), 'Unknown') AS business_focus,
    COALESCE(NULLIF(ad_channel, ''), 'Unknown') AS ad_channel,
    COALESCE(cost, 0)::numeric AS cost,
    COALESCE(impressions, 0)::numeric AS impressions,
    COALESCE(clicks, 0)::numeric AS clicks,
    COALESCE(conversions, 0)::numeric AS conversions,
    COALESCE(purchases, 0)::numeric AS purchases,
    COALESCE(revenue, 0)::numeric AS revenue
  FROM master_spartaco
  WHERE date >= $3::date
    AND date <= $4::date
    AND lower(COALESCE(brand, '')) IN ('jameson', 'huskie', 'ronin')
)
SELECT period, business_focus, ad_channel,
  SUM(cost) AS spend,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  SUM(conversions) AS conversions,
  SUM(purchases) AS purchases,
  SUM(revenue) AS revenue
FROM raw
GROUP BY period, business_focus, ad_channel
UNION ALL
SELECT period, 'overall' AS business_focus, 'all' AS ad_channel,
  SUM(cost), SUM(impressions), SUM(clicks), SUM(conversions), SUM(purchases), SUM(revenue)
FROM raw
GROUP BY period
ORDER BY business_focus, ad_channel, period`;
}

function weeklyPrepareCode() {
  return `const items = $input.all();
const dateCtx = $('Set Date Ranges').first().json;

const taskMap = {};
items
  .filter(i => i.json.task_id && i.json.task_name && !i.json.comment_text && i.json.spend === undefined)
  .forEach(i => { taskMap[i.json.task_id] = i.json.task_name; });

const perfRows = items.filter(i => i.json.period && i.json.business_focus && i.json.spend !== undefined).map(i => i.json);
const comments = items.filter(i => i.json.comment_text).map(i => i.json);

function num(v) { return Number(v || 0); }
function money(v) { return '$' + Math.round(num(v)).toLocaleString(); }
function pct(curr, prev) {
  if (!prev) return 'N/A';
  const value = ((curr - prev) / prev) * 100;
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}
function key(row) {
  return String(row.business_focus || '').toLowerCase() + '|' + String(row.ad_channel || '').toLowerCase();
}
const current = new Map();
const previous = new Map();
for (const row of perfRows) {
  if (row.period === 'current') current.set(key(row), row);
  if (row.period === 'previous') previous.set(key(row), row);
}

const focuses = ['overall', 'Jameson', 'Huskie', 'Ronin'];
const channels = ['all', 'Meta', 'Google', 'Metricool', 'Unknown'];
const lines = [];
for (const focus of focuses) {
  const focusKey = focus.toLowerCase();
  for (const channel of channels) {
    const mapKey = focusKey + '|' + channel.toLowerCase();
    const cur = current.get(mapKey);
    const prev = previous.get(mapKey);
    if (!cur && !prev) continue;
    const spend = num(cur?.spend);
    const prevSpend = num(prev?.spend);
    const conversions = num(cur?.conversions);
    const prevConversions = num(prev?.conversions);
    const purchases = num(cur?.purchases);
    const prevPurchases = num(prev?.purchases);
    const revenue = num(cur?.revenue);
    const prevRevenue = num(prev?.revenue);
    const clicks = num(cur?.clicks);
    const impressions = num(cur?.impressions);
    const cpl = conversions > 0 ? spend / conversions : null;
    const prevCpl = prevConversions > 0 ? prevSpend / prevConversions : null;
    const roas = spend > 0 ? revenue / spend : null;
    const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : null;
    lines.push([
      focus + ' / ' + channel,
      'Spend ' + money(spend) + ' (' + pct(spend, prevSpend) + ')',
      'Conversions ' + conversions + ' (' + pct(conversions, prevConversions) + ')',
      'CPL ' + (cpl == null ? 'N/A' : money(cpl)) + ' (' + (cpl != null && prevCpl != null ? pct(cpl, prevCpl) : 'N/A') + ')',
      'Purchases ' + purchases + ' (' + pct(purchases, prevPurchases) + ')',
      'Revenue ' + money(revenue) + ' (' + pct(revenue, prevRevenue) + ')',
      'ROAS ' + (roas == null ? 'N/A' : roas.toFixed(2) + 'x') + ' (' + (roas != null && prevRoas != null ? pct(roas, prevRoas) : 'N/A') + ')',
      'Clicks ' + clicks,
      'Impressions ' + impressions
    ].join(' | '));
  }
}
const performanceText = lines.length ? lines.join('\\n') : 'No Spartaco performance rows found for Jameson, Huskie, or Ronin.';

const MAX_COMMENT_LEN = 600;
const commentText = comments.length
  ? comments.map(c => {
      const taskName = taskMap[c.task_id] || c.task_id;
      const date = String(c.comment_date || '').split('T')[0];
      const text = String(c.comment_text || '');
      const clipped = text.length > MAX_COMMENT_LEN ? text.slice(0, MAX_COMMENT_LEN) + '...' : text;
      return '[' + date + '] [' + (c.business_focus || 'general') + '] [' + taskName + '] ' + clipped;
    }).join('\\n\\n')
  : 'No ClickUp comments in the activity window.';

const chatInput =
  'CLIENT: Spartaco Group\\n' +
  'PERFORMANCE WINDOW: ' + dateCtx.period_label + ' (' + dateCtx.current_start + ' to ' + dateCtx.current_end + ')\\n' +
  'COMPARISON WINDOW: ' + dateCtx.previous_start + ' to ' + dateCtx.previous_end + '\\n' +
  'ACTIVITY WINDOW: ' + dateCtx.activity_label + ' (' + dateCtx.comments_start + ' to ' + dateCtx.comments_end + ')\\n\\n' +
  'PERFORMANCE DATA BY BUSINESS FOCUS AND CHANNEL:\\n' + performanceText + '\\n\\n' +
  'CLICKUP COMMENTS (' + comments.length + ' comments):\\n' + commentText + '\\n\\n' +
  'IMPORTANT CONTEXT: Most ClickUp comments currently come from one budget pacing task. Treat general comments as general optimization context unless they explicitly mention Jameson, Huskie, or Ronin.';

return [{ json: {
  chatInput,
  week_of: dateCtx.week_of,
  period_start: dateCtx.current_start,
  period_end: dateCtx.current_end,
  previous_start: dateCtx.previous_start,
  previous_end: dateCtx.previous_end
} }];`;
}

function weeklySystemMessage() {
  return `You are a senior paid media strategist at EIC Agency writing a weekly dashboard readout for Spartaco Group.

Spartaco's business focuses are Jameson, Huskie, and Ronin. You must always include separate insight sections for all three business focuses.

Field definitions:
- overall_story: A single client-ready paragraph, 2-4 sentences, summarizing the overall week across Jameson, Huskie, and Ronin. Include specific numbers when useful.
- focus_insights: An object with exactly jameson, huskie, and ronin. Each focus has wins, opportunities, and next_steps arrays.
- wins: General cross-brand wins that are not specific to one focus.
- opportunities: General optimization opportunities, especially from budget pacing comments.
- accomplishments: Concrete actions or changes from ClickUp comments.
- focus_next_week: Specific priorities for next week.
- execution_context: Context that affects interpretation, such as budget pacing notes, measurement gaps, or comments being general rather than brand-specific.

Hard rules:
- Always include separate insight sections for Jameson, Huskie, and Ronin.
- Do not omit a business focus because it had low spend, low conversion volume, or limited ClickUp activity.
- If there is limited information for a focus, say that directly and recommend whether the next step is monitoring, budget shift, creative refresh, audience/search-term optimization, landing-page review, or measurement cleanup.
- Most ClickUp comments currently come from one budget pacing task and should be treated as general optimization context unless the comment explicitly names Jameson, Huskie, or Ronin.
- Use general optimization comments in top-level opportunities, accomplishments, and focus_next_week. Only assign them to a specific focus when the text supports that assignment.
- Keep the tone professional, concise, and client-ready. This goes directly into the Spartaco dashboard.

Respond ONLY with valid JSON matching the schema. Do not include prose before or after the JSON.`;
}

function weeklyFormatSaveCode() {
  return `const output = $input.first().json.output || {};
const dateCtx = $('Prepare Weekly Data').first().json;
function pgEscape(s) { return String(s || '').replace(/'/g, "''"); }
function json(value) { return pgEscape(JSON.stringify(value ?? [])); }
const focusInsights = output.focus_insights || {
  jameson: { wins: [], opportunities: [], next_steps: [] },
  huskie: { wins: [], opportunities: [], next_steps: [] },
  ronin: { wins: [], opportunities: [], next_steps: [] }
};
const sql =
  "INSERT INTO spartaco_weekly_readout (week_of, period_start, period_end, previous_start, previous_end, overall_story, focus_insights, wins, opportunities, accomplishments, focus_next_week, execution_context, status, raw_agent_output) VALUES (" +
  "'" + pgEscape(dateCtx.week_of) + "'::date, " +
  "'" + pgEscape(dateCtx.period_start) + "'::date, " +
  "'" + pgEscape(dateCtx.period_end) + "'::date, " +
  "'" + pgEscape(dateCtx.previous_start) + "'::date, " +
  "'" + pgEscape(dateCtx.previous_end) + "'::date, " +
  "'" + pgEscape(output.overall_story || '') + "', " +
  "'" + json(focusInsights) + "'::jsonb, " +
  "'" + json(output.wins || []) + "'::jsonb, " +
  "'" + json(output.opportunities || []) + "'::jsonb, " +
  "'" + json(output.accomplishments || []) + "'::jsonb, " +
  "'" + json(output.focus_next_week || []) + "'::jsonb, " +
  "'" + json(output.execution_context || []) + "'::jsonb, " +
  "'published', " +
  "'" + json(output) + "'::jsonb" +
  ") ON CONFLICT (week_of) DO UPDATE SET generated_at = timezone('utc'::text, now()), period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, previous_start = EXCLUDED.previous_start, previous_end = EXCLUDED.previous_end, overall_story = EXCLUDED.overall_story, focus_insights = EXCLUDED.focus_insights, wins = EXCLUDED.wins, opportunities = EXCLUDED.opportunities, accomplishments = EXCLUDED.accomplishments, focus_next_week = EXCLUDED.focus_next_week, execution_context = EXCLUDED.execution_context, status = EXCLUDED.status, raw_agent_output = EXCLUDED.raw_agent_output";
return [{ json: { sql } }];`;
}
