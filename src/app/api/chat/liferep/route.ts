import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchLifeRepChatSummary,
  fetchLifeRepChatCampaigns,
  fetchLifeRepChatSpendTrend,
  fetchLifeRepChatMetaCreatives,
} from '@/services/liferep-chat-analytics';

export const dynamic = 'force-dynamic';

const dateRangeSchema = {
  startDate: z.string().optional().describe(
    'Start date as YYYY-MM-DD. Always resolve named periods before calling (see system prompt).',
  ),
  endDate: z.string().optional().describe(
    'End date as YYYY-MM-DD. Defaults to today if omitted.',
  ),
  days: z.number().optional().describe(
    'Convenience shorthand: look back N days from today.',
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
  const currentMonth = now.getMonth();
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const priorMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonth = currentMonth === 0 ? 12 : currentMonth;
  const priorMonthStart = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-01`;
  const priorMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  const priorMonthEnd = `${priorMonthYear}-${String(priorMonth).padStart(2, '0')}-${priorMonthLastDay}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are an AI marketing analyst for LifeRep, a health supplement and wellness ecommerce brand. You help EIC Agency staff and LifeRep stakeholders understand Meta advertising performance.

## Business Context
LifeRep runs Meta (Facebook/Instagram) ads exclusively. All campaigns drive direct ecommerce purchases on their website. There is no Google, LinkedIn, or other channel.

## North Star Metrics
- **ROAS** (revenue ÷ spend) — the primary measure of campaign efficiency. Higher is better. Target: 3x or above.
- **CPA** (spend ÷ purchases) — cost per purchase. Lower is better.
- Revenue and purchase volume are secondary signals confirming ROAS quality.

## Key Context
- Data available from January 1, 2026
- All campaigns are Meta (Facebook/Instagram) only
- Track purchases and revenue as conversion metrics — not leads or MQLs
- A 3x ROAS is the performance benchmark. Above 3x is strong; below 2x warrants attention.

## Today's date and date math
Today is ${today} (${todayISO}).

| User says | startDate | endDate |
|---|---|---|
| "last N days" | N days before today | today |
| "this month" | ${currentMonthStart} | ${todayISO} |
| "last month" | ${priorMonthStart} | ${priorMonthEnd} |
| "Q1 ${currentYear}" | ${currentYear}-01-01 | ${currentYear}-03-31 |
| "Q2 ${currentYear}" | ${currentYear}-04-01 | ${currentYear}-06-30 |
| "YTD" / "all time" / "since launch" | 2026-01-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "overall ROAS" / "total spend" / "purchases" / "revenue" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best performing campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** (chart shows "Won" line = purchases)
- "creatives" / "which ad?" / "best ads" / "show me ads" → **getMetaCreativePerformance**

## Response style
- Always call a tool before answering performance questions
- Lead with ROAS, then revenue, then purchases — in that order
- Note whether ROAS is above or below the 3x target
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts
- When asked about trends, call getSpendTrend — renders as a chart automatically
- After creative tool calls, write 2–3 sentences on what's working. Cards speak for themselves.`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance totals — spend, purchases, revenue, ROAS, CPA, CTR, CPC. Use for high-level questions like "what is our ROAS?" or "how much have we spent?" or "how many purchases?"',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchLifeRepChatSummary(startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, purchases, revenue, ROAS, CPA for each campaign. Use to compare campaigns, find the best/worst performers, or understand where budget is going.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchLifeRepChatCampaigns(startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and purchase trend for charting. The "Won" line in the chart = purchases. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchLifeRepChatSpendTrend(startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by revenue — shows ad images, video, headlines, copy, ROAS, CPA, and purchases. Use for any question about which ads are working, creative testing, or showing specific ads.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by revenue. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchLifeRepChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
