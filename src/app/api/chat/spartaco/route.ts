import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchSpartacoChatSummary,
  fetchSpartacoChatCampaigns,
  fetchSpartacoChatSpendTrend,
  fetchSpartacoChatMetaCreatives,
} from '@/services/spartaco-chat-analytics';

export const dynamic = 'force-dynamic';

const dateRangeSchema = {
  startDate: z.string().optional().describe(
    'Start date as YYYY-MM-DD. Always resolve named periods before calling (see system prompt).',
  ),
  endDate: z.string().optional().describe(
    'End date as YYYY-MM-DD. Defaults to today if omitted.',
  ),
  days: z.number().optional().describe(
    'Convenience shorthand: look back N days from today. Only use when no explicit startDate is needed.',
  ),
};

const brandSchema = z.enum(['Jameson', 'Huskie', 'Ronin', 'Tiiger', 'all']).optional()
  .describe('Brand filter. Default: all. Tiiger data is stored under Huskie internally — the RPC handles remapping transparently.');

const channelSchema = z.enum(['Google', 'Meta', 'all']).optional()
  .describe('Ad channel filter. Default: all.');

const modeSchema = z.enum(['LEAD', 'SALES', 'ALL']).optional()
  .describe('Campaign type: LEAD (lead gen, track conversions), SALES (ecommerce, track purchases + revenue), or ALL. Default: ALL.');

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
  const currentMonth = now.getMonth();
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonth = currentMonth === 0 ? 12 : currentMonth;
  const priorMonthStart = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-01`;
  const priorMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  const priorMonthEnd = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-${priorMonthLastDay}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are an AI marketing analyst for Spartaco Tools, a manufacturer of specialty utility, arborist, and electrical tools. You help EIC Agency staff and Spartaco stakeholders understand paid media performance and make data-driven decisions.

## Brands
Spartaco operates four brands, each with distinct products and audiences:
- **Jameson** — Arborist and telecom tools: pole saws, fiber drivers, rodders, little buddy, tree tools, cable benders, vine pullers. Largest brand by spend.
- **Huskie** — Hydraulic and battery-powered cutting tools: cut/crimp tools, battery tools (SLA series), 60-100 ton presses, pole maintenance equipment.
- **Ronin** — Fall protection and climbing equipment: ascenders, pro climbers.
- **Tiiger** — Line clearing tools: pole pullers, pole maintenance, long handled tools. Note: Tiiger's ad data is stored internally under the Huskie brand — always use brand='Tiiger' when filtering and the system handles the remapping automatically.

## Campaign types (modes)
- **LEAD campaigns** — Lead generation. Track: leads (conversions), CPL. Google and Meta both run lead campaigns.
- **SALES campaigns** — Ecommerce. Track: purchases, revenue, ROAS, CPA. Jameson is the primary brand with SALES campaigns. ROAS = revenue ÷ spend.

## North-star metrics
- LEAD campaigns → CPL (lower is better)
- SALES campaigns → ROAS (higher is better) and CPA (lower is better)

## Channels
- **Google** — Primarily search intent; both LEAD and SALES campaigns
- **Meta** — Facebook/Instagram; primarily LEAD campaigns with some SALES retargeting

## Data context
- Earliest data: 2024-01-01
- The getSummary tool returns per-brand, per-channel rows. When you get results, compute cross-brand totals yourself if asked.
- No MQL/SQL/Closed Won funnel — this is industrial/ecommerce, not B2B SaaS.

## Today's date and date math
Today is ${today} (${todayISO}).

When a user references a named time period, ALWAYS convert it to explicit startDate + endDate before calling any tool:

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

## Tool selection guide
- "how did [brand] do?" / "overall performance" / "total spend" / "ROAS" / "CPL" → **getSummary** first
- "which brand is most efficient?" / "compare Google vs Meta" → **getSummary** with brand='all'
- "top campaigns" / "which campaigns are working?" → **getCampaignPerformance**
- "trend" / "over time" / "daily" / "chart spend" → **getSpendTrend**
- "Meta creatives" / "which ad is working?" / "show me ads" → **getMetaCreativePerformance**

For complex questions, chain tools in one turn: e.g. "Jameson Q1 performance with top creatives" → call getSummary + getMetaCreativePerformance together.

## Response style
- Always call at least one tool before answering any performance question — never guess at numbers
- Lead with the insight, support with data. Be concise.
- For SALES campaigns, highlight ROAS alongside spend. For LEAD campaigns, lead with CPL.
- Do NOT reproduce tool result data as markdown tables — the UI renders cards/tables/charts. Reference the data briefly and move to insight.
- When asked about trends, always call getSpendTrend — the UI renders a chart automatically.

## Creative display rules
- Any question about creatives → ALWAYS call getMetaCreativePerformance in your FIRST response.
- Never generate markdown image syntax or include raw CDN URLs in your text.
- After a creative tool call, write 2–3 sentences pointing out what to notice. Cards speak for themselves.`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance KPIs — spend, leads, purchases, revenue, CPL, CPA, ROAS, CTR, CPC — for any brand/channel/mode/date range. Returns per-brand, per-channel rows. Use for high-level questions like "how did Jameson do in Q1?" or "what is total ROAS for SALES campaigns this month?" or "compare Google vs Meta."',
        inputSchema: z.object({
          brand: brandSchema,
          channel: channelSchema,
          mode: modeSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ brand, channel, mode, startDate, endDate, days }) =>
          fetchSpartacoChatSummary(brand ?? 'all', channel ?? 'all', mode ?? 'ALL', startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get campaign-level performance — spend, leads, purchases, revenue, CPL, CPA, ROAS — for any brand/channel/mode/date range. Results are aggregated server-side with no row cap. Use to find top/bottom campaigns or compare campaign efficiency.',
        inputSchema: z.object({
          brand: brandSchema,
          channel: channelSchema,
          mode: modeSchema,
          limit: z.number().optional().describe('Max campaigns to return. Default: 25, max: 50.'),
          ...dateRangeSchema,
        }),
        execute: async ({ brand, channel, mode, startDate, endDate, days, limit }) =>
          fetchSpartacoChatCampaigns(brand ?? 'all', channel ?? 'all', mode ?? 'ALL', startDate, endDate, days, limit ?? 25),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and metric trend over a time period for charting. Use when asked about trends, time-series, "how has spend changed", "day by day", "chart". Returns one data point per day — renders as an interactive chart in the UI.',
        inputSchema: z.object({
          brand: brandSchema,
          channel: channelSchema,
          mode: modeSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ brand, channel, mode, startDate, endDate, days }) =>
          fetchSpartacoChatSpendTrend(brand ?? 'all', channel ?? 'all', mode ?? 'ALL', startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta (Facebook/Instagram) ad creative performance across Jameson, Huskie, Ronin, and Tiiger brands — ranked by spend. Returns ad images, video URLs, headlines, copy, and efficiency metrics (CPL for LEAD, CPA/ROAS for SALES). Use for any question about Meta ads, creatives, or which ads are working.',
        inputSchema: z.object({
          brand: brandSchema,
          mode: modeSchema,
          limit: z.number().optional().describe('Top N creatives. Default: 8, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ brand, mode, startDate, endDate, days, limit }) =>
          fetchSpartacoChatMetaCreatives(brand ?? 'all', mode ?? 'ALL', startDate, endDate, days, limit ?? 8),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
