import type { Metadata } from 'next';
import WhiteLabelChannelService, { type ChannelService } from '@/components/WhiteLabelChannelService';

export const metadata: Metadata = {
  title: 'White Label Meta Ads Management for Agencies',
  description: 'Explore EIC’s Facebook and Instagram Ads workflow: funnel planning, audiences, creative tests, frequency, retargeting, Pixel and CAPI QA, and reporting.',
  alternates: { canonical: '/white-label-meta-ads-management' },
  openGraph: {
    title: 'White Label Meta Ads Management | EIC Agency',
    description: 'Detailed Facebook and Instagram fulfillment for agencies, with creative testing, qualified-outcome measurement, and explicit scope boundaries.',
    url: '/white-label-meta-ads-management', images: ['/og-eic-white-label-paid-media.png'],
  },
};

const service: ChannelService = {
  slug: 'white-label-meta-ads-management',
  name: 'White Label Meta Ads Management',
  eyebrow: 'Facebook and Instagram fulfillment under your brand',
  introduction: 'Meta is not paid search with pictures. EIC helps agencies plan Facebook and Instagram campaigns around audience readiness, creative, repeated exposure, and the client’s conversion path. We connect campaign builds and creative tests to lead quality and business feedback instead of treating cheap clicks or a large platform lead count as the finished result.',
  principle: 'Give every audience and creative concept a job.',
  deliverables: [
    'A funnel and audience plan with prospecting, consideration, and conversion roles',
    'Campaign builds and creative variations from approved offers, claims, and source assets',
    'Creative, frequency, placement, and retargeting review with documented next tests',
    'Pixel and Conversion API coordination, conversion QA, and qualified-outcome reporting within scope',
  ],
  readiness: 'We review the offer, buyer definition, budget, creative inventory, landing pages, tracking, CRM, and sales response before proposing spend. A useful Meta plan needs something worth showing and a credible next step after the click or lead form. If the client cannot approve source assets or follow up with inquiries, more distribution alone will not solve the bottleneck.',
  inputs: [
    'Approved brand assets, source footage or photography, offer details, substantiated claims, proof, and creative approvers.',
    'Audience definition, markets, exclusions, customer or prospect data permissions, and known buying objections.',
    'Ad account, Page, Instagram, and relevant business asset access through the approved permission model.',
    'Budget, destination or lead-form requirements, Pixel and server-event access where available, CRM stages, and follow-up ownership.',
  ],
  steps: [
    {
      title: 'Map the funnel before choosing the objective',
      copy: 'Define whether the first job is qualified attention, education, inquiry, purchase, or re-engagement. An educational campaign and a direct-response campaign need different messages and evaluation criteria. Assess the offer and sales cycle before choosing website conversion, native lead form, or another path. A demo-page view, submitted form, accepted lead, and customer stay separate stages.',
      output: 'A funnel map with the objective, audience, message, destination, and success definition for each campaign role.',
    },
    {
      title: 'Plan audiences and exclusions with realistic limits',
      copy: 'Review prospecting options, approved first-party audiences, engaged visitors, and customer exclusions where appropriate and supported. Evaluate broad delivery and audience signals against the offer rather than assuming more targeting controls mean better buyers. List size, permissions, match availability, platform restrictions, and audience overlap can limit what is practical. Do not promise that Meta will precisely identify every B2B job title or account.',
      output: 'An audience and exclusion plan with data dependencies, overlap risks, and the reasoning for each test.',
    },
    {
      title: 'Turn approved source material into learnable creative tests',
      copy: 'Build concepts around a specific problem, outcome, proof point, or objection. Separate the hook, message, format, and call to action so a new variation answers a real question rather than simply changing colors. Adapt approved material to the agreed Facebook and Instagram placements and review mobile readability, safe areas, captions where relevant, and destination consistency. Before judging a concept, inspect how much spend and exposure it actually received. Several ads in one ad set do not create an equal-opportunity test if Meta sends nearly all delivery to one incumbent. Use a controlled experiment or agreed exposure requirements when the question needs a fair comparison. The agency retains final approval of claims and assets.',
      output: 'A creative test brief linking each concept to its audience, funnel role, hypothesis, and approval status.',
    },
    {
      title: 'Coordinate Pixel, CAPI, and conversion-path QA',
      copy: 'Review event names, triggers, business meaning, and the agreed form or purchase journey. Where both browser Pixel and server-side Conversion API events exist, check event IDs and deduplication rather than assuming two event sources equal better measurement. Inspect values, source URLs, and consent dependencies. Coordinate fixes with the site or CRM owner; a new server-side integration is separately scoped, not silently bundled with campaign management.',
      output: 'An event checklist, observed QA results, and named owners for any tracking or integration gaps.',
    },
    {
      title: 'Review creative fatigue and retargeting relevance',
      copy: 'Read reach, frequency, spend, response, onsite quality, and qualified outcomes together. Rising frequency is a diagnostic, not a universal cutoff. Determine whether an ad needs more delivery, a new hook, another proof point, a different destination, or retirement. Retargeting should answer the next buyer question, not endlessly repeat the same booking ad. Evaluate lookback windows, audience size, exclusions, and budget before adding more retargeting layers.',
      output: 'A scale, iterate, watch, or retire decision for concepts, plus the next creative or retargeting hypothesis.',
    },
    {
      title: 'Use sales feedback to judge delivery quality',
      copy: 'Compare platform leads or purchases with the business’s validation process. For lead generation, distinguish duplicates, spam, real but poor-fit inquiries, sales-accepted leads, and opportunities. Review placements and funnel stages when inexpensive results fail downstream. Where approved CRM feedback is reliable, evaluate a qualified-outcome signal; do not train toward a label that sales uses inconsistently or treat a small sample as proof.',
      output: 'A quality-based optimization recommendation and a clear statement of what remains unmeasured.',
    },
  ],
  measurement: [
    'Client-ready dashboards and documented updates separate delivery from business impact. Spend, reach, frequency, clicks, and landing-page views explain distribution; engaged visits, completed forms, valid leads, opportunities, and revenue explain different downstream stages. Creative reporting should preserve the concept and funnel role so your agency can explain why a test continues or changes.',
    'Meta-attributed conversions, website analytics, and CRM outcomes will not always match. Attribution windows, modeled activity, consent, cross-device behavior, and sales lag can change the view. We document limitations and reconcile available evidence rather than promising perfect attribution or adding every platform’s claimed revenue into one total.',
    'Your agency receives the rationale, material changes, production needs, and recommended next actions under the agreed cadence. It keeps the client agreement, relationship, and final approvals. Changes to budget, offers, data use, or creative claims require the approved owner; a dashboard does not replace that accountability.',
  ],
  scope: [
    'New CAPI or CRM integrations, server-side event engineering, offline qualified-outcome feedback, and custom analytics pipelines beyond agreed QA and coordination.',
    'Landing-page builds, ecommerce changes, new lead-routing automations, or repairs to the sales follow-up process.',
    'Original on-site filming, creator or influencer sourcing, extensive new production, or assets beyond the agreed creative deliverables.',
    'Catalog and product-feed work, additional platforms such as TikTok or LinkedIn, or new campaign formats and markets outside the approved plan.',
  ],
  evidence: {
    title: 'PrePass: qualification before top-line lead volume',
    copy: 'EIC’s published PrePass case study describes a shared qualified-lead definition centered on companies with large truck fleets, campaign restructuring, and dashboards tied to business outcomes. It supports the quality-first reporting approach described here. The study is not presented as a Meta-only experiment or proof of a universal Meta result.',
    href: '/case-studies/prepass-business-intelligence-growth',
  },
  resources: [
    { title: 'Meta Conversion API: event hierarchy and deduplication', href: '/resources/b2b-meta-attribution-CAPI' },
    { title: 'When to refresh ad creative: signals, not a fixed calendar', href: '/resources/how-often-update-digital-ad-creative' },
    { title: 'White-label paid media pricing and scope', href: '/resources/pricing-white-label-paid-media' },
  ],
  questions: [
    { question: 'Does Meta management cover both Facebook and Instagram?', answer: 'Facebook and Instagram are the core Meta inventory considered in this workflow. The actual placements, formats, objectives, and asset requirements follow the approved account plan; every placement is not automatically appropriate for every offer.' },
    { question: 'Do we need to supply finished creative?', answer: 'Not necessarily. EIC can develop campaign-ready concepts and variations from approved source material within the agreed creative scope. Your agency and client supply brand standards, offers, proof, and substantiated claims, and retain final approval. Original filming, creator sourcing, and expanded production are scope-dependent.' },
    { question: 'Is Conversion API implementation automatically included?', answer: 'No. Pixel and CAPI review, conversion QA, and coordination are part of the agreed measurement workflow, but a new integration or custom server-side implementation needs its own scope, access, privacy review, and technical owner. Existing browser and server events should be checked for deduplication.' },
    { question: 'How often will creative be replaced?', answer: 'There is no universal replacement interval. Review spend, reach, frequency, response, onsite quality, lead quality, and production capacity together. The recommendation may be to scale, iterate, watch, or retire a concept. The reporting and production cadence is agreed before launch rather than promised as unlimited creative.' },
    { question: 'Can you guarantee qualified leads or revenue from Meta?', answer: 'No. Audience fit, offer, creative, budget, measurement, follow-up, and sales capacity all affect results. We define the test and qualification criteria, document the evidence, and recommend the next action without guaranteeing a lead volume, cost, or revenue outcome.' },
  ],
  other: { name: 'White Label Google Ads Management: intent, keywords, and search quality', href: '/white-label-google-ads-management' },
};

export default function WhiteLabelMetaAdsPage() {
  return <WhiteLabelChannelService service={service} />;
}
