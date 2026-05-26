import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  fetchChatCampaignPerformance,
  fetchChatMetaCreatives,
  fetchChatGoogleCreatives,
  fetchChatBudgetPacing,
} from '@/services/chat-analytics';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { messages } = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `You are an AI marketing analyst for PrePass, a B2B SaaS platform in the trucking and transportation safety industry. You help EIC Agency staff and PrePass stakeholders understand performance and make data-driven creative decisions.

PrePass runs three audience segments:
- SMB: Small/medium fleet operators — $110,000/month budget
- ABM: Account-based marketing for enterprise fleets — $10,000/month budget
- FD360: FuelDash 360 product campaigns — $25,000/month budget

Analysis framework (work top-down):
1. Campaign level: evaluate Cost/MQL → Cost/SQL → Cost/Won. Google drives funnel conversion; Meta drives top-of-funnel lead volume.
2. Creative level: use CPL as the efficiency proxy since MQL/SQL/Won attribution is not available per ad. Reference the parent campaign's funnel performance for context.

Rules:
- Always call a tool to fetch fresh data before answering any performance question — never guess at numbers
- Lead with the actionable insight, then support with data
- Be concise — the panel is narrow. Aim for 3–5 sentences of analysis, bullets for lists. Skip preambles.
- Cost Per Won is the north star. Cost Per Lead is the creative-level proxy.
- Do NOT reproduce data from tool results as markdown tables — the UI already renders that data as cards or tables. Reference it briefly ("the top ad", "as you can see above") and move to insight.

Creative display rules (CRITICAL):
- When asked to "show", "display", "render", "show me that ad", "can you show me", or anything asking to see a creative visually — ALWAYS call getMetaCreativePerformance or getGoogleCreativePerformance. Even if you already called it earlier in the conversation, call it again — the UI only renders cards from the most recent tool call. Never say "the card is already shown above."
- Never generate markdown image syntax (![text](url)) in your response. Never include raw image URLs or CDN links in your text.
- After calling a creative tool, write 2–3 sentences pointing out what to notice. The rendered cards speak for themselves — do not repeat the ad copy or metrics in text.

Today is ${today}.`,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      getCampaignPerformance: tool({
        description: 'Get campaign-level marketing performance with full funnel metrics (spend, leads, MQLs, SQLs, closed-won). Use this first before looking at creatives to establish which campaigns are efficient.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Audience segment filter. Default: all'),
          platform: z.enum(['Google', 'Meta', 'all']).optional().describe('Ad platform. Default: all'),
          days: z.number().optional().describe('Days to look back. Default: 30'),
        }),
        execute: async ({ focus, platform, days }) =>
          fetchChatCampaignPerformance(focus ?? 'all', platform ?? 'all', days ?? 30),
      }),

      getMetaCreativePerformance: tool({
        description: 'Get Meta (Facebook/Instagram) ad creative performance ranked by cost per lead. Returns ad images, video URLs, headlines, primary copy, and metrics.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment filter applied to campaign name. Default: all'),
          days: z.number().optional().describe('Days to look back. Default: 30'),
          limit: z.number().optional().describe('Top N creatives to return. Default: 5'),
        }),
        execute: async ({ focus, days, limit }) =>
          fetchChatMetaCreatives(focus ?? 'all', days ?? 30, limit ?? 5),
      }),

      getGoogleCreativePerformance: tool({
        description: 'Get Google search ad creative performance — headlines, descriptions, and metrics ranked by results.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360', 'all']).optional().describe('Segment filter applied to campaign name. Default: all'),
          days: z.number().optional().describe('Days to look back. Default: 30'),
          limit: z.number().optional().describe('Top N ads to return. Default: 5'),
        }),
        execute: async ({ focus, days, limit }) =>
          fetchChatGoogleCreatives(focus ?? 'all', days ?? 30, limit ?? 5),
      }),

      getBudgetPacing: tool({
        description: 'Get current-month budget pacing for PrePass segments — shows spend vs monthly budget by platform.',
        inputSchema: z.object({
          focus: z.enum(['ABM', 'SMB', 'FD360']).optional().describe('Specific segment (omit for all three)'),
        }),
        execute: async ({ focus }) => fetchChatBudgetPacing(focus),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
