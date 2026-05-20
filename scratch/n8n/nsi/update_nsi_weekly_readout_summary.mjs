const workflowId = process.argv[2] || '0tgfRoKwJJZ4IODn';
const baseUrl = process.env.EIC_N8N_BASE_URL || 'https://eicagency.app.n8n.cloud';
const apiKey = process.env.EIC_N8N_API_TOKEN || process.env.N8N_API_KEY;

if (!apiKey) {
  throw new Error('Missing EIC_N8N_API_TOKEN/N8N_API_KEY');
}

const workflow = await fetchJson(`${baseUrl}/api/v1/workflows/${workflowId}`);
const agent = workflow.nodes.find((node) => node.name === 'NSI Weekly Readout Generator');
const parser = workflow.nodes.find((node) => node.name === 'Structured Output Parser');

if (!agent) throw new Error('Missing NSI Weekly Readout Generator node');
if (!parser) throw new Error('Missing Structured Output Parser node');

agent.parameters.options = {
  ...(agent.parameters.options || {}),
  systemMessage: `You are a senior paid media strategist at EIC Agency writing a concise weekly dashboard performance summary for NSI (National Safety Industries).

Field definitions and length limits:
- overall_story: 1-2 client-ready sentences, max 55 words total. This is the topline summary of how overall marketing performed over the 14-day performance window. Use only the most important takeaway and avoid listing every metric.
- channel_insights: Object keyed only by channels with spend data: "google", "linkedin", "facebook" when applicable. One sentence per channel, max 30 words each. Omit no-spend channels.
- sub_campaign_insights: Array of objects, one for every active sub-campaign with spend from PERFORMANCE DATA BY SUB CAMPAIGN. Each object must have "name" set to the exact sub_campaign name and "note" set to one short client-ready performance summary, max 30 words. Do not group by audience type or use labels like Contractor/Distributor unless those are exact sub_campaign names.
- accomplishments: 3-5 short bullets from ClickUp comments only. Do not invent accomplishments. Prefer completed actions over discussion.
- focus_next_week: 2-3 short, specific priorities based on performance and ClickUp context.
- execution_context: 0-2 short caveats on measurement gaps, tracking, or data availability only.

Hard rules:
- NSI targets B2B safety product buyers. Submittals are the primary conversion metric.
- Submittal Rate = submittals / clicks. Higher is better. Always compare to prior period when available.
- For cost metrics such as cost per submittal and CPC, lower is better. If cost per submittal is above the $155 goal, say it is above goal or needs improvement; if below $155, say it is below goal.
- Use PERFORMANCE DATA for all metric claims. Use ClickUp comments as operational context only.
- Use only comments inside the stated ACTIVITY WINDOW.
- Keep the tone professional, concise, and client-ready.

Respond ONLY with valid JSON matching the schema. Do not include prose before or after the JSON.`,
};

parser.parameters.jsonSchemaExample = JSON.stringify({
  overall_story: 'NSI improved submittal volume and efficiency this period, led by Google and the strongest active search sub-campaigns, though cost per submittal remains above the $155 goal.',
  channel_insights: {
    google: 'Google generated most submittals and improved cost per submittal versus the prior period.',
    linkedin: 'LinkedIn maintained awareness traffic with limited direct submittal impact.',
  },
  sub_campaign_insights: [
    {
      name: 'CCF-CON-BPT2',
      note: 'CCF-CON-BPT2 led active sub-campaigns with the lowest cost per submittal.',
    },
    {
      name: 'CON-CON-CMP',
      note: 'CON-CON-CMP improved submittal volume and efficiency versus the prior period.',
    },
    {
      name: 'CON-END-CMP-PPC',
      note: 'CON-END-CMP-PPC is early but should be monitored for submittal rate and cost efficiency.',
    },
  ],
  accomplishments: [
    'Added CMP Display ads and a PMax asset group using updated messaging.',
    'Adjusted LinkedIn budgets toward the lower-cost follower campaign.',
    'Created the new CON-END-CMP-PPC search campaign.',
  ],
  focus_next_week: [
    'Rebalance spend toward the planned PPC allocation.',
    'Monitor early performance from the new CMP and POL2 search work.',
  ],
  execution_context: [
    'Submittal comparisons before 2026 are unreliable due to tracking changes.',
  ],
});

const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: {
    executionOrder: workflow.settings?.executionOrder,
    errorWorkflow: workflow.settings?.errorWorkflow,
  },
};

const updated = await fetchJson(`${baseUrl}/api/v1/workflows/${workflowId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

console.log(`Updated ${updated.id}: ${updated.name}`);

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-N8N-API-KEY': apiKey,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n ${res.status}: ${text}`);
  return JSON.parse(text);
}
