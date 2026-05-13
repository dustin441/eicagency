import fs from 'node:fs';

const baseUrl = process.env.EIC_N8N_BASE_URL || 'https://eicagency.app.n8n.cloud';
const apiKey = process.env.EIC_N8N_API_TOKEN || process.env.N8N_API_KEY;

const clickupWorkflowId = 'RmurvcTivExnhcBk';
const weeklyWorkflowId = 'r4oF9ccBWgBClSgA';
const clickupWorkflowName = 'Bridgeway ClickUp Sync';
const weeklyWorkflowName = 'Bridgeway Weekly Readout Generator';
const bridgewayListId = '901413196484';
const ddl = fs.readFileSync('scratch/bridgeway/bridgeway_weekly_update_tables.sql', 'utf8');

if (!apiKey) {
  throw new Error('Missing EIC_N8N_API_TOKEN/N8N_API_KEY');
}

const [clickupWorkflow, weeklyWorkflow] = await Promise.all([
  fetchJson(`${baseUrl}/api/v1/workflows/${clickupWorkflowId}`),
  fetchJson(`${baseUrl}/api/v1/workflows/${weeklyWorkflowId}`),
]);

const savedClickup = await updateWorkflow(clickupWorkflowId, buildClickupWorkflow(clickupWorkflow));
const savedWeekly = await updateWorkflow(weeklyWorkflowId, buildWeeklyWorkflow(weeklyWorkflow));

console.log(`Bridgeway ClickUp Sync URL: ${baseUrl}/workflow/${savedClickup.id}`);
console.log(`Bridgeway Weekly Readout Generator URL: ${baseUrl}/workflow/${savedWeekly.id}`);
console.log('After this API update, manually confirm ClickUp, Postgres, and AI credentials are still connected in n8n.');

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

  getAllTasks.parameters.url = `https://api.clickup.com/api/v2/list/${bridgewayListId}/task`;
  merge.parameters.jsCode = clickupMergeCode();
  formatTaskSql.parameters.jsCode = clickupTaskSqlCode();
  formatCommentSql.parameters.jsCode = clickupCommentSqlCode();

  const ensureTables = {
    id: 'bridgeway-weekly-ensure-tables',
    name: 'Ensure Bridgeway Weekly Tables',
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
    id: 'bridgeway-clickup-manual-trigger',
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [-112, -120],
    parameters: {},
  };

  workflow.nodes = workflow.nodes
    .filter((node) => !(/^Ensure .* Weekly Tables$/.test(node.name) || node.name === 'Manual Trigger'))
    .concat([ensureTables, manualTrigger]);
  removeConnections(workflow, (name) => /^Ensure .* Weekly Tables$/.test(name) || name === 'Manual Trigger');

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
  const schedule = findScheduleNode(workflow, nodeByName);
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
  getComments.parameters.query = "SELECT clickup_comment_id AS comment_id, clickup_task_id AS task_id, comment_text, posted_at::text AS comment_date, commenter AS user_name, funnel_focus FROM bridgeway_clickup_comments WHERE posted_at >= $1::date AND posted_at < ($2::date + interval '1 day') ORDER BY posted_at ASC LIMIT 300";
  getComments.parameters.options = {
    queryReplacement: '={{ $json.comments_start }},{{ $json.comments_end }}',
  };
  getTasks.parameters.query = 'SELECT clickup_task_id AS task_id, name AS task_name, funnel_focus FROM bridgeway_clickup_tasks';
  getTasks.parameters.options = {};
  prepareWeeklyData.parameters.jsCode = weeklyPrepareCode();
  agent.parameters.options = {
    systemMessage: weeklySystemMessage(),
  };
  schema.parameters.jsonSchemaExample = JSON.stringify({
    overall_story: 'Bridgeway improved call efficiency while channel mix and traffic quality shaped the next optimization priorities.',
    wins: ['60+ second call volume improved while cost per qualified call moved in the right direction.'],
    opportunities: ['Continue monitoring campaign pockets where spend increased without a matching call-quality lift.'],
    accomplishments: ['Reviewed weekly budget pacing and optimization comments from ClickUp.'],
    focus_next_week: ['Prioritize budget and creative adjustments around the campaigns producing the strongest 60+ second call efficiency.'],
    execution_context: ['ClickUp comments may include general budget pacing notes; only attribute them to Creative, Traffic, Conversion, or Measurement when the text supports it.'],
  });
  formatSaveData.parameters.jsCode = weeklyFormatSaveCode();

  const ensureTables = {
    id: 'bridgeway-weekly-readout-ensure-tables',
    name: 'Ensure Bridgeway Weekly Tables',
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
    .filter((node) => !/^Ensure .* Weekly Tables$/.test(node.name))
    .concat([ensureTables]);
  removeConnections(workflow, (name) => /^Ensure .* Weekly Tables$/.test(name));

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

async function updateWorkflow(id, workflow) {
  const saved = await fetchJson(`${baseUrl}/api/v1/workflows/${id}`, {
    method: 'PUT',
    body: {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: {},
    },
  });

  if (!saved.active) {
    return fetchJson(`${baseUrl}/api/v1/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  return saved;
}

function requireNode(nodeByName, name) {
  const node = nodeByName.get(name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
}

function findScheduleNode(workflow, nodeByName) {
  return nodeByName.get('Weekly Schedule (Mon 9 AM UTC)')
    ?? nodeByName.get('Weekly Schedule (Mon 5 AM UTC)')
    ?? workflow.nodes.find((node) => node.type === 'n8n-nodes-base.scheduleTrigger')
    ?? requireNode(nodeByName, 'Weekly Schedule (Mon 9 AM UTC)');
}

function removeConnections(workflow, shouldRemove) {
  for (const name of Object.keys(workflow.connections)) {
    if (shouldRemove(name)) delete workflow.connections[name];
  }
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
  if (text.includes('creative') || text.includes('ad copy') || text.includes('asset') || text.includes('image') || text.includes('video')) matches.push('creative');
  if (text.includes('traffic') || text.includes('click') || text.includes('cpc') || text.includes('ctr')) matches.push('traffic');
  if (text.includes('conversion') || text.includes('lead') || text.includes('call') || text.includes('cost per call') || text.includes('form')) matches.push('conversion');
  if (text.includes('tracking') || text.includes('measurement') || text.includes('pixel') || text.includes('ga4') || text.includes('analytics') || text.includes('attribution')) matches.push('measurement');
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
    "'${bridgewayListId}', " +
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
const query = "INSERT INTO public.bridgeway_clickup_tasks (clickup_task_id, list_id, name, status, url, assignees, tags, funnel_focus, due_at, created_at, updated_at, synced_at, raw_payload) VALUES " + values +
  " ON CONFLICT (clickup_task_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, url = EXCLUDED.url, assignees = EXCLUDED.assignees, tags = EXCLUDED.tags, funnel_focus = EXCLUDED.funnel_focus, due_at = EXCLUDED.due_at, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, synced_at = EXCLUDED.synced_at, raw_payload = EXCLUDED.raw_payload";
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
      funnel_focus: inferFocus(commentText, json.task_name),
      posted_at: c.date ? new Date(parseInt(String(c.date), 10)).toISOString() : null,
      raw_payload: c
    });
  }
}
if (commentRows.length === 0) return [{ json: { query: 'SELECT 1' } }];
const values = commentRows.map((row) => "(" +
  pgNullable(row.comment_id) + ", " +
  pgNullable(row.task_id) + ", " +
  "'${bridgewayListId}', " +
  pgNullable(row.comment_text) + ", " +
  pgNullable(row.commenter) + ", " +
  pgNullable(row.funnel_focus) + ", " +
  pgNullable(row.posted_at) + "::timestamptz, " +
  "timezone('utc'::text, now()), " +
  pgJson(row.raw_payload || {}) +
")").join(', ');
const query = "INSERT INTO public.bridgeway_clickup_comments (clickup_comment_id, clickup_task_id, list_id, comment_text, commenter, funnel_focus, posted_at, synced_at, raw_payload) VALUES " + values +
  " ON CONFLICT (clickup_comment_id) DO UPDATE SET clickup_task_id = EXCLUDED.clickup_task_id, comment_text = EXCLUDED.comment_text, commenter = EXCLUDED.commenter, funnel_focus = EXCLUDED.funnel_focus, posted_at = EXCLUDED.posted_at, synced_at = EXCLUDED.synced_at, raw_payload = EXCLUDED.raw_payload";
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
    COALESCE(ad_channel, 'Unknown')::text AS ad_channel,
    COALESCE(cost, 0)::numeric AS cost,
    COALESCE(impressions, 0)::numeric AS impressions,
    COALESCE(clicks, 0)::numeric AS clicks,
    COALESCE(conversions, 0)::numeric AS conversions
  FROM bridgeway_master
  WHERE date >= $1::date
    AND date <= $2::date
  UNION ALL
  SELECT
    'previous'::text AS period,
    COALESCE(ad_channel, 'Unknown')::text AS ad_channel,
    COALESCE(cost, 0)::numeric AS cost,
    COALESCE(impressions, 0)::numeric AS impressions,
    COALESCE(clicks, 0)::numeric AS clicks,
    COALESCE(conversions, 0)::numeric AS conversions
  FROM bridgeway_master
  WHERE date >= $3::date
    AND date <= $4::date
)
SELECT period, ad_channel,
  SUM(cost) AS spend,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  SUM(conversions) AS conversions,
  SUM(conversions) AS actions,
  CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) / SUM(impressions) * 100 ELSE 0 END AS ctr,
  CASE WHEN SUM(clicks) > 0 THEN SUM(cost) / SUM(clicks) ELSE 0 END AS cpc,
  CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END AS cost_per_conversion
FROM raw
GROUP BY period, ad_channel
UNION ALL
SELECT period, 'all' AS ad_channel,
  SUM(cost), SUM(impressions), SUM(clicks), SUM(conversions), SUM(conversions),
  CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) / SUM(impressions) * 100 ELSE 0 END,
  CASE WHEN SUM(clicks) > 0 THEN SUM(cost) / SUM(clicks) ELSE 0 END,
  CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END
FROM raw
GROUP BY period
ORDER BY ad_channel, period`;
}

function weeklyPrepareCode() {
  return `const items = $input.all();
const dateCtx = $('Set Date Ranges').first().json;

const taskMap = {};
items
  .filter(i => i.json.task_id && i.json.task_name && !i.json.comment_text && i.json.spend === undefined)
  .forEach(i => { taskMap[i.json.task_id] = i.json.task_name; });

const perfRows = items.filter(i => i.json.period && i.json.ad_channel && i.json.spend !== undefined).map(i => i.json);
const comments = items.filter(i => i.json.comment_text).map(i => i.json);

function num(v) { return Number(v || 0); }
function money(v) { return '$' + Math.round(num(v)).toLocaleString(); }
function pct(curr, prev) {
  if (!prev) return 'N/A';
  const value = ((curr - prev) / prev) * 100;
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}
function key(row) {
  return String(row.ad_channel || '').toLowerCase();
}
const current = new Map();
const previous = new Map();
for (const row of perfRows) {
  if (row.period === 'current') current.set(key(row), row);
  if (row.period === 'previous') previous.set(key(row), row);
}

const channels = ['all', 'Meta', 'Google', 'Unknown'];
const lines = [];
for (const channel of channels) {
  const cur = current.get(channel.toLowerCase());
  const prev = previous.get(channel.toLowerCase());
  if (!cur && !prev) continue;
  const spend = num(cur?.spend);
  const prevSpend = num(prev?.spend);
  const calls = num(cur?.actions);
  const prevCalls = num(prev?.actions);
  const clicks = num(cur?.clicks);
  const prevClicks = num(prev?.clicks);
  const impressions = num(cur?.impressions);
  const prevImpressions = num(prev?.impressions);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : null;
  const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : null;
  const costPerCall = calls > 0 ? spend / calls : null;
  const prevCostPerCall = prevCalls > 0 ? prevSpend / prevCalls : null;
  lines.push([
    channel,
    'Spend ' + money(spend) + ' (' + pct(spend, prevSpend) + ')',
    '60+ Sec Calls ' + calls + ' (' + pct(calls, prevCalls) + ')',
    'Cost per 60+ Sec Call ' + (costPerCall == null ? 'N/A' : money(costPerCall)) + ' (' + (costPerCall != null && prevCostPerCall != null ? pct(costPerCall, prevCostPerCall) : 'N/A') + ')',
    'CTR ' + ctr.toFixed(2) + '% (' + pct(ctr, prevCtr) + ')',
    'CPC ' + (cpc == null ? 'N/A' : money(cpc)) + ' (' + (cpc != null && prevCpc != null ? pct(cpc, prevCpc) : 'N/A') + ')',
    'Clicks ' + clicks,
    'Impressions ' + impressions
  ].join(' | '));
}
const performanceText = lines.length ? lines.join('\\n') : 'No Bridgeway performance rows found for the selected period.';

const MAX_COMMENT_LEN = 600;
const commentText = comments.length
  ? comments.map(c => {
      const taskName = taskMap[c.task_id] || c.task_id;
      const date = String(c.comment_date || '').split('T')[0];
      const text = String(c.comment_text || '');
      const clipped = text.length > MAX_COMMENT_LEN ? text.slice(0, MAX_COMMENT_LEN) + '...' : text;
      return '[' + date + '] [' + (c.funnel_focus || 'general') + '] [' + taskName + '] ' + clipped;
    }).join('\\n\\n')
  : 'No ClickUp comments in the activity window.';

const chatInput =
  'CLIENT: Bridgeway Insurance\\n' +
  'PERFORMANCE WINDOW: ' + dateCtx.period_label + ' (' + dateCtx.current_start + ' to ' + dateCtx.current_end + ')\\n' +
  'COMPARISON WINDOW: ' + dateCtx.previous_start + ' to ' + dateCtx.previous_end + '\\n' +
  'ACTIVITY WINDOW: ' + dateCtx.activity_label + ' (' + dateCtx.comments_start + ' to ' + dateCtx.comments_end + ')\\n\\n' +
  'PERFORMANCE DATA BY CHANNEL:\\n' + performanceText + '\\n\\n' +
  'CLICKUP COMMENTS (' + comments.length + ' comments):\\n' + commentText + '\\n\\n' +
  'IMPORTANT CONTEXT: Bridgeway Insurance is a lead-generation dashboard. Use funnel framing where useful: Creative for ad assets and messaging, Traffic for click/CTR/CPC health, Conversion for 60+ second calls and cost per qualified call, and Measurement for tracking or analytics issues.';

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
  return `You are a senior paid media strategist at EIC Agency writing a weekly dashboard readout for Bridgeway Insurance.

Field definitions:
- overall_story: A single client-ready paragraph, 2-4 sentences, summarizing the overall week. Include specific numbers when useful.
- wins: Performance wins from paid media or clear progress from ClickUp comments.
- opportunities: Optimization opportunities, especially budget pacing, creative testing, traffic quality, call efficiency, or measurement cleanup.
- accomplishments: Concrete actions or changes from ClickUp comments.
- focus_next_week: Specific priorities for next week.
- execution_context: Context that affects interpretation, such as budget pacing notes, measurement gaps, limited call volume, or comments being general.

Hard rules:
- Treat Bridgeway Insurance as the client context.
- Prioritize 60+ second calls and cost per 60+ second call as the main conversion-quality metrics.
- Include lead-generation funnel context in the summary or bullets where useful: Creative, Traffic, Conversion, and Measurement.
- Use ClickUp comments as operational context. Do not invent accomplishments that are not supported by comments.
- Keep the tone professional, concise, and client-ready. This goes directly into the Bridgeway dashboard.

Respond ONLY with valid JSON matching the schema. Do not include prose before or after the JSON.`;
}

function weeklyFormatSaveCode() {
  return `const output = $input.first().json.output || {};
const dateCtx = $('Prepare Weekly Data').first().json;
function pgEscape(s) { return String(s || '').replace(/'/g, "''"); }
function json(value) { return pgEscape(JSON.stringify(value ?? [])); }
const sql =
  "INSERT INTO bridgeway_weekly_readout (week_of, period_start, period_end, previous_start, previous_end, overall_story, wins, opportunities, accomplishments, focus_next_week, execution_context, status, raw_agent_output) VALUES (" +
  "'" + pgEscape(dateCtx.week_of) + "'::date, " +
  "'" + pgEscape(dateCtx.period_start) + "'::date, " +
  "'" + pgEscape(dateCtx.period_end) + "'::date, " +
  "'" + pgEscape(dateCtx.previous_start) + "'::date, " +
  "'" + pgEscape(dateCtx.previous_end) + "'::date, " +
  "'" + pgEscape(output.overall_story || '') + "', " +
  "'" + json(output.wins || []) + "'::jsonb, " +
  "'" + json(output.opportunities || []) + "'::jsonb, " +
  "'" + json(output.accomplishments || []) + "'::jsonb, " +
  "'" + json(output.focus_next_week || []) + "'::jsonb, " +
  "'" + json(output.execution_context || []) + "'::jsonb, " +
  "'published', " +
  "'" + json(output) + "'::jsonb" +
  ") ON CONFLICT (week_of) DO UPDATE SET generated_at = timezone('utc'::text, now()), period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, previous_start = EXCLUDED.previous_start, previous_end = EXCLUDED.previous_end, overall_story = EXCLUDED.overall_story, wins = EXCLUDED.wins, opportunities = EXCLUDED.opportunities, accomplishments = EXCLUDED.accomplishments, focus_next_week = EXCLUDED.focus_next_week, execution_context = EXCLUDED.execution_context, status = EXCLUDED.status, raw_agent_output = EXCLUDED.raw_agent_output";
return [{ json: { sql } }];`;
}
