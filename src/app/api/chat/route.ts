import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchChatCampaignPerformance,
  fetchChatMetaCreatives,
  fetchChatGoogleCreatives,
  fetchChatBudgetPacing,
  fetchChatSpendTrend,
  fetchChatSegmentSummary,
} from '@/services/chat-analytics';

export const dynamic = 'force-dynamic';

// Shared date range schema used by every time-sensitive tool.
const dateRangeSchema = {
  startDate: z.string().optional().describe(
    'Start date as YYYY-MM-DD. Always pass this explicitly after resolving any named period (see system prompt). Takes precedence over `days`.',
  ),
  endDate: z.string().optional().describe(
    'End date as YYYY-MM-DD. Defaults to today if omitted.',
  ),
  days: z.number().optional().describe(
    'Convenience shorthand: look back N days from today. Only use when the user gives a relative duration and no explicit startDate is needed.',
  ),
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { messages } = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  const now = new Date();
  const today = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const todayISO = now.toISOString().slice(0, 10);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonth = currentMonth === 0 ? 12 : currentMonth;
  const priorMonthStart = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-01`;
  const priorMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  const priorMonthEnd = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-${priorMonthLastDay}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are an AI marketing analyst for PrePass, a B2B SaaS platform in the trucking and transportation safety industry. You help EIC Agency staff and PrePass stakeholders understand performance and make data-driven creative decisions.

PrePass runs three audience segments:
- SMB: Small/medium fleet operators — configurable monthly budget
- ABM: Account-based marketing for enterprise fleets — configurable monthly budget
- FD360: FuelDash 360 product campaigns — configurable monthly budget

## Data context
- Google drives full-funnel conversion (MQL → SQL → Closed Won). Cost/Won is the north star.
- Meta drives top-of-funnel lead volume. CPL is the efficiency proxy for creatives.
- "Leads" for Google = platform conversions (form fills tracked in Google Ads), not CRM-verified. MQLs/SQLs/Won are CRM-attributed and are more reliable funnel metrics.
- "Leads" for Meta = lead form completions. Same caveat — MQLs and Won are the real signal.
- LinkedIn is NOT in the MMP data — it only contributes spend/clicks with no funnel data.

## Analysis framework (always work top-down)
1. Campaign level: Cost/MQL → Cost/SQL → Cost/Won. Google drives funnel; Meta drives volume.
2. Creative level: CPL as efficiency proxy since MQL attribution is not available per ad.

## Today's date and date math
Today is ${today} (${todayISO}).

When a user references a named time period, ALWAYS convert it to explicit startDate + endDate before calling any tool. Use these exact rules:

| User says | startDate | endDate |
|---|---|---|
| "last N days" | N days before today | today |
| "this month" | ${currentMonthStart} | ${todayISO} |
| "last month" | ${priorMonthStart} | ${priorMonthEnd} |
| "Q1 ${currentYear}" | ${currentYear}-01-01 | ${currentYear}-03-31 |
| "Q2 ${currentYear}" | ${currentYear}-04-01 | ${currentYear}-06-30 |
| "Q3 ${currentYear}" | ${currentYear}-07-01 | ${currentYear}-09-30 |
| "Q4 ${currentYear}" | ${currentYear}-10-01 | ${currentYear}-12-31 |
| "Q1 ${currentYear - 1}" | ${currentYear - 1}-01-01 | ${currentYear - 1}-03-31 |
| "Q2 ${currentYear - 1}" | ${currentYear - 1}-04-01 | ${currentYear - 1}-06-30 |
| "Q3 ${currentYear - 1}" | ${currentYear - 1}-07-01 | ${currentYear - 1}-09-30 |
| "Q4 ${currentYear - 1}" | ${currentYear - 1}-10-01 | ${currentYear - 1}-12-31 |
| "YTD" | ${currentYear}-01-01 | ${todayISO} |
| "last year" | ${currentYear - 1}-01-01 | ${currentYear - 1}-12-31 |
| "this week" | most recent Monday | ${todayISO} |
| "last week" | Monday of last week | Sunday of last week |
| any custom range | compute as YYYY-MM-DD | compute as YYYY-MM-DD |

For any year or period not in the table above, compute the dates yourself using the same quarter/month boundaries.

## Tool selection guide
- "how is [segment] doing?" / "Q2 results" / "overall performance" / "total spend" → **getSegmentSummary** first, then drill in if asked
- "top campaigns" / "which campaigns are efficient?" / "campaign breakdown" → **getCampaignPerformance**
- "spend trend" / "daily breakdown" / "trending by day" / "how has spend changed over" / "chart spend" → **getSpendTrend**
- "best creatives" / "which ad is working?" / "show me Meta ads" → **getMetaCreativePerformance**
- "Google ads" / "search creatives" / "Google copy" → **getGoogleCreativePerformance**
- "budget pacing" / "how are we tracking against budget?" → **getBudgetPacing**

For complex questions, chain tools in a single turn: e.g. for "Q2 ABM performance with top creatives", call getSegmentSummary + getMetaCreativePerformance together.

## Response style
- Always call at least one tool before answering any performance question — never guess at numbers
- Lead with the actionable insight, support with data. Be concise — the panel is narrow.
- Cost Per Won is the north star. Cost Per Lead is the creative-level proxy.
- Do NOT reproduce tool result data as markdown tables — the UI already renders cards/tables/charts. Reference the rendered data briefly ("the top ad", "as you can see above") and move to insight.
- When asked about a trend, always call getSpendTrend — the UI will render a chart automatically.

## Creative display rules (CRITICAL)
- Any question about creatives → ALWAYS call getMetaCreativePerformance or getGoogleCreativePerformance in your FIRST response. Do not wait to be asked.
- When asked to re-show a specific ad, call the tool again — the UI only renders cards from the most recent tool call.
- Never generate markdown image syntax (![text](url)) or include raw image/CDN URLs in your text.
- After a creative tool call, write 2–3 sentences pointing out what to notice. The rendered cards speak for themselves.`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSegmentSummary: tool({
        description: 'Get aggregate performance KPIs for a segment or all segments over any time period — total spend, leads, MQLs, SQLs, Closed Won, CPL, Cost/MQL, Cost/Won, CTR, CPC. Use for high-level questions like "how did SMB do in Q2?" or "what was total spend last month?"',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment. Default: all'),
          platform: z.enum(['Google', 'Meta', 'all']).optional().describe('Platform. Default: all'),
          ...dateRangeSchema,
        }),
        execute: async ({ focus, platform, startDate, endDate, days }) =>
          fetchChatSegmentSummary(focus ?? 'all', platform ?? 'all', startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get campaign-level marketing performance with full funnel metrics (spend, leads, MQLs, SQLs, Closed Won, Cost/MQL, Cost/SQL, Cost/Won) for any time period. Use to identify top/bottom campaigns and funnel efficiency. Results are unlimited — no row cap.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment. Default: all'),
          platform: z.enum(['Google', 'Meta', 'all']).optional().describe('Platform. Default: all'),
          ...dateRangeSchema,
        }),
        execute: async ({ focus, platform, startDate, endDate, days }) =>
          fetchChatCampaignPerformance(focus ?? 'all', platform ?? 'all', startDate, endDate, days),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and metric breakdown over a time period for trend charting. Use when asked about trends, time-series, "how has spend changed", "day by day", "chart spend", "trending". Returns one data point per day — renders as an interactive chart in the UI.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment. Default: all'),
          platform: z.enum(['Google', 'Meta', 'all']).optional().describe('Platform. Default: all'),
          ...dateRangeSchema,
        }),
        execute: async ({ focus, platform, startDate, endDate, days }) =>
          fetchChatSpendTrend(focus ?? 'all', platform ?? 'all', startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta (Facebook/Instagram) ad creative performance ranked by CPL. Returns ad images, video URLs, headlines, primary copy, and metrics. Use for any question about Meta ads or creatives.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment filter. Default: all'),
          limit: z.number().optional().describe('Top N creatives. Default: 5, max 20'),
          ...dateRangeSchema,
        }),
        execute: async ({ focus, startDate, endDate, days, limit }) =>
          fetchChatMetaCreatives(focus ?? 'all', startDate, endDate, days, limit ?? 5),
      }),

      getGoogleCreativePerformance: tool({
        description: 'Get Google search ad creative performance — headlines, descriptions, and metrics ranked by results. Use for any question about Google search ads or copy.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment filter. Default: all'),
          limit: z.number().optional().describe('Top N ads. Default: 5, max 20'),
          ...dateRangeSchema,
        }),
        execute: async ({ focus, startDate, endDate, days, limit }) =>
          fetchChatGoogleCreatives(focus ?? 'all', startDate, endDate, days, limit ?? 5),
      }),

      getBudgetPacing: tool({
        description: 'Get current-month budget pacing for PrePass segments — shows MTD spend vs monthly budget by platform. Always uses the current calendar month regardless of any date filter.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360']).optional().describe('Specific segment (omit for all three)'),
        }),
        execute: async ({ focus }) => fetchChatBudgetPacing(focus),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
