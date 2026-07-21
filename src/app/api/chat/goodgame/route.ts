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
  'Within-initiative stage. For ecommerce: awareness means prospecting and retargeting means retargeting. For foot traffic: awareness means homepage/awareness and retargeting means store locator/Get Directions. Default: all.',
);

const initiativeSchema = z.enum(['ecommerce', 'foot_traffic']).optional().describe(
  'Business initiative. Use ecommerce for online purchases and foot_traffic for retail-intent activity. Default: ecommerce.',
);

const retailerSchema = z.enum(['hucks', 'circlek', 'murphys', 'all']).optional().describe(
  'Retailer: hucks (Huck\'s), circlek (Circle K), murphys (Murphy USA), or all. Default: all.',
);

const channelSchema = z.enum(['Google', 'Meta', 'StackAdapt', 'all']).optional().describe(
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
    system: `You are an AI marketing analyst for Good Game, an energy drink brand by T-Pain. E-commerce is the primary/default initiative. Foot Traffic is a separate retail-discovery initiative.

## Initiative hierarchy

### 1. eCommerce
- Objective: online purchases.
- Lead with purchases, revenue, cost per purchase, and ROAS.
- Prospecting and retargeting are compared only within eCommerce.
- Platform-attributed sales are directional until Shopify order-level reconciliation is complete.

### 2. Foot Traffic / Retail Discovery
- Use the label Retail Intent Signals, not foot traffic performance.
- Homepage / Awareness includes engagement, broad traffic, CTV, and DOOH.
- Store Locator / Get Directions is the higher-intent destination stage.
- Lead with 75% video views and cost per 75% view for awareness, then Meta landing-page views, Meta LPV rate, and cost per Meta LPV for traffic.
- Store Finder searches are directional and are not campaign-attributed visits or sales.
- Never claim that a click, landing-page view, search, or Get Directions action proves a store visit or sale.

## Retailers and channels
- Confirmed campaign retailers include Huck's, Circle K, and Murphy USA. Limit retailer claims to the supplied campaign evidence.
- Meta is the primary measurable retail-intent channel. LPV and LPV-rate findings are Meta-only.
- Google supports eCommerce and search reporting. StackAdapt CTV/DOOH is impression-led awareness.

## Analysis rules
- Every performance tool requires an initiative. If the user does not specify one, use ecommerce.
- Never blend eCommerce purchase efficiency with Foot Traffic engagement or retail-intent efficiency.
- For Foot Traffic awareness questions, call getVideoPerformance.
- For Foot Traffic destination questions, use getCampaignPerformance and distinguish Homepage / Awareness from Store Locator / Get Directions.
- For eCommerce, conversions mean purchases. For Foot Traffic, tools return zero conversions because visits and store sales are not substantiated.
- Data is available from September 2025.

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

For complex questions, chain tools within one initiative: "How is Circle K awareness doing?" → call getSummary (initiative=foot_traffic, phase=awareness, retailer=circlek) + getVideoPerformance (initiative=foot_traffic, retailer=circlek) together.

## Response style
- Always call a tool before answering performance questions — never guess at numbers
- Lead with purchase efficiency for eCommerce and Retail Intent Signals for Foot Traffic
- Be concise — note retailer differences when meaningful
- Do NOT reproduce raw numbers as markdown tables — the UI renders cards/tables/charts
- When asked about trends, call getSpendTrend — the UI renders a chart automatically`,

    messages: modelMessages,
    stopWhen: stepCountIs(8),

    tools: {
      getSummary: tool({
        description: 'Get initiative-scoped aggregate performance. eCommerce includes purchases, revenue, and ROAS. Foot Traffic includes Retail Intent Signals split into Homepage/Awareness and Store Locator/Get Directions.',
        inputSchema: z.object({
          initiative: initiativeSchema,
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ initiative, phase, retailer, channel, startDate, endDate, days }) =>
          fetchGoodGameChatSummary(initiative ?? 'ecommerce', phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days),
      }),

      getVideoPerformance: tool({
        description: 'Get initiative-scoped Meta video completion performance by campaign. Use primarily for Foot Traffic Homepage/Awareness analysis.',
        inputSchema: z.object({
          initiative: initiativeSchema,
          retailer: retailerSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ initiative, retailer, startDate, endDate, days, limit }) =>
          fetchGoodGameChatVideoPerf(initiative ?? 'ecommerce', retailer ?? 'all', startDate, endDate, days, limit ?? 20),
      }),

      getCampaignPerformance: tool({
        description: 'Get initiative-scoped campaign performance with a destination label. Never compare eCommerce ROAS with Foot Traffic engagement as equivalent outcomes.',
        inputSchema: z.object({
          initiative: initiativeSchema,
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          limit: z.number().optional().describe('Max campaigns. Default: 25.'),
          ...dateRangeSchema,
        }),
        execute: async ({ initiative, phase, retailer, channel, startDate, endDate, days, limit }) =>
          fetchGoodGameChatCampaigns(initiative ?? 'ecommerce', phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days, limit ?? 25),
      }),

      getSpendTrend: tool({
        description: 'Get initiative-scoped daily trend. Leads are Meta landing-page views. Won is purchases for eCommerce and always zero for Foot Traffic because visits and store sales are not substantiated.',
        inputSchema: z.object({
          initiative: initiativeSchema,
          phase: phaseSchema,
          retailer: retailerSchema,
          channel: channelSchema,
          ...dateRangeSchema,
        }),
        execute: async ({ initiative, phase, retailer, channel, startDate, endDate, days }) =>
          fetchGoodGameChatSpendTrend(initiative ?? 'ecommerce', phase ?? 'all', retailer ?? 'all', channel ?? 'all', startDate, endDate, days),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get initiative-scoped Meta ad creative performance. eCommerce creatives are judged by sales metrics; Foot Traffic creatives use Retail Intent Signals.',
        inputSchema: z.object({
          initiative: initiativeSchema,
          retailer: retailerSchema,
          limit: z.number().optional().describe('Top N creatives. Default: 10, max: 20.'),
          ...dateRangeSchema,
        }),
        execute: async ({ initiative, retailer, startDate, endDate, days, limit }) =>
          fetchGoodGameChatMetaCreatives(initiative ?? 'ecommerce', retailer ?? 'all', startDate, endDate, days, limit ?? 10),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
