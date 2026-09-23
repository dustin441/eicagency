import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

// ─── Quiz Data ───────────────────────────────────────────────────────────────

export const sections = [
  {
    id: 'audience',
    label: 'Audience Clarity',
    description: "Do you know exactly whom you're targeting?",
    questions: [
      'Do you have a documented Ideal Customer Profile (ICP) with specific demographics, firmographics, or psychographics?',
      "Can you describe your target customer's day-to-day challenges in their own words?",
      'Do you know which platforms and channels your ideal customer uses to research purchases?',
      'Have you validated your audience definition against data from actual paying customers?',
    ],
    risk: 'Without a defined audience, ad platforms optimize toward the wrong people — burning budget on clicks that will never convert.',
    fix: 'Document a single ICP before launching. Interview 3–5 current customers, identify shared traits, and use that profile to set targeting parameters.',
  },
  {
    id: 'content',
    label: 'Content & Creative',
    description: 'Do you have enough compelling assets to test?',
    questions: [
      'Do you have at least 3–5 distinct ad creatives ready to test right now (images, videos, or copy variants)?',
      'Do you have customer testimonials, case studies, or social proof available to use in ads?',
      'Can your team produce new creative assets within two weeks when a campaign needs a refresh?',
      'Do you have a clear, specific value proposition that fits in a single headline or 15-second video?',
    ],
    risk: "Without a content engine, campaigns stall after the first creative set burns out — and there's nothing left to test against.",
    fix: 'Build a minimal creative library before launch: 2 static images, 1 video or UGC clip, and 3 headline variations. Establish a monthly refresh cadence.',
  },
  {
    id: 'alignment',
    label: 'Marketing & Sales Alignment',
    description: 'Is there a clear process for following up with leads?',
    questions: [
      'Does your sales team know which campaigns are currently running and what offer prospects have seen?',
      'Are new leads followed up with within 24 hours, consistently?',
      'Is there a defined handoff process — routing, ownership, and next steps — once a lead comes in?',
      'Does sales have access to the same landing pages and assets that prospects encounter in your ads?',
    ],
    risk: 'Leads that fall into an unmanaged handoff are budget wasted. Marketing can generate demand; a misaligned sales process destroys it.',
    fix: 'Map the lead handoff from form submission to first sales contact. Agree on response SLAs and equip sales with the messaging prospects already saw.',
  },
  {
    id: 'qualification',
    label: 'Lead Qualification',
    description: 'Can you distinguish inquiries from sales-ready opportunities?',
    questions: [
      'Do marketing and sales share a written definition of what counts as a "qualified lead"?',
      'Do you use any form of lead scoring, qualification questions, or disqualification criteria?',
      'Can you reliably distinguish between a Marketing Qualified Lead (MQL) and a Sales Qualified Lead (SQL)?',
      'Do you track and review lead-to-close rates by source or campaign?',
    ],
    risk: 'Without shared qualification criteria, sales wastes time on bad-fit leads while blaming marketing — and marketing has no signal to improve targeting.',
    fix: 'Define your MQL and SQL in one shared document. Add 2–3 qualifying questions to your lead form or first follow-up call to filter fit before sales engages.',
  },
  {
    id: 'reporting',
    label: 'Reporting & Attribution',
    description: 'Can you connect ad spend to pipeline and revenue?',
    questions: [
      'Do you know your current cost per lead (CPL) or cost per acquisition (CPA) by channel?',
      'Can you trace closed revenue back to the specific campaign or ad that generated the original lead?',
      'Do you have conversion tracking (pixel, tag, or server-side) properly set up and verified on your website?',
      'Do you review ad performance metrics — not just impressions and clicks, but leads and pipeline — at least weekly?',
    ],
    risk: "Without attribution, you're optimizing blind. You'll scale what feels good instead of what's actually generating revenue.",
    fix: 'Install conversion tracking before spending a dollar. Set up a simple weekly report that connects campaign spend to leads and, eventually, to closed deals.',
  },
];

export type Answers = Record<string, Record<number, boolean>>;

export function categoryScore(answers: Answers, sectionId: string, total: number) {
  const a = answers[sectionId] ?? {};
  return Object.values(a).filter(Boolean).length;
}

export function scoreColor(score: number, max: number): 'green' | 'yellow' | 'red' {
  const pct = score / max;
  if (pct >= 0.75) return 'green';
  if (pct >= 0.5) return 'yellow';
  return 'red';
}

export const colorConfig = {
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Strong',
    icon: CheckCircle2,
  },
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Needs Work',
    icon: AlertCircle,
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    label: 'At Risk',
    icon: XCircle,
  },
};

export const SCORECARD_ANSWERS_KEY = 'eic-scorecard-answers';
