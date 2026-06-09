import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchCBAChatSummary,
  fetchCBAChatCampaigns,
  fetchCBAChatSpendTrend,
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
CBA Glass runs paid ads to drive inbound leads — form fills and contact requests from potential customers. This is lead generation; there is no ecommerce or direct revenue tracking.

## North Star Metrics
- **Leads** (conversions) — the primary volume metric. More is better.
- **Cost Per Lead (CPL)** — spend ÷ leads. Lower is better. Target: $35 or under.
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
- "how are we doing?" / "leads" / "CPL" / "total spend" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best CPL by campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** ("Won" line = leads)

## Response style
- Always call a tool before answering performance questions
- Lead with total leads, then CPL, then note whether CPL is at or below the $35 target
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance totals — leads, CPL, spend, clicks, CTR, CPC. Use for questions like "how many leads?", "what is our CPL?", or "how much have we spent?"',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchCBAChatSummary(startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, leads, CPL, clicks, CTR. Use to compare campaigns, find the best CPL, or understand which campaigns are driving leads.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchCBAChatCampaigns(startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and lead trend for charting. "Won" line = leads. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchCBAChatSpendTrend(startDate, endDate, days),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
