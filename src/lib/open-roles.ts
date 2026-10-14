export type OpenRoleSection = {
  title: string;
  intro?: string;
  bullets?: string[];
  paragraphs?: string[];
};

export type OpenRole = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  commitment: string;
  growthPath: string;
  compensation: string;
  sections: OpenRoleSection[];
};

export const openRoles: OpenRole[] = [
  {
    slug: 'performance-strategy-analytics-manager',
    title: 'Performance Strategy & Analytics Manager',
    eyebrow: 'Founder-mentored · Client-facing · Hands-on player-coach',
    summary:
      "Take over day-to-day performance strategy, measurement, launch readiness, and delivery prioritization for a defined portfolio of EIC's white-label and platform clients.",
    commitment: 'Approximately 15 hours per week to start',
    growthPath: 'Path to expanded responsibility',
    compensation: '$4,500–$5,500 per month',
    sections: [
      {
        title: 'Mission',
        paragraphs: [
          "Take over day-to-day performance strategy, measurement, launch readiness, and delivery prioritization for a defined portfolio of EIC's white-label and platform clients. The goal is to move the founder from routine client-delivery decisions, diagnosis, and QA into exception review while helping Account Managers communicate clearly and Ad Managers execute the approved strategy correctly.",
          "This is a hands-on growth role, not a reporting-only or hands-off consulting position. We want someone with strong fundamentals, technical curiosity, ownership, and the humility to learn EIC's approach. The Manager must be willing to investigate abnormal performance, enter unfamiliar platforms, debug tracking and integrations, and coach the team through implementation. Responsibility and autonomy will expand as judgment and trust are demonstrated.",
        ],
      },
      {
        title: 'The Pod',
        intro: "The initial 90-day engagement is focused on one assigned pod rather than EIC's entire client roster.",
        bullets: [
          'Account Manager: Owns client relationships, communication, timelines, and coordination.',
          'Ad Manager: Owns campaign builds, trafficking, daily optimization, testing, and routine execution.',
          'Performance Strategy & Analytics Manager: Owns business goals, channel and funnel strategy, weekly priorities, measurement, launch readiness, data quality, and final recommendations.',
        ],
        paragraphs: [
          'The Manager quarterbacks the pod through strategy, prioritization, coaching, standards, and QA. Formal direct reports are not required initially, although people-management responsibility may develop as the role expands.',
        ],
      },
      {
        title: 'Core Responsibilities',
        bullets: [
          'Translate business goals into media strategy, including audience, offer, funnel, channel mix, budget, testing plan, and KPIs tied to client economics.',
          "Set the pod's weekly priorities by identifying the highest-impact risks and opportunities and turning them into a sequenced work queue for Account Managers and Ad Managers.",
          'Detect and diagnose performance problems across campaigns, creative, budgets, search terms, websites, forms, tracking, CRM, integrations, reporting, lead quality, and sales process.',
          'Direct recovery through an execution-ready plan with owners, dependencies, and acceptance criteria, then stay involved until the root cause is corrected and the result is verified in production.',
          'Own launch readiness across strategy, creative, targeting, budget, access, tracking, CRM handoff, reporting, and client approvals. Separate true blockers from work that can safely continue after launch.',
          'Own end-to-end measurement and data flow from ad platforms through websites, forms, call tracking, analytics, CRM, automation, qualified pipeline, closed-won revenue, and ROAS.',
          'Work directly inside platforms when complex setup, debugging, QA, recovery, or training requires it. Routine trafficking and daily optimization remain with the Ad Manager whenever practical.',
          'Lead client strategy conversations, quarterly recaps, media planning, and responsible forecasting using actual business performance, clear assumptions, and known constraints.',
          'Turn founder judgment into repeatable decision rules, QA standards, diagnostic processes, launch criteria, and escalation thresholds.',
        ],
      },
      {
        title: 'What Success Looks Like',
        bullets: [
          'Every account in the pod has an agreed business goal, funnel, KPI hierarchy, source of truth, and prioritized action plan.',
          'Material performance changes are identified early, investigated across the full system, and resolved at the root cause.',
          'Launches have verified tracking, CRM handoff, reporting, and optimization signals before avoidable problems reach the client.',
          'Account Managers know what to communicate, Ad Managers know what to execute and why, and clients understand the strategy and tradeoffs.',
          'Founder involvement moves from routine prioritization, diagnosis, and QA to defined exception review.',
          'Each quarter closes with a clear performance story and an evidence-based next-quarter plan and forecast.',
        ],
      },
      {
        title: 'Required Experience',
        bullets: [
          'Approximately 6–10 years across paid media strategy, account leadership, performance marketing, marketing operations, or related work. Capability and judgment matter more than a rigid year count.',
          'Deep working knowledge of Google Ads and Meta Ads, with sound judgment across channels such as LinkedIn, programmatic, geofencing, and retargeting.',
          'Hands-on experience with GA4, Google Tag Manager, pixels or server-side events, offline conversions, call tracking, and attribution.',
          'Ability to connect websites and forms with CRM, automation, and reporting systems through native integrations, APIs, or webhooks.',
          'Ability to audit campaign builds against strategy, diagnose anomalies, and turn findings into an execution-ready repair plan.',
          'Comfort with browser developer tools, tag debugging, cookie and network inspection, platform diagnostics, and CRM record tracing. Software engineering experience is not required.',
          'Experience translating complex performance into clear client narratives, quarterly plans, and responsible forecasts.',
          'Strong business acumen across conversion rates, sales capacity, CAC, LTV, payback, pipeline, revenue, and ROAS.',
          'Strong convictions loosely held, disciplined QA, clear communication, coachability, and calm ownership under pressure.',
        ],
      },
      {
        title: 'How the Role Grows',
        bullets: [
          "First 30 days: Learn EIC's framework, shadow pod reviews, audit the assigned accounts, and learn the current platforms, commitments, and workflows.",
          'Days 31–60: Prepare weekly priorities, own analysis and recommendations for selected accounts, coach an Ad Manager through implementation, and lead part of a client strategy discussion.',
          "Days 61–90: Run the pod's weekly performance review, priority queue, launch and measurement QA, planning, and client strategy conversations, with the founder reviewing exceptions rather than building the answer.",
          'Long term: Expand account and team ownership as judgment, leverage, and business need are demonstrated.',
        ],
      },
      {
        title: 'Compensation and Structure',
        bullets: [
          'Paid 90-day, part-time engagement averaging approximately 15 hours per week.',
          'Starting compensation of $4,500–$5,500 per month, based on experience and demonstrated capability.',
          'Scope, responsibility, hours, and compensation will be formally reviewed at the end of the engagement.',
          'Path to a larger part-time or full-time role for someone who demonstrates the ability to independently own the pod.',
        ],
      },
      {
        title: 'Hiring Proof Points',
        intro: 'Candidates should be prepared to walk through:',
        bullets: [
          'A system they designed that connected ad spend to qualified pipeline or revenue.',
          'A material performance decline they diagnosed, including how they proved the root cause and validated recovery.',
          'A launch they kept on track despite access, tracking, CRM, reporting, or approval blockers.',
          'A campaign build that did not match strategy and the exact rebuild direction they provided.',
          'A recommendation they changed because CRM or business data contradicted platform data.',
          'A difficult client conversation that turned complex information into a clear decision.',
          'A time they coached an executor, documented the process, and reduced future escalations.',
          'An unfamiliar platform or system they learned quickly and how they verified the solution.',
        ],
      },
    ],
  },
];

export function getOpenRole(slug: string) {
  return openRoles.find((role) => role.slug === slug);
}
