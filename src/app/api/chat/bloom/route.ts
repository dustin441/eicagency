import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchBloomChatSummary,
  fetchBloomChatCampaigns,
  fetchBloomChatSpendTrend,
  fetchBloomChatMetaCreatives,
} from '@/services/bloom-chat-analytics';

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
    system: `You are an AI marketing analyst for Bloom Aesthetics, a medspa and aesthetics services business. You help EIC Agency staff and Bloom stakeholders understand Meta advertising performance.

## Business Context
Bloom Aesthetics runs Meta (Facebook/Instagram) ads to drive new client inquiries. The primary conversion action is a **website chat** — a prospect initiating a live chat on Bloom's website via the webchat widget. This is the top-of-funnel action that leads to consultations and bookings.

All campaigns run on Meta only. There is no Google, LinkedIn, or other paid channel tracked here.

## North Star Metrics
- **Website Chats** — the primary conversion. Higher is better. This is what drives new clients.
- **Cost Per Webchat** — spend ÷ website chats. Lower is better. This is the efficiency North Star.
- Clicks and CTR are secondary signals indicating ad engagement quality.
- There is no ROAS or purchase revenue data — Bloom is a services business, not ecommerce.

## Key Context
- Data available from May 1, 2026
- Website chats are tracked via a custom Meta pixel event on the webchat widget
- A lower Cost Per Webchat means more efficient lead acquisition
- In the trend chart, "Won" = website chats

## Today's date and date math
Today is ${today} (${todayISO}).

| User says | startDate | endDate |
|---|---|---|
| "last N days" | N days before today | today |
| "this month" | ${currentMonthStart} | ${todayISO} |
| "last month" | ${priorMonthStart} | ${priorMonthEnd} |
| "Q2 ${currentYear}" | ${currentYear}-04-01 | ${currentYear}-06-30 |
| "Q3 ${currentYear}" | ${currentYear}-07-01 | ${currentYear}-09-30 |
| "YTD" / "all time" / "since launch" | 2026-05-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "total chats" / "cost per chat" / "total spend" → **getSummary**
- "which campaigns?" / "campaign breakdown" / "best campaign" → **getCampaignPerformance**
- "trend" / "over time" / "chart" / "daily" → **getSpendTrend** (chart "Won" line = website chats)
- "creatives" / "which ad?" / "best ads" / "show me ads" → **getMetaCreativePerformance**

## Response style
- Always call a tool before answering performance questions
- Lead with website chats and cost per webchat — in that order
- Note whether cost per webchat is trending better (down) or worse (up)
- Do NOT reproduce raw data as markdown tables — the UI renders cards/charts
- After creative tool calls, write 2–3 sentences on which messages or visuals seem to be driving chats`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance totals — website chats, cost per webchat, spend, clicks, CTR, CPC. Use for high-level questions like "how many chats?" or "what is our cost per webchat?" or "how much have we spent?"',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchBloomChatSummary(startDate, endDate, days),
      }),

      getCampaignPerformance: tool({
        description: 'Get individual campaign breakdown — spend, website chats, cost per webchat, clicks, CTR for each campaign. Use to compare campaigns or find which ones are driving the most chats at the best cost.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max campaigns to return. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchBloomChatCampaigns(startDate, endDate, days, limit ?? 20),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and website chat trend for charting. The "Won" line = website chats. Use when asked about trends, "day by day", "over time", or "chart".',
        inputSchema: z.object({ ...dateRangeSchema }),
        execute: async ({ startDate, endDate, days }) =>
          fetchBloomChatSpendTrend(startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance ranked by website chats — shows ad images, video, headlines, copy, and chat-driving metrics. Use for questions about which ads are generating the most chats or how creative is performing.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Top N creatives by website chats. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ startDate, endDate, days, limit }) =>
          fetchBloomChatMetaCreatives(startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
