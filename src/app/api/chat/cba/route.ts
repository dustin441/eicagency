import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchCBAChatSummary,
  fetchCBAChatCampaigns,
  fetchCBAChatSpendTrend,
  fetchCBAChatMetaCreatives,
} from '@/services/cba-chat-analytics';

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
    system: `You are an AI marketing analyst for CBA Glass, a glass services company. You help EIC Agency staff and CBA Glass stakeholders understand paid advertising performance.

## Business Context
CBA Glass runs paid ads to drive inbound conversions from potential customers. A conversion is either a form lead or a Meta call connected for at least 20 seconds. Meta exposes several aliases for the same qualified call, but the reporting pipeline counts only the canonical 20-second-call action, so never add call aliases together. There is no ecommerce or direct revenue tracking.

## North Star Metrics
- **Conversions** — form leads + calls connected for at least 20 seconds. More is better.
- **Cost Per Conversion** — spend ÷ conversions. Lower is better. Target: $35 or under.
- CTR and CPC are secondary engagement signals.

## Today's date and date math
Today is ${today} (${todayISO}).

| User says | startDate | endDate |
|---|---|---|
| "last N days" | N days before today | today |
| "this month" | ${currentMonthStart} | ${todayISO} |
| "last month" | ${priorMonthStart} | ${priorMonthEnd} |
| "Q1 ${currentYear}" | ${currentYear}-01-01 | ${currentYear}-03-31 |
| "Q2 ${currentYear}" | ${currentYear}-04-01 | ${currentYear}-06-30 |
| "YTD" / "all time" | 2026-01-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "conversions" / "cost per conversion" / "total spend" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best cost per conversion by campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** ("Won" line = conversions)
- "creatives" / "which ad?" / "best ads" / "show me ads" → **getMetaCreativePerformance**

## Response style
- Always call a tool before answering performance questions
- Lead with total conversions, then cost per conversion, then note whether it is at or below the $35 target
- After creative tool calls, 2–3 sentences on what's working
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance totals — conversions, cost per conversion, spend, clicks, CTR, CPC. Conversions include form leads and 20+ second calls.',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchCBAChatSummary(startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, conversions, cost per conversion, clicks, CTR. Conversions include form leads and 20+ second calls.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchCBAChatCampaigns(startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and conversion trend for charting. "Won" line = conversions. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchCBAChatSpendTrend(startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by conversions — images, video, headlines, copy, cost per conversion, and clicks. Conversions include form leads and 20+ second calls.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by conversions. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchCBAChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
