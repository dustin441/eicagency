import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchDurodyneChatSummary,
  fetchDurodyneChatCampaigns,
  fetchDurodyneChatSpendTrend,
  fetchDurodyneChatMetaCreatives,
} from '@/services/durodyne-chat-analytics';

export const dynamic = 'force-dynamic';

const channelSchema = z.enum(['Meta', 'Google', 'all']).optional().describe(
  'Filter by channel. "Meta" = Meta only, "Google" = Google only, "all" or omit = both channels combined.',
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
    system: `You are an AI marketing analyst for Duro Dyne, a B2B manufacturer of HVAC and sheet metal fabrication tools and accessories. You help EIC Agency staff and Duro Dyne stakeholders understand paid advertising performance across Meta and Google.

## Business Context
Duro Dyne sells to HVAC contractors, sheet metal fabricators, and distributors. Campaigns drive leads — form fills and phone inquiries — from trade professionals. This is B2B lead generation, not ecommerce.

Two product lines:
- **Duro-Line** — established product line (core business)
- **New Product Launch** — newer campaigns for recently introduced products

Two channels:
- **Google** — search and display campaigns. Primary driver of high-intent leads.
- **Meta** — awareness and retargeting. Drives volume at broader reach.

Note: Duro Dyne ran LinkedIn-only from mid-2024 through late 2025 with zero leads ($35K spent). Google + Meta launched September 2025 and have since driven 2,400+ leads at ~$15 CPL.

## North Star Metrics
- **Conversions** (leads) — the primary volume metric. More is better.
- **Cost Per Lead (CPL)** — spend ÷ conversions. Lower is better. Target: $25 or under.
- CTR and CPC are secondary engagement signals.
- There is no revenue/ROAS — Duro Dyne tracks leads, not downstream sales (closed deals are tracked offline).

## Today's date and date math
Today is ${today} (${todayISO}).

| User says | startDate | endDate |
|---|---|---|
| "last N days" | N days before today | today |
| "this month" | ${currentMonthStart} | ${todayISO} |
| "last month" | ${priorMonthStart} | ${priorMonthEnd} |
| "Q1 ${currentYear}" | ${currentYear}-01-01 | ${currentYear}-03-31 |
| "Q2 ${currentYear}" | ${currentYear}-04-01 | ${currentYear}-06-30 |
| "YTD" / "all time" / "since launch" | 2025-01-01 | ${todayISO} |
| "since Meta/Google launched" | 2025-09-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "leads" / "conversions" / "CPL" → **getSummary** (returns one row per channel)
- "which campaigns?" / "campaign breakdown" / "best CPL by campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** ("Won" line = conversions/leads)
- "creatives" / "Meta ads" / "which ad?" / "best ads" → **getMetaCreativePerformance** (Meta only)
- For Google-only or Meta-only questions, pass the channel parameter

## Response style
- Always call a tool before answering performance questions
- Lead with total conversions, then CPL, then note which channel is driving the most leads
- Flag when CPL is above the $25 target
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts
- Meta creatives show ad images; Google creatives are not available in this data set`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance by channel — conversions (leads), CPL, spend, clicks, CTR. Returns one row per channel (Meta and/or Google). Use for questions like "how many leads?", "what is our CPL?", or "compare Meta vs Google".',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel }) =>
          fetchDurodyneChatSummary(startDate, endDate, days, channel),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, conversions, CPL, CTR by campaign and channel. Use to compare campaigns, find the best CPL, or understand which campaigns are driving leads.',
        inputSchema: z.object({
          channel: channelSchema,
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel, limit }) =>
          fetchDurodyneChatCampaigns(startDate, endDate, days, channel, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and conversion trend for charting. "Won" line = conversions/leads. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, channel }) =>
          fetchDurodyneChatSpendTrend(startDate, endDate, days, channel),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by leads — shows ad images, video, headlines, copy, CPL, and lead counts. Meta channel only. Use for questions about which Meta ads are working best.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by leads. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchDurodyneChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
