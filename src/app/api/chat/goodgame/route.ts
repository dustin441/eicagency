import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchGoodGameChatSummary,
  fetchGoodGameChatCampaigns,
  fetchGoodGameChatSpendTrend,
  fetchGoodGameChatVideoPerf,
  fetchGoodGameChatMetaCreatives,
} from '@/services/goodgame-chat-analytics';

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

const phaseSchema = z.enum(['awareness', 'retargeting', 'all']).optional().describe(
  'Campaign phase: awareness (engagement/video — TOF), retargeting (traffic/directions — MOF), or all. Default: all.',
);

const retailerSchema = z.enum(['hucks', 'circlek', 'murphys', 'all']).optional().describe(
  'Retailer: hucks (Huck\'s), circlek (Circle K), murphys (Murphy USA), or all. Default: all.',
);

const channelSchema = z.enum(['Google', 'Meta', 'all']).optional().describe(
  'Ad channel. Default: all.',
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
    system: `You are an AI marketing analyst for Good Game, an energy drink brand by T-Pain. You help EIC Agency staff understand paid media performance across retail store locations.

## Campaign Strategy — Two-Phase Funnel

Good Game runs a two-phase funnel targeting customers near convenience store chains:

### Phase 1: Awareness (Top of Funnel)
- **Objective:** Video engagement — drive 75% video completion rate
- **North star metric:** 75% completion rate (what % of people who saw the ad watched 75% of the video)
- **Secondary metric:** Cost per 75% video view (lower = more efficient awareness spend)
- **How to assess:** Use getVideoPerformance to see completion funnel (25%/50%/75%/100%) by campaign
- Campaign names contain: "Engagement", "Awareness", "TOF"

### Phase 2: Retargeting (Middle of Funnel)
- **Objective:** Drive in-store foot traffic — warm audiences who engaged with Phase 1 content
- **North star metric:** Engaged website traffic (landing page views) as a proxy for in-store intent
- **Secondary metrics:** Cost per landing page view, Get Directions conversions
- Campaign names contain: "Retarget", "Traffic", "Directions", "MOF"

## Retailers
Good Game is sold at three chains — always break down by retailer when comparing performance:
- **Huck's** — convenience chain (Midwest)
- **Circle K** — national convenience chain; largest footprint
- **Murphy USA** — gas station convenience (launched ~June 2026, newest retailer)

## Channels
- **Meta** — primary channel for both phases; video-forward creative strategy
- **Google** — awareness/search (Pmax, brand terms); no video completion data

## Key rules for analysis
- For awareness questions, always call getVideoPerformance — completion rate is what matters, not clicks or CPM alone
- For retargeting questions, focus on landing page views and cost per LP view
- CPM and CTR are secondary signals; do not lead with them
- Murphy USA data is limited (launched ~June 2026) — note this when asked about Murphy's
- "Conversions" in retargeting = Get Directions clicks / store locator actions, not purchases
- There is no purchase/revenue data — this is a brick-and-mortar awareness play, not ecommerce
- Data available from September 2025

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
| "Q4 ${currentYear - 1}" | ${currentYear - 1}-10-01 | ${currentYear - 1}-12-31 |
| "YTD" | ${currentYear}-01-01 | ${todayISO} |
| "since launch" / "all time" | 2025-09-01 | ${todayISO} |

## Tool selection guide
- "how are we doing?" / "overall performance" / "spend summary" → **getSummary**
- "video completion" / "75% views" / "how are videos performing?" / "awareness metrics" → **getVideoPerformance** (always use this for awareness questions)
- "which campaigns?" / "campaign breakdown" → **getCampaignPerformance**
- "trend" / "over time" / "daily spend" → **getSpendTrend**
- "creatives" / "which ad?" / "show me ads" / "Meta ads" → **getMetaCreativePerformance**

For complex questions, chain tools: "How is Circle K awareness doing?" → call getSummary (phase=awareness, retailer=circlek) + getVideoPerformance (retailer=circlek) together.

## Response style
- Always call a tool before answering performance questions — never guess at numbers
- Lead with the north-star metric for the phase being discussed (completion rate for awareness, LP views for retargeting)
- Be concise — note retailer differences when meaningful
- Do NOT reproduce raw numbers as markdown tables — the UI renders cards/tables/charts
- When asked about trends, call getSpendTrend — the UI renders a chart automatically`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get aggregate performance by phase (awareness/retargeting) and retailer — spend, impressions, CPM, landing page views, cost per LP view. Use for high-level questions like "how is Circle K doing?" or "compare awareness vs retargeting spend."',
        inputSchema: z.object({
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ phase, retailer, channel, startDate, endDate, days }) =>
          fetchGoodGameChatSummary(phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days),
      }),

      getVideoPerformance: tool({
        description: 'Get video completion funnel by campaign — views at 25%/50%/75%/100%, thruplay, 75% completion rate, and cost per 75% view. This is THE tool for awareness phase questions. Use whenever asked about video performance, engagement rates, or 75% completion.',
        inputSchema: z.object({
          retailer: retailerSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ retailer, startDate, endDate, days, limit }) =>
          fetchGoodGameChatVideoPerf(retailer ?? 'all', startDate, endDate, days, limit ?? 20),
      }),

      getCampaignPerformance: tool({
        description: 'Get campaign-level breakdown — phase, retailer, channel, spend, impressions, landing page views, cost per LP view. Use to compare specific campaigns or identify which retailer/phase combinations are most efficient.',
        inputSchema: z.object({
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 25.'),
          ...dateRangeSchema,
        }),
        execute: async ({ phase, retailer, channel, startDate, endDate, days, limit }) =>
          fetchGoodGameChatCampaigns(phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days, limit ?? 25),
      }),

      getSpendTrend: tool({
        description: 'Get daily spend and engagement trend for charting. "Leads" line = landing page views, "Won" line = Get Directions conversions. Use when asked about trends, "day by day", "how has spend changed", "chart".',
        inputSchema: z.object({
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ phase, retailer, channel, startDate, endDate, days }) =>
          fetchGoodGameChatSpendTrend(phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta ad creative performance — video completion rates, landing page views, spend, and creative assets. Use for any question about specific ads, creative testing, or which visuals are working.',
        inputSchema: z.object({
          retailer: retailerSchema,
          limit: z.number().optional().describe('Top N creatives. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ retailer, startDate, endDate, days, limit }) =>
          fetchGoodGameChatMetaCreatives(retailer ?? 'all', startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
