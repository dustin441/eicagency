import type { Metadata } from 'next';
import WhiteLabelChannelService, { type ChannelService } from '@/components/WhiteLabelChannelService';

export const metadata: Metadata = {
  title: 'White Label Google Ads Management for Agencies',
  description: 'See EIC’s Google Ads fulfillment workflow: intent mapping, keyword structure, search terms, negatives, bidding, conversion QA, and agency-ready reporting.',
  alternates: { canonical: '/white-label-google-ads-management' },
  openGraph: {
    title: 'White Label Google Ads Management | EIC Agency',
    description: 'A detailed paid search operating model for agencies: readiness, builds, optimization, measurement, and scope boundaries.',
    url: '/white-label-google-ads-management', images: ['/og-eic-white-label-paid-media.png'],
  },
};

const service: ChannelService = {
  slug: 'white-label-google-ads-management',
  name: 'White Label Google Ads Management',
  eyebrow: 'Paid search fulfillment under your agency brand',
  introduction: 'Add Google Ads delivery without treating every search as equally valuable. EIC supports account audits, search strategy, campaign builds, query review, bidding, and reporting behind your agency. The work connects what people search for to an approved offer, a relevant destination, and a conversion the client can actually validate.',
  principle: 'Capture intent. Verify the outcome. Explain the decision.',
  deliverables: [
    'An account plan organized around buyer intent, business priorities, and budget constraints',
    'Approved search campaigns with keyword, ad, destination, and conversion checks',
    'Search-term and negative-keyword review tied to relevance and lead quality',
    'Documented optimization decisions and client-ready dashboard updates',
  ],
  readiness: 'Before recommending a launch or rebuild, we review the offer, audience, geography, available budget, approved claims and creative, landing experience, tracking, CRM stages, and sales follow-up. Existing spend is not proof of readiness. If form submissions cannot be validated or the destination cannot support the offer, the first recommendation may be a readiness sprint rather than more traffic.',
  inputs: [
    'Account access and change history; business priorities, service areas, exclusions, and seasonal constraints.',
    'Approved offer, brand language, proof, landing pages, and the person responsible for final approvals.',
    'Budget context and a clear distinction between media spend, management, and any implementation work.',
    'Form and call paths, analytics access, CRM qualification definitions, and sales feedback on real inquiries.',
  ],
  steps: [
    {
      title: 'Audit the account and map commercial intent',
      copy: 'We examine existing campaigns, search terms, destinations, conversion settings, and budget allocation before preserving or replacing the structure. Separate searches for the client’s brand from non-brand category, problem, and solution demand. Assess competitor or research-led terms on their own merits rather than assuming all search volume belongs in an acquisition campaign.',
      output: 'What to keep, rebuild, exclude, or investigate; the intended role of brand and non-brand coverage.',
    },
    {
      title: 'Build keyword and campaign structure around the offer',
      copy: 'Group keywords where they share a meaningful intent and destination. Match types, geographic controls, campaign boundaries, and budgets should support that intent without fragmenting a small account into cells that cannot learn. Evaluate expansion against actual search demand and operational capacity; a larger keyword list is not a substitute for relevant demand.',
      output: 'A campaign map showing intent groups, proposed keywords, exclusions, destinations, and budget priorities.',
    },
    {
      title: 'Align search ads, assets, and landing pages',
      copy: 'Write search-ad variations from approved claims and the buyer’s question. Review relevant assets, final URLs, mobile usability, form or call behavior, and consistency between the ad and the page. Flag missing proof, confusing next steps, or a mismatch between a broad homepage and a specific search. Landing-page diagnosis is part of the review; rebuilding the website is not automatically included.',
      output: 'Approval-ready ads and a launch checklist, with destination fixes assigned to an owner.',
    },
    {
      title: 'QA conversion actions before bidding toward them',
      copy: 'Check which actions are primary bidding signals and which are diagnostic. Test the agreed form, call, booking, or purchase path and inspect duplicate triggers, values, and source definitions. A page view is not a qualified lead. CRM feedback and offline imports are evaluated only when permissions, identity, qualification rules, and data reliability support them; custom implementation is scoped separately.',
      output: 'An event hierarchy, tested conversion paths, and any unresolved measurement dependencies.',
    },
    {
      title: 'Review search terms, negatives, and spend quality',
      copy: 'Use the search terms available in Google Ads to inspect what the account actually matched, not just the keywords selected at build time. Evaluate irrelevant queries, wrong geographies, ambiguous intent, and repeated poor-fit inquiries. Add negatives at the appropriate level without accidentally excluding valuable demand. Platform query visibility is incomplete, so compare query evidence with landing behavior and sales feedback.',
      output: 'Query and negative changes, their rationale, and the follow-up evidence needed to judge them.',
    },
    {
      title: 'Adjust bids and budgets with a qualified-outcome lens',
      copy: 'Evaluate bidding against conversion quality, usable signal volume, budget, and business economics. Do not assume automated bidding can fix a contaminated conversion goal or that changing targets creates demand. Review brand and non-brand separately so inexpensive brand conversions do not conceal weak acquisition. Document material changes and allow the account enough representative delivery before declaring a test successful or unsuccessful.',
      output: 'A bounded next action: maintain, test, reallocate, repair tracking, or pause, with the reason recorded.',
    },
  ],
  measurement: [
    'Your agency receives a dashboard and documented updates that connect spend, impressions, clicks, search intent, onsite behavior, conversions, and qualified outcomes where the sources support them. Brand and non-brand remain separate evaluation lenses. The review explains what changed and which constraint the next action addresses.',
    'Platform conversions, analytics events, CRM-qualified leads, opportunities, and revenue are different measures. Reporting uses consistent periods and explains source gaps, conversion lag, and attribution differences instead of promising a perfect revenue match. Where CRM data is unavailable, we label the limitation rather than manufacture a qualified-lead figure.',
    'Your agency owns the client relationship, commercial agreement, and final approvals. EIC supplies the delivery analysis and recommendations under the agreed communication model. Budget changes, new campaign types, creative claims, and implementation dependencies have explicit approval owners.',
  ],
  scope: [
    'CRM integrations, call-tracking implementation, enhanced conversion setup, and offline conversion imports beyond the agreed QA scope.',
    'Landing-page design, development, form rebuilding, or changes to the client’s sales workflow.',
    'Shopping, Merchant Center and feed remediation, Performance Max, Display, Demand Gen, or YouTube campaigns. Each needs its own inventory, asset, measurement, and budget assessment.',
    'Additional markets, extensive new creative production, or broader analytics engineering not covered by the management agreement.',
  ],
  evidence: {
    title: 'Chamfr: product-level structure and parallel validation',
    copy: 'EIC’s published Chamfr case study describes separating campaigns by product category, expanding beyond Shopping into Search and Performance Max, and comparing new campaigns alongside the legacy structure. The relevant lesson is the use of structure, controlled validation, and product-level visibility, not a promise that every search account should copy that channel mix.',
    href: '/case-studies/chamfr-roas-growth',
  },
  resources: [
    { title: 'Search-to-social planning: give each channel a job', href: '/resources/eic-search-to-social-playbook' },
    { title: 'Hiring a media buyer vs. white-label paid media', href: '/resources/hiring-vs-white-label-paid-media' },
    { title: 'White-label paid media pricing and scope', href: '/resources/pricing-white-label-paid-media' },
  ],
  questions: [
    { question: 'Can EIC take over an existing Google Ads account?', answer: 'An existing account can be reviewed for takeover or restructuring. We first inspect access, campaign history, search terms, conversion definitions, landing pages, and business constraints. The recommendation may preserve useful work, rebuild specific areas, or address readiness gaps before changing spend.' },
    { question: 'Are Performance Max, Shopping, and YouTube included?', answer: 'Not automatically. The core workflow on this page is paid search management. Performance Max, Shopping, YouTube, feeds, and other inventory are assessed and scoped separately according to audience, budget, creative assets, product data, and measurement readiness.' },
    { question: 'Will you optimize for leads or qualified opportunities?', answer: 'The goal should reflect the client’s economics, but bidding can only use signals that are reliable and available. We distinguish forms and calls from validated leads and opportunities. Qualified-outcome optimization and offline imports require stable stage definitions, identity, permissions, and sufficient usable data; their implementation is scope-dependent.' },
    { question: 'Is there a universal launch timeline or guaranteed cost per lead?', answer: 'No. Readiness, approvals, available demand, competition, budget, and tracking affect the plan. The account review establishes dependencies and a bounded test rather than guaranteeing launch dates, lead costs, rankings, or revenue.' },
  ],
  other: { name: 'White Label Meta Ads Management: audiences, creative, and retargeting', href: '/white-label-meta-ads-management' },
};

export default function WhiteLabelGoogleAdsPage() {
  return <WhiteLabelChannelService service={service} />;
}
