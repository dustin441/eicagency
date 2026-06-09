import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchKinseyChatSummary,
  fetchKinseyChatCampaigns,
  fetchKinseyChatSpendTrend,
  fetchKinseyChatMetaCreatives,
} from '@/services/kinsey-chat-analytics';

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

const channelSchema = z.enum(['Meta', 'Google', 'all']).optional().describe(
  'Channel filter. Meta has full purchase/revenue/ROAS data. Google has conversions only (no revenue attribution). Default: all.',
);

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
    system: `You are an AI marketing analyst for Kinsey Designs, a jewelry and accessories brand. You help EIC Agency staff and Kinsey stakeholders understand paid media performance across Meta and Google.

## Business Context
Kinsey Designs sells sports-themed and lifestyle jewelry (charms, game day collections, fan favorites). Customers purchase directly through their ecommerce website. Campaigns run on Meta (primary) and Google (supporting).

## Channels
- **Meta** — Primary channel. Full purchase and revenue tracking. ROAS and CPA are the key metrics.
- **Google** — Supporting channel (Pmax, Search DSA, Shopping). Very limited spend (~$350 total). Google tracks conversions but has no revenue attribution, so ROAS cannot be computed for Google.

## North Star Metrics
- **ROAS** (revenue ÷ spend) — Primary efficiency metric. Higher is better. Only available for Meta.
- **CPA** (spend ÷ purchases) — Cost per purchase. Lower is better. Only available for Meta.
- Revenue and purchase volume are secondary signals.

## Key Benchmarks (YTD 2026)
- Meta blended ROAS: 1.68x | CPA: $64.82 | 165 purchases | $17,964 revenue
- Best campaign: [New Funnel] [Retarget] — 2.06x ROAS, [Mother's Day] — 2.09x ROAS
- Google: $352 spend, 89 conversions (no revenue data — not comparable to Meta ROAS)
- Data available from January 1, 2026

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
- "overall performance" / "ROAS" / "purchases" / "revenue" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** (chart: "Won" = purchases, "Leads" = Google conversions)
- "creatives" / "which ad?" / "show me ads" → **getMetaCreativePerformance**

## Response style
- Always call a tool before answering performance questions
- Lead with ROAS, then revenue, then purchases for Meta questions
- When Google comes up, note it has conversions data only — not purchase/revenue comparable
- Do NOT reproduce raw data as markdown tables — UI renders cards/charts
- After creative tool calls, 2–3 sentences on what's working`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance by channel — spend, purchases, revenue, ROAS, CPA, CTR, CPC. Meta has full purchase/revenue data. Google shows conversions only (no ROAS). Use for high-level questions like "what is our ROAS?" or "total purchases this month?"',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ channel, startDate, endDate, days }) =>
          fetchKinseyChatSummary(channel ?? 'all', startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, purchases, revenue, ROAS, CPA, conversions by channel. Use to compare campaigns or find most efficient performers.',
        inputSchema: z.object({
          channel: channelSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ channel, startDate, endDate, days, limit }) =>
          fetchKinseyChatCampaigns(channel ?? 'all', startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend, purchase, and conversion trend for charting. "Won" line = purchases, "Leads" line = Google conversions. Use when asked about trends, "over time", or "chart".',
        inputSchema: z.object({
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ channel, startDate, endDate, days }) =>
          fetchKinseyChatSpendTrend(channel ?? 'all', startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by revenue — images, video, headlines, copy, ROAS, CPA, and purchases. Use for any question about which ads are working or creative testing.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by revenue. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchKinseyChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
