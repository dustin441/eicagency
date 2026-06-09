import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchTurfliChatSummary,
  fetchTurfliChatCampaigns,
  fetchTurfliChatSpendTrend,
  fetchTurfliChatMetaCreatives,
} from '@/services/turfli-chat-analytics';

export const dynamic = 'force-dynamic';

const channelSchema = z.enum(['Meta', 'Google', 'all']).optional().describe(
  'Filter by channel. "Meta" = Meta only, "Google" = Google only, "all" or omit = both channels.',
);

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
    system: `You are an AI marketing analyst for Turfli, a home services company. You help EIC Agency staff and Turfli stakeholders understand paid advertising performance across Meta and Google.

## Business Context
Turfli runs paid ads on both Meta (Facebook/Instagram) and Google to drive inbound leads. Campaigns generate conversions — form fills or contact requests from potential customers seeking home services. This is lead generation; there is no ecommerce revenue tracking.

## North Star Metrics
- **Conversions** (leads) — the primary volume metric.
- **Cost Per Conversion (CPL)** — spend ÷ conversions. Lower is better. Target: $75 or under.
- CTR indicates ad relevance. CPC shows auction competitiveness.

## Channels
- **Meta** — Facebook and Instagram ads. Creative-driven, audience targeting.
- **Google** — Search and display campaigns. Captures high-intent searchers.

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
- "how are we doing?" / "conversions" / "CPL" / "total spend" → **getSummary** (returns one row per channel)
- "which campaigns?" / "campaign breakdown" / "best CPL" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** ("Won" line = conversions)
- "creatives" / "Meta ads" / "which ad?" → **getMetaCreativePerformance** (Meta only)
- For Google-only or Meta-only questions, pass the channel parameter

## Response style
- Always call a tool before answering performance questions
- Lead with total conversions, then CPL, then note whether CPL is at or below the $75 target
- Flag which channel is driving more volume and at what efficiency
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts
- Meta creatives show ad images/video; Google creatives are not available in this data set`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance by channel — conversions, CPL, spend, clicks, CTR. Returns one row per channel (Meta and/or Google). Use for "how many conversions?", "what is CPL?", or "compare Meta vs Google".',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel }) =>
          fetchTurfliChatSummary(startDate, endDate, days, channel),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, conversions, CPL, CTR by campaign and channel. Use to compare campaigns or find which are generating conversions at the best cost.',
        inputSchema: z.object({
          channel: channelSchema,
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel, limit }) =>
          fetchTurfliChatCampaigns(startDate, endDate, days, channel, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and conversion trend for charting. "Won" line = conversions. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel }) =>
          fetchTurfliChatSpendTrend(startDate, endDate, days, channel),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by leads — shows ad images, video, headlines, copy, and conversion metrics. Meta channel only. Use for questions about which Meta ads are working best.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by leads. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchTurfliChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
