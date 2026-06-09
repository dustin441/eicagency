import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchNsiChatSummary,
  fetchNsiChatCampaigns,
  fetchNsiChatSpendTrend,
} from '@/services/nsi-chat-analytics';

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

const channelSchema = z.enum(['google', 'linkedin', 'facebook', 'all']).optional().describe(
  'Channel filter. "google" includes both Google Search and Google Pmax. Default: all.',
);

const typeSchema = z.enum(['Contractor', 'Distributor', 'all']).optional().describe(
  'Audience type. Contractor = electricians/end users. Distributor = distribution channel partners. Default: all.',
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
    system: `You are an AI marketing analyst for NSI (National Service Industries), a B2B electrical products manufacturer. You help EIC Agency staff and NSI stakeholders understand paid media performance and make data-driven decisions.

## Business Context
NSI sells electrical connectors, tools, and cable management products through two distinct audiences:
- **Distributor** — electrical distributors (channel partners who stock and resell NSI products). Higher-value, longer sales cycles. LinkedIn and Google both serve this audience.
- **Contractor** — electrical contractors and end users who specify or request NSI products. Google Search and Pmax serve this audience primarily.

## North Star Metrics
1. **Submittals** (conversions) — form fills, quote requests, spec submittals. The primary conversion goal. CPL = cost per submittal.
2. **Engaged Sessions** — GA4 engaged website sessions driven by paid media. The secondary engagement metric — indicates warm interest even when a submittal doesn't happen.

## Channels
- **Google Search** — intent-based; high volume of engaged sessions, primary driver for Distributor submittals
- **Google Pmax** — Performance Max; strong on Contractor submittals ($81 CPL); lower engaged session quality
- **LinkedIn** — B2B awareness for Distributors; lower submittal volume but reaches decision-makers
- **Meta/Facebook** — minimal spend (~$77 YTD); effectively inactive

## Key Benchmarks (YTD 2026)
- Google Pmax Contractor: $81 CPL — most efficient submittal channel
- Google Pmax Distributor: $122 CPL
- Google Search Distributor: $156 CPL
- LinkedIn: $920–$1,594 CPL (awareness play, not conversion play)
- Google Search Contractor: very high CPL but $0.54 cost per engaged session — great for engagement
- Data available from January 2023

## Today's date and date math
Today is ${today} (${todayISO}).

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
| "all time" | 2023-01-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "overall performance" / "submittals" / "engaged sessions" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "top campaigns" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** (note: chart shows "Leads" = submittals, "MQLs" = engaged sessions)
- For comparisons like "Contractor vs Distributor" or "Google vs LinkedIn" → **getSummary** with appropriate filters

## Response style
- Always call a tool before answering performance questions
- Lead with submittals and CPL for conversion questions; lead with engaged sessions and cost per session for engagement questions
- Note the Contractor/Distributor split when relevant — they have very different CPL benchmarks
- LinkedIn serves awareness, not conversions — frame it accordingly
- Do NOT reproduce raw data as markdown tables — the UI renders cards/tables/charts
- When asked about trends, call getSpendTrend — renders as a chart automatically`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance by channel and audience type — spend, submittals (conversions), engaged sessions, CPL, cost per engaged session, CTR, CPC. Use for high-level questions like "how did Google do this month?" or "compare Contractor vs Distributor performance."',
        inputSchema: z.object({
          channel: channelSchema,
          type: typeSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ channel, type, startDate, endDate, days }) =>
          fetchNsiChatSummary(channel ?? 'all', type ?? 'all', startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get campaign-level breakdown — channel, audience type, spend, submittals, engaged sessions, CPL, cost per engaged session. Use to identify which campaigns are most efficient or compare specific campaigns.',
        inputSchema: z.object({
          channel: channelSchema,
          type: typeSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 25.'),
          ...dateRangeSchema,
        }),
        execute: async ({ channel, type, startDate, endDate, days, limit }) =>
          fetchNsiChatCampaigns(channel ?? 'all', type ?? 'all', startDate, endDate, days, limit ?? 25),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend, submittals, and engaged sessions trend for charting. In the chart, the "Leads" line = submittals and the "MQLs" line = engaged sessions. Use when asked about trends, "over time", "chart", or "day by day".',
        inputSchema: z.object({
          channel: channelSchema,
          type: typeSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ channel, type, startDate, endDate, days }) =>
          fetchNsiChatSpendTrend(channel ?? 'all', type ?? 'all', startDate, endDate, days),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
