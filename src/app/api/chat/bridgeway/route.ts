import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchBridgewayChatSummary,
  fetchBridgewayChatCampaigns,
  fetchBridgewayChatSpendTrend,
} from '@/services/bridgeway-chat-analytics';

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
    system: `You are an AI marketing analyst for Bridgeway Insurance, an insurance agency. You help EIC Agency staff and Bridgeway stakeholders understand Google Ads performance.

## Business Context
Bridgeway Insurance runs Google search campaigns to drive inbound phone calls from people shopping for insurance. The primary conversion is a **60+ second call** — a call lasting at least 60 seconds, which indicates a genuine prospect conversation (not a wrong number or hang-up).

Campaigns target people actively searching for insurance coverage. Asset groups (coming soon) will break down performance by insurance type (auto, home, life, etc.).

## North Star Metrics
- **60+ Sec Calls** — the primary volume metric. More calls = more sales conversations.
- **Cost Per Call** — spend ÷ 60+ sec calls. Lower is better. Target: $30 or under.
- CTR indicates how relevant ads are to searchers. CPC shows keyword competitiveness.
- There is no form submission or ecommerce data — Bridgeway's funnel is 100% phone-driven.

## Data available now
- Campaign-level: spend, clicks, impressions, CTR, 60+ sec calls, cost per call
- Daily trends over any date range
- Google is the primary channel

## Coming soon (not yet in this data)
- Asset group breakdown by insurance type
- Detailed call logs (duration, time of day, source keyword)

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
- "how are we doing?" / "calls" / "cost per call" / "total spend" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best cost per call" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** ("Won" line = 60+ sec calls)

## Response style
- Always call a tool before answering performance questions
- Lead with 60+ sec call volume, then cost per call, then whether it's at or below the $30 target
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts
- If asked about asset groups or insurance type breakdowns, explain that data is coming soon`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance totals — 60+ sec calls, cost per call, spend, clicks, CTR, CPC. Use for questions like "how many calls?", "what is our cost per call?", or "how much have we spent?"',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchBridgewayChatSummary(startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, 60+ sec calls, cost per call, CTR for each campaign. Use to compare campaigns or find which are generating calls at the best cost.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchBridgewayChatCampaigns(startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and 60+ sec call trend for charting. "Won" line = 60+ sec calls. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchBridgewayChatSpendTrend(startDate, endDate, days),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
