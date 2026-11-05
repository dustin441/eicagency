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
    eyebrow: 'Full-time · Hands-on strategist · Growing leadership responsibility',
    summary:
      "Own paid-media execution and account strategy for a defined client portfolio. Work directly with EIC's founder to align on ROI, measurement, and decision-making, then take on more strategic leadership as execution support expands.",
    commitment: 'Full-time from day one · 100% remote',
    growthPath: 'Execution ownership to strategic leadership',
    compensation: '$90,000 annual base salary',
    sections: [
      {
        title: 'The Opportunity',
        paragraphs: [
          "EIC is hiring a full-time, hands-on performance strategist, not a fractional advisor or a campaign operator waiting for instructions. You will personally manage campaigns, own account-level recommendations, and work directly with the founder to develop a shared approach to driving measurable client returns.",
          "There is a real portfolio to own from the start. Initially, execution will be a substantial part of your week alongside strategy, analysis, and performance reviews. As additional Ad Manager support joins, you will transfer appropriate execution responsibilities and spend more time on strategy, coaching, and quality control. This is the intended direction of the role, with the pace based on client needs, capacity, and demonstrated readiness.",
          "The purpose is to move routine delivery decisions, diagnosis, and QA off the founder's plate so the founder can focus more on sales and business growth. We want an experienced marketer who is ready to build a long-term career inside EIC, not add another client to an independent consulting practice.",
        ],
      },
      {
        title: 'Location and Working Relationship',
        bullets: [
          'This role is 100% remote, with no required office days or recurring in-person attendance. Phoenix-metro location is a plus, not a requirement: local teammates can meet up with the founder occasionally by mutual agreement.',
          'You will need reliable working-day availability for account ownership, team collaboration, and client needs. This is a full-time role, not an evenings-and-weekends side engagement.',
          "Work directly with the founder to align on measurement, campaign strategy, prioritization, and how we prove that a change worked. We value thoughtful disagreement backed by evidence, not automatic agreement.",
        ],
      },
      {
        title: 'What You Own Initially',
        bullets: [
          'Personally own campaign builds, trafficking, pacing, optimization, testing, and maintenance for an assigned portfolio across Google Ads and Meta Ads.',
          'Translate business goals into account strategy: audience, offer, funnel, channel mix, budgets, test priorities, and KPIs tied to client economics.',
          'Identify material changes early, investigate the cause, propose a clear next action, implement approved changes, and verify the result.',
          'Prepare a sequenced weekly priority queue and communicate what changed, why it changed, what happened, and what decision or support is needed.',
          'Own launch readiness within the agreed client scope, including campaign QA, creative and budget approvals, optimization signals, and measurement checks.',
          'Partner with Account Managers on client communication and timelines, while retaining responsibility for your performance recommendations and execution.',
        ],
      },
      {
        title: 'Measurement and Strategic Judgment',
        bullets: [
          'Connect campaign performance to qualified leads, pipeline, sales, revenue, and ROAS where the client data allows it. Distinguish platform-reported results from verified business outcomes.',
          'Investigate discrepancies across ad platforms, GA4, Google Tag Manager, websites, forms, call tracking, CRM records, and reporting systems.',
          'Work hands-on to debug and QA tracking or integrations when required by the assigned scope. When another team owns the fix, provide evidence, a clear handoff, and acceptance criteria, then verify resolution.',
          'Separate campaign problems from creative, website, lead-quality, sales-process, and measurement problems. Do not assume that every decline requires another ad change.',
          'Develop clear performance narratives, responsible forecasts, and recommendations with explicit assumptions and constraints.',
          "Turn the judgment you develop with the founder into reusable decision rules, QA standards, diagnostic processes, and escalation thresholds.",
        ],
      },
      {
        title: 'How the Role Evolves',
        bullets: [
          "First 30 days: Learn the portfolio and EIC's operating approach, take ownership of agreed execution responsibilities, establish account priorities, and work through real strategy and measurement decisions with the founder.",
          'Days 31–60: Independently run more account-level analysis, recommendations, and execution. Demonstrate that agreed measurement and campaign principles carry forward without repeated direction. Help evaluate additional Ad Manager candidates as hiring proceeds.',
          'Days 61–90: Own the assigned portfolio with the founder increasingly reviewing exceptions rather than constructing the plan. As execution support becomes available, help onboard that person, delegate defined accounts or tasks, and guide implementation and QA.',
          'Beyond the initial period: Expand strategic ownership and team guidance as trust, results, staffing, and business needs support it. This is not a promise of an immediate hands-off director role.',
        ],
      },
      {
        title: 'Experience and Mindset',
        bullets: [
          'Approximately eight or more years of relevant paid-media and performance-marketing experience is preferred. Depth of ownership, judgment, and demonstrated results matter more than a rigid year count.',
          'Deep, recent hands-on experience in Google Ads and Meta Ads, including campaign structure, testing, optimization, pacing, and troubleshooting.',
          'Agency or multi-client experience, including prior agency experience followed by an in-house brand role, is especially relevant.',
          'Working experience with GA4, Google Tag Manager, attribution, pixels or server-side events, offline conversions, call tracking, and CRM-connected measurement.',
          'Ability to investigate data flow across websites, forms, CRM, automation, and reporting, including native integrations, APIs, or webhooks. Software engineering experience is not required.',
          'Business judgment across conversion rates, sales capacity, CAC, LTV, payback, pipeline, revenue, and ROAS.',
          'Clear reasoning, disciplined QA, coachability, and calm ownership. You can explain and defend a recommendation, revise it when evidence changes, and apply what you learn to the next account.',
          'Interest in coaching other operators and building a long-term role within EIC while remaining willing to get into the platforms.',
        ],
      },
      {
        title: 'What Success Looks Like',
        bullets: [
          'Assigned accounts have clear business goals, measurement boundaries, priorities, and ownership.',
          'Campaign work is completed accurately and independently, with performance problems identified and investigated before they become avoidable client escalations.',
          'Recommendations explain the business impact, the supporting evidence, and how success will be verified.',
          'Founder time shifts from directing tasks and rebuilding analyses toward strategic discussion and defined exception review.',
          'As support joins, execution is handed off clearly and you retain accountability for direction and quality.',
        ],
      },
      {
        title: 'Compensation and Structure',
        bullets: [
          'Full-time from the start, with an annual base salary of $90,000.',
          'The first 90 days are a paid mutual evaluation period within the full-time role, not a part-time or fractional trial.',
          'The evaluation focuses on independent account ownership, sound execution, strategic reasoning, collaboration, measurement discipline, and verified client outcomes. A short-term ROAS change is not the sole measure of fit.',
          'At the 90-day review, we will assess fit, portfolio ownership, support needs, and the next stage of strategic and team responsibility.',
        ],
      },
      {
        title: 'Hiring Proof Points',
        intro: 'Be prepared to walk through work you personally owned and discuss an anonymized account scenario with us:',
        bullets: [
          'An account where you chose the strategy, implemented the work, and verified the business outcome without a director constructing the plan.',
          'A performance decline you investigated across campaigns and measurement, including how you proved the cause and validated recovery.',
          'A time CRM or business data contradicted platform results and changed your recommendation.',
          'A launch or campaign rebuild you personally managed through constraints and QA.',
          'A thoughtful disagreement about strategy or measurement, how you resolved it, and what changed afterward.',
          'A time you coached an operator or documented a process so the team needed less supervision.',
        ],
      },
    ],
  },
];

export function getOpenRole(slug: string) {
  return openRoles.find((role) => role.slug === slug);
}
