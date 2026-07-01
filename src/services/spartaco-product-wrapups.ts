import { fetchSpartacoProductData, type ProductPerformanceRow, type ProductTimeSeriesPoint, type TimeSeriesGrain, type TrafficBreakdownRow } from './spartaco-product-analytics';
import { fetchSpartacoMetaAds, type SpartacoFilterParams, type SpartacoMetaAd } from './spartaco-analytics';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

export type WrapupPeriodKey = 'before' | 'during' | 'after';

export type SpartacoWrapupConfig = {
  slug: string;
  brand: string;
  product: string;
  parentProduct: string;
  campaignGroupName: string;
  campaignNames: string[];
  sourceMediumPagePaths: string[];
  sourceMediumScopedPageRules?: {
    /**
     * GA4 page_path to include only when the optional source/medium/channel
     * constraints below also match. This is used for query-filtered category
     * pages where GA4 stores only the base path, e.g.
     * /products?_product_categories=long-handle-tools is stored as /products.
     */
    pagePath: string;
    sources?: string[];
    mediums?: string[];
    channelGroups?: string[];
    start?: string;
    end?: string;
    label?: string;
  }[];
  campaignStart: string;
  campaignEnd: string;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  status: 'Ready for Review' | 'Draft';
  executiveSummary: string;
  canClaim: string[];
  cannotClaim: string[];
  recommendations: string[];
  caveats: string[];
  emailSearchTerms?: string[];
};

export type WrapupPeriod = {
  key: WrapupPeriodKey;
  label: string;
  start: string;
  end: string;
  summary: ProductPerformanceRow;
};

export type LeadCaptureBreakdownRow = {
  key: 'facebook_lead_ads' | 'onsite_google_ads' | 'other_paid';
  label: string;
  description: string;
  impressions: number;
  clicks: number;
  cost: number;
  leads: number;
  cpl: number | null;
  campaigns: string[];
};

export type SpartacoProductWrapup = {
  config: SpartacoWrapupConfig;
  periods: WrapupPeriod[];
  fullWindowTimeSeries: ProductTimeSeriesPoint[];
  fullWindowTimeSeriesGrain: TimeSeriesGrain;
  sourceMediumRows: TrafficBreakdownRow[];
  emailDetails: {
    id: number;
    emailId: string | null;
    date: string;
    name: string;
    subjectLine: string;
    totalSent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
    relevance: 'Product-specific' | 'Related Ronin context';
  }[];
  metaAds: SpartacoMetaAd[];
  outcomeAttribution: {
    totalTrackedLeads: number;
    paidTrackedLeads: number;
    nonPaidTrackedLeads: number | null;
    totalOnlineSales: number;
    paidAttributedSales: number;
    totalSessions: number;
    paidSessions: number;
    haloSessions: number;
    totalEngagedSessions: number;
    paidEngagedSessions: number;
    haloEngagedSessions: number;
  };
  emailBenchmark: {
    productSent: number;
    productOpenRate: number;
    productClickRate: number;
    productClicks: number;
    comparableProducts: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  paidOverview: {
    impressions: number;
    clicks: number;
    ctr: number;
    cost: number;
    cpc: number;
    leads: number;
    cpl: number;
    revenue: number;
    purchases: number;
    roas: number;
    benchmarkCpl: number | null;
    benchmarkProducts: number;
    cplDelta: number | null;
    cplRank: number | null;
  };
  leadCaptureBreakdown: LeadCaptureBreakdownRow[];
  gscLift: {
    duringVsBeforeImpressions: number | null;
    afterVsDuringImpressions: number | null;
    duringVsBeforeClicks: number | null;
    afterVsDuringClicks: number | null;
    duringVsBeforeKeywords: number | null;
    afterVsDuringKeywords: number | null;
  };
};

const BASE_PARAMS: Omit<SpartacoFilterParams, 'start' | 'end' | 'compStart' | 'compEnd'> = {
  channel: 'all',
  brand: 'Ronin',
  campaign: 'all',
  focus: 'all',
  product: 'Material Lifting',
  channelGroup: 'all',
  sourceMedium: 'all',
};

export const SPARTACO_WRAPUPS: SpartacoWrapupConfig[] = [
  {
    slug: 'ronin-material-lifting-2026-04-23',
    brand: 'Ronin',
    product: 'Material Lifting',
    parentProduct: 'Material Lifting',
    campaignGroupName: 'Ronin Material Lifting — Apr/May 2026',
    campaignNames: [
      '[LEAD] 4-20: Ronin-Material Lifting',
      '[SALES] 4-20: Ronin-Material Lifting',
    ],
    sourceMediumPagePaths: [
      '/lp/ronin-tl-power-ascender-material-handling',
    ],
    campaignStart: '2026-04-23',
    campaignEnd: '2026-05-22',
    beforeStart: '2026-03-26',
    beforeEnd: '2026-04-22',
    afterStart: '2026-05-23',
    afterEnd: '2026-06-19',
    status: 'Ready for Review',
    executiveSummary:
      'The Ronin Material Lifting campaign clearly increased measurable landing-page activity while marketing was live. The campaign generated 215K+ paid impressions, 5.3K+ paid clicks, 138 tracked conversions/leads, 3.3K+ campaign landing-page GA4 sessions, 1.3K+ engaged sessions, and one product-specific Act-On email with 15K+ sends and a 9% click rate during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, GSC, and online sales. The story is before/during/after marketing impact on campaign landing-page attention, traffic, engagement, leads, and online sales — not offline/distributor sales.',
    canClaim: [
      'Paid media created a clear measurable awareness and traffic lift while the campaign was live.',
      'Campaign landing-page sessions and engaged sessions increased during the campaign period.',
      'Tracked leads/conversions occurred while media was active.',
      'Act-On email added a measurable owned-channel touchpoint for the product campaign.',
      'Campaign landing-page traffic dropped back down after the campaign ended, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as before/during/after marketing impact: more eyeballs, more traffic, more engaged sessions, tracked leads, and online sales where available.',
      'For future product campaigns, keep campaign, email, social, and landing-page naming consistent so product attribution stays automatic.',
      'If Act-On creative links or email HTML become available later, add direct preview links; for now, show subject-line context plus performance by email.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
      'Act-On and social attribution require consistent product naming/tagging; missing attributed rows should be treated as a data-coverage caveat, not proof that those channels did nothing.',
    ],
  },
  {
    slug: 'huskie-new-cutting-tools-2026-01-07',
    brand: 'Huskie',
    product: 'New Cutting Tools',
    parentProduct: 'New Cutting Tools',
    campaignGroupName: 'Huskie New Cutting Tools — Jan/Feb 2026',
    campaignNames: [
      '[LEAD] 01-26: Huskie New Cutting Tools',
      '[LEAD] P.Max | 01-26: Huskie New Cutting Tools',
    ],
    sourceMediumPagePaths: [
      '/lp/new-cutting-tools',
    ],
    campaignStart: '2026-01-27',
    campaignEnd: '2026-02-20',
    beforeStart: '2025-12-30',
    beforeEnd: '2026-01-26',
    afterStart: '2026-02-21',
    afterEnd: '2026-03-20',
    status: 'Draft',
    executiveSummary:
      'The Huskie New Cutting Tools campaign increased measurable digital demand for the campaign landing page and product-specific lead activity while marketing was live. The campaign generated 320K+ paid impressions, 5.6K+ paid clicks, 541 tracked leads/conversions, 412 campaign landing-page GA4 sessions, 260 engaged sessions, and one product-specific Act-On email with 6K+ sends during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, GSC, social, and online sales. The story is marketing-driven awareness, traffic, engagement, and lead activity — not offline/distributor sales.',
    canClaim: [
      'Paid media increased measurable reach, clicks, and tracked lead activity for the campaign.',
      'Campaign landing-page sessions and engaged sessions increased during the campaign period versus the post-campaign window.',
      'The campaign generated product-specific tracked leads/conversions while media was active.',
      'Act-On email added a measurable owned-channel touchpoint for the product campaign.',
      'Paid activity and tracked leads dropped materially after the campaign window, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a scaled demand-generation campaign: paid reach, clicks, tracked leads, landing-page engagement, and email support.',
      'For future Huskie launches, keep Monday item names, ad campaign names, email names, and landing-page URLs aligned so product attribution stays automatic.',
      'Continue breaking out Monday-aligned product launches from broader product categories when the campaign has its own dedicated landing page and creative set.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'The campaign had some related cutting/crimp activity before the confirmed Monday window, so the story is lift/scale versus an existing baseline rather than starting from zero.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['New Cutting Tools', 'new cutting tool', 'new cutters'],
  },
  {
    slug: 'tiiger-long-handled-tools-2026-02-10',
    brand: 'Tiiger',
    product: 'Long Handled Tools',
    parentProduct: 'Long Handled Tools',
    campaignGroupName: 'Tiiger Long Handled Tools — Feb/Mar 2026',
    campaignNames: [
      '[LEAD] P.Max | 02-09: Tiiger Long Handled Tools',
    ],
    sourceMediumPagePaths: [
      '/tiiger-long-handle-tools',
      '/promotion/tiiger-long-handle-tools',
      '/product-category/tiiger-utility-products/long-handle-tools',
    ],
    sourceMediumScopedPageRules: [
      {
        pagePath: '/products',
        sources: ['google'],
        mediums: ['cpc'],
        channelGroups: ['Cross-network'],
        start: '2026-02-10',
        end: '2026-03-13',
        label: '/products/?_product_categories=long-handle-tools',
      },
    ],
    campaignStart: '2026-02-10',
    campaignEnd: '2026-03-13',
    beforeStart: '2026-01-13',
    beforeEnd: '2026-02-09',
    afterStart: '2026-03-14',
    afterEnd: '2026-04-10',
    status: 'Draft',
    executiveSummary:
      'The Tiiger Long Handled Tools campaign generated measurable paid reach, clicks, tracked leads, and Act-On email engagement while marketing was live. The campaign produced 87K+ paid impressions, 1.0K+ paid clicks, 12 tracked leads/conversions, 452 scoped campaign landing-page GA4 sessions, 296 engaged sessions, and one product-specific Act-On email with 2.1K+ sends and 201 clicks during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales. The strongest story is lead and email activity; landing-page traffic is now scoped to include the Google PMax long-handle category URL that GA4 stores as /products.',
    canClaim: [
      'Paid media created measurable awareness, traffic, and tracked lead activity while the campaign was live.',
      'The campaign generated product-specific tracked leads/conversions during the media flight.',
      'Act-On email added a strong owned-channel touchpoint with a high click volume relative to sends.',
      'Campaign landing-page engagement was present across the dedicated Tiiger pages and the Google PMax long-handle category URL.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'A large landing-page traffic lift from the dedicated Tiiger pages alone; the Google Ads landing page was the /products category-filter URL for long-handle tools, which GA4 stores under /products.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a focused lead/email campaign with scoped landing-page traffic that includes the Google PMax long-handle category URL.',
      'For the next Tiiger run, tighten landing-page and campaign naming so all ads, emails, and site paths roll into the same Long Handled Tools product bucket automatically.',
      'Ask Bob to validate lead quality and any distributor/offline demand, because digital lead volume alone cannot prove sales impact.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Some Tiiger Long Handled Tools source rows arrived under mixed labels, so this update normalizes the Tiiger-specific Long Handled Tools breakout for the wrap-up and Product Performance filters.',
      'The Google Ads final URL was /products/?_product_categories=long-handle-tools, but GA4 page_path stores it as /products. To avoid counting every products-page visit or unrelated pre-campaign PMax traffic, this wrap-up includes /products only for google / cpc / Cross-network rows during the confirmed campaign window.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Tiiger Long Handled Tools', 'Tiiger Long Handle Tools', 'Long Handled Tools'],
  },
  {
    slug: 'tiiger-utility-pole-maintenance-2026-04-21',
    brand: 'Tiiger',
    product: 'Pole Maintenance',
    parentProduct: 'Pole Maintenance',
    campaignGroupName: 'Tiiger Utility Pole Maintenance — Apr/May 2026',
    campaignNames: [
      '[LEAD] Tiiger | 4-20: Utility Pole Maintenance',
      '[LEAD] Tiiger | P.Max | 4-20: Utility Pole Maintenance',
    ],
    sourceMediumPagePaths: [
      '/lp/tiiger-pole-maintenance',
    ],
    campaignStart: '2026-04-21',
    campaignEnd: '2026-05-21',
    beforeStart: '2026-03-24',
    beforeEnd: '2026-04-20',
    afterStart: '2026-05-22',
    afterEnd: '2026-06-18',
    status: 'Draft',
    executiveSummary:
      'The Tiiger Utility Pole Maintenance campaign created a clear digital lift while marketing was live and marks the shift from relying mainly on Meta instant-form lead ads to driving Meta traffic to a more campaign-specific landing page. The campaign generated 275K+ paid impressions, 3.4K+ paid clicks, 34 tracked website leads/conversions, 1.9K campaign landing-page GA4 sessions, 499 engaged sessions, and one product-specific Act-On email with 7.5K sends and 105 clicks during the campaign window. This wrap-up is intentionally limited to digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales. The strongest story is paid reach, landing-page traffic lift, and tracked website lead capture.',
    canClaim: [
      'Paid media created a large measurable awareness and traffic lift while the campaign was live.',
      'The campaign generated product-specific tracked website leads/conversions across Meta website-conversion traffic and Google PMax.',
      'Campaign landing-page sessions increased sharply during the campaign period versus before and after windows, supporting the move to a campaign-specific landing page.',
      'Act-On email added a supporting owned-channel touchpoint for Utility Pole Maintenance.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Lead quality or closed-won sales impact without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as the transition point from Meta lead-form dependence to website conversion traffic: Meta drove people to the campaign landing page, Google added on-site intent, and the landing page saw a clear campaign-period lift.',
      'For the next Tiiger run, keep the dedicated/campaign-specific landing page, UTMs, campaign names, and product taxonomy aligned so source/medium, website conversions, and lead quality are easier to read.',
      'Ask Bob to validate lead quality and any distributor/offline demand, because digital leads alone cannot prove sales impact.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'GA4 source/medium values include some Meta ad-set audience names under Organic Social; the Meta CPL shown here is based on website conversion rows in the ads layer, not native instant-form lead ads. This is an intentional strategy shift for this campaign, not a like-for-like native lead-ad CPL comparison.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Utility Pole Maintenance', 'Pole Maintenance', 'Pole Pullers'],
  },
  {
    slug: 'huskie-battery-tools-sla-725-2026-03-12',
    brand: 'Huskie',
    product: 'Battery Tools: SLA 725',
    parentProduct: 'Battery Tools: SLA 725',
    campaignGroupName: 'Huskie Battery Tools: SLA 725 — Mar/Apr 2026',
    campaignNames: [
      '[LEAD] P.Max | 03-09: Battery Tools-SLA *725',
      '[LEAD] Huskie |  03-09: Battery Tools-SLA *725',
    ],
    sourceMediumPagePaths: [
      '/huskie-sla-725y-campaign',
      '/lp/sla-725y',
    ],
    campaignStart: '2026-03-12',
    campaignEnd: '2026-04-01',
    beforeStart: '2026-02-12',
    beforeEnd: '2026-03-11',
    afterStart: '2026-04-02',
    afterEnd: '2026-04-29',
    status: 'Draft',
    executiveSummary:
      'The Huskie Battery Tools: SLA 725 campaign created a very strong campaign landing-page traffic lift while marketing was live. The campaign generated 278K+ paid impressions, 4.7K+ paid clicks, 57 tracked leads/conversions, 3.0K+ campaign landing-page GA4 sessions, 1.5K+ engaged sessions, and two product-specific Act-On sends totaling 14.8K+ recipients during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales. The story is marketing-driven awareness, traffic, engagement, and lead activity — not offline/distributor sales.',
    canClaim: [
      'Paid media created a large measurable awareness and traffic lift while the campaign was live.',
      'Campaign landing-page sessions and engaged sessions increased sharply during the campaign period versus the before and after windows.',
      'The campaign generated product-specific tracked leads/conversions while media was active.',
      'Act-On email added measurable owned-channel support through product-specific SLA 725 sends.',
      'Campaign landing-page traffic dropped materially after the campaign ended, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a high-activity lead-generation campaign: paid reach, site traffic, engaged sessions, tracked leads, and email support.',
      'Separate Meta lead forms from Google/PMax website activity because Meta drove most lead volume while Google/PMax helps show higher-intent site visits.',
      'For future Huskie launches, keep the campaign name, landing-page URL, Act-On email name, and Monday product label aligned around SLA 725 so attribution stays automatic.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Paid leads/conversions are platform-reported conversions; quality must be validated downstream in sales/CRM follow-up.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['SLA 725', 'SLA-725', 'SLA 725Y', 'SLA-725Y', 'SLA *725', 'Battery Tools'],
  },
  {
    slug: 'jameson-fishtape-hero-little-buddy-electrical-2026-04-08',
    brand: 'Jameson',
    product: 'Little Buddy',
    parentProduct: 'Fishtape / Little Buddy',
    campaignGroupName: 'Jameson Fishtape: HERO Little Buddy–Electrical — Apr 2026',
    campaignNames: [
      '[LEAD] 4-06: Fishtape: HERO Little Buddy-Electrical',
    ],
    sourceMediumPagePaths: [
      '/lp/fiberglass-fish-tape-wire-puller-telecom',
      '/fish-tapes-fish-rods',
      '/product-category/fish-tapes-fish-rods',
      '/product-category/fish-tapes-fish-rods/little-buddy',
      '/product-category/fish-tapes-fish-rods/little-buddy/little-buddy-accessories',
      '/product-category/fish-tapes-fish-rods/little-buddy/little-buddy-fiberglass-fish-tapes',
      '/product-category/fish-tapes-fish-rods/wee-buddy',
      '/product-category/fish-tapes-fish-rods/wee-buddy/wee-buddy-fiberglass-fish-tapes',
      '/product-category/fish-tapes-fish-rods/wee-buddy/wee-buddy-accessories',
      '/product-category/fish-tapes-fish-rods/glow-rods',
      '/product-category/fish-tapes-fish-rods/glow-rods/glow-fish-rods',
      '/product-category/fish-tapes-fish-rods/glow-rods/glow-fish-rod-accessories',
      '/product-category/fish-tapes-fish-rods/coated-fish-rods',
      '/product-category/fish-tapes-fish-rods/flex-buddy-polymer-fish-tape',
    ],
    campaignStart: '2026-04-08',
    campaignEnd: '2026-04-30',
    beforeStart: '2026-03-11',
    beforeEnd: '2026-04-07',
    afterStart: '2026-05-01',
    afterEnd: '2026-05-28',
    status: 'Draft',
    executiveSummary:
      'The Jameson Fishtape: HERO Little Buddy–Electrical campaign ran as a Meta website-conversion flight from 2026-04-08 through 2026-04-30, with ad data beginning on 2026-04-09. Using the dated Electrical row only, the campaign generated 29.9K paid impressions, 595 paid clicks, 9 tracked conversions, 1 ad-attributed purchase, and $511 in ad-attributed revenue. Scoped Little Buddy/Fish Tape pages moved from 513 pre-period sessions to 581 campaign-period sessions, with GA4 recording 6 purchases and $3.3K revenue on scoped Fish Tape/Little Buddy pages during the run. The campaign was also supported by a three-email Act-On sequence with 18.4K sends and 217 clicks. This wrap-up is intentionally scoped to the dated Electrical row, relevant Little Buddy/Fish Tape pages, Act-On, GA4, and online sales — not the overlapping Telecom PMax/Meta rows, broader Rodder category ecommerce, Fiber Driver activity, or offline/distributor sales.',
    canClaim: [
      'The Electrical flight was Meta-only in the paid campaign rows found for this exact campaign name/window.',
      'Meta should be framed as website conversions, not native lead forms; the ad row contains clicks, tracked conversions, purchases, and revenue.',
      'The campaign had a measurable three-email Act-On sequence supporting the Little Buddy/Fishtape push.',
      'Under the corrected Little Buddy/Fish Tape scope, campaign-period GA4 ecommerce was 6 purchases and $3,341.85 revenue; broader Rodder ecommerce is excluded from core totals.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'That this report captures the overlapping Telecom PMax campaign; Telecom rows are a separate wrap-up and are excluded here.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Tell this as a Meta website-conversion campaign supported by the same Little Buddy email sequence, not as a Google/PMax campaign.',
      'Keep the Electrical and Telecom HERO Little Buddy reports separate because the April window overlaps and Telecom has its own Google PMax row.',
      'Preserve strict Little Buddy/Fish Tape scope in the talk track so broader Rodder category purchases do not get pulled into the campaign story.',
      'Ask Bob to validate whether the tracked Meta conversions and online purchases translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'The user-provided flight window is 2026-04-08 to 2026-04-30; the dated Electrical ad row starts recording spend on 2026-04-09 and continues through 2026-04-30.',
      'The source warehouse also contains [LEAD] Fishtape: HERO Little Buddy-ElectricalTrust, a lower-volume overlapping Meta row; this wrap-up uses only the dated 4-06 Electrical row to avoid double counting.',
      'Overlapping Telecom rows and the Telecom Google PMax campaign are excluded from this Electrical wrap-up; those belong to the separate Little Buddy–Telecom report.',
      'Core GA4 totals exclude broader Rodder, traceable-rodder, and Fiber Driver pages. Those pages showed ecommerce in the broader period query but should not be attributed to this Little Buddy Electrical campaign.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['04-06 Fishtape: HERO Little Buddy', 'Little Buddy - email'],
  },
  {
    slug: 'jameson-fishtape-hero-little-buddy-telecom-2026-03-26',
    brand: 'Jameson',
    product: 'Little Buddy',
    parentProduct: 'Fishtape / Little Buddy',
    campaignGroupName: 'Jameson Fishtape: HERO Little Buddy–Telecom — Mar/Apr 2026',
    campaignNames: [
      '[SALES] Performance Max | 4-06: Fishtape: HERO Little Buddy-Telecom',
      '[LEAD] 4-06: Fishtape: HERO Little Buddy-Telecom',
    ],
    sourceMediumPagePaths: [
      '/lp/fiberglass-fish-tape-wire-puller-telecom',
      '/fish-tapes-fish-rods',
      '/product-category/fish-tapes-fish-rods',
      '/product-category/fish-tapes-fish-rods/little-buddy',
      '/product-category/fish-tapes-fish-rods/little-buddy/little-buddy-accessories',
      '/product-category/fish-tapes-fish-rods/little-buddy/little-buddy-fiberglass-fish-tapes',
      '/product-category/fish-tapes-fish-rods/wee-buddy',
      '/product-category/fish-tapes-fish-rods/wee-buddy/wee-buddy-fiberglass-fish-tapes',
      '/product-category/fish-tapes-fish-rods/wee-buddy/wee-buddy-accessories',
      '/product-category/fish-tapes-fish-rods/glow-rods',
      '/product-category/fish-tapes-fish-rods/glow-rods/glow-fish-rods',
      '/product-category/fish-tapes-fish-rods/glow-rods/glow-fish-rod-accessories',
      '/product-category/fish-tapes-fish-rods/coated-fish-rods',
      '/product-category/fish-tapes-fish-rods/flex-buddy-polymer-fish-tape',
    ],
    sourceMediumScopedPageRules: [
      {
        pagePath: '/where-to-buy',
        sources: ['google'],
        mediums: ['cpc'],
        channelGroups: ['Cross-network'],
        start: '2026-03-26',
        end: '2026-04-30',
        label: 'Google PMax where-to-buy destination',
      },
    ],
    campaignStart: '2026-03-26',
    campaignEnd: '2026-04-30',
    beforeStart: '2026-02-26',
    beforeEnd: '2026-03-25',
    afterStart: '2026-05-01',
    afterEnd: '2026-05-28',
    status: 'Draft',
    executiveSummary:
      'The Jameson Fishtape: HERO Little Buddy–Telecom campaign generated measurable paid reach, traffic, tracked sales/conversions, and email support during the campaign window. The campaign generated 25K+ paid impressions, 818 paid clicks, 121 tracked conversions, 6 ad-attributed purchases, and a three-email Act-On sequence with 18K+ sends. Google PMax delivered most paid click volume and tracked purchases, while Meta appears to have been a light traffic/awareness layer with no tracked native leads. After removing broader Rodder-category pages from the core Little Buddy scope, the 4-week pre-period had 222 sessions, 79 engaged sessions, and no GA4 ecommerce purchases/revenue; campaign-period ecommerce on the scoped Little Buddy/Fish Tape pages was 6 purchases and $3.3K in GA4 revenue. This wrap-up is intentionally scoped to campaign-specific paid rows, the dedicated telecom Little Buddy landing page, relevant Fish Tape/Little Buddy destination pages, Act-On, GA4, and online sales — not broader Rodder category sales or offline/distributor sales.',
    canClaim: [
      'Google PMax generated the majority of paid clicks and tracked conversions/purchases for the campaign.',
      'The campaign included a measurable three-email Act-On sequence supporting the Little Buddy/Fishtape push.',
      'Meta ran as a light traffic/awareness layer rather than a native lead-ad driver; the source rows show clicks/spend but no tracked Meta leads.',
      'The dedicated telecom Little Buddy landing page was the top Google Ads destination by click volume.',
      'Under the corrected Little Buddy/Fish Tape scope, the 4-week pre-period had traffic but no GA4 online purchases/revenue, so broader Rodder category sales should be treated as context only, not Little Buddy performance.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
      'That every Google PMax expanded click was product-relevant; Google sent some traffic to unrelated site pages that are documented but excluded from the core session scope.',
    ],
    recommendations: [
      'Use this page as the first-pass presentation source, then QA whether the PMax URL expansion should have been constrained more tightly for future Little Buddy campaigns.',
      'Tell the story as a Google-led sales/conversion campaign supported by a three-email Act-On sequence and light Meta awareness traffic.',
      'For future PMax campaigns, keep final URL expansion and asset-group URL rules tightly aligned with the product family to avoid unrelated Tree Tools/product-page traffic.',
      'Continue keeping Monday item naming, ad campaign naming, and landing-page URLs aligned so product attribution can stay deterministic.',
    ],
    caveats: [
      'Google Ads landing-page QA found the PMax campaign sent clicks to a wide set of expanded URLs, including broader Rodder, unrelated Tree Tools, and general product pages; this corrected wrap-up excludes broader Rodder and clearly unrelated expansion pages from core Little Buddy/Fish Tape GA4 session totals.',
      'The corrected Little Buddy/Fish Tape pre-period had 222 sessions, 79 engaged sessions, 0 GA4 online purchases, and $0 GA4 revenue. The previously observed 25 purchases / $15,577.16 came from broader Rodder category pages and should not be attributed to this Little Buddy product wrap-up.',
      'Campaign-period GA4 ecommerce on the scoped Little Buddy/Fish Tape pages was 6 purchases and $3,341.85 revenue, all appearing under google / organic in GA4 source-medium reporting; separately, the campaign ad rows report 6 ad-attributed purchases and $5,701.49 ad-attributed revenue.',
      'The top Google destination was /lp/fiberglass-fish-tape-wire-puller-telecom, but URL expansion also sent smaller click volumes to Fish Tape, Rodder, traceable-rodder, homepage, where-to-buy, products, and unrelated pages.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Fishtape: HERO Little Buddy', 'Little Buddy - email'],
  },
  {
    slug: 'jameson-rodders-select-your-rodder-2026-02-25',
    brand: 'Jameson',
    product: 'Rodders',
    parentProduct: 'Rodders',
    campaignGroupName: 'Jameson Rodders — Select Your Rodder — Feb/Mar 2026',
    campaignNames: [
      '[LEAD] 02-23: Jameson Rodders - Select Your Rodder',
      '[LEAD] Performance Max | Conduit Rodders',
    ],
    sourceMediumPagePaths: [
      '/duct-rodders',
      '/duct-rodders/selection-tool',
      '/duct-rodders/duct-rodder-selection-guide',
      '/duct-rodders/duct-hunter-selection-guide',
      '/lp/selector-tool-intro',
    ],
    sourceMediumScopedPageRules: [
      {
        pagePath: '/where-to-buy',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/fish-tapes-fish-rods',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/cable-reel-handling',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/products',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/fiber-installation',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/contact',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
      {
        pagePath: '/overhead-cable-tools',
        sources: ['google'],
        mediums: ['cpc', 'pmax'],
        channelGroups: ['Cross-network', 'Paid Search'],
        start: '2026-02-25',
        end: '2026-03-20',
      },
    ],
    campaignStart: '2026-02-25',
    campaignEnd: '2026-03-20',
    beforeStart: '2026-01-28',
    beforeEnd: '2026-02-24',
    afterStart: '2026-03-21',
    afterEnd: '2026-04-17',
    status: 'Draft',
    executiveSummary:
      'The Jameson Rodders — Select Your Rodder campaign drove a campaign-period lift in rodder/selector traffic and tracked website conversions. The campaign generated 169K+ paid impressions, 2.1K+ paid clicks, 31 tracked conversions, 4 ad-attributed purchases, $5.7K in ad-attributed revenue, and two product-specific Act-On sends during the campaign window. The Meta row is treated as a traffic-driving website-conversion campaign, not a native lead-form CPL story. This wrap-up is limited to digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales.',
    canClaim: [
      'The campaign drove a measurable campaign-period lift across the rodder page, selector/guide pages, and Google-confirmed destination pages.',
      'Google PMax drove the largest tracked conversion volume and most of the ad-attributed purchase/revenue signal.',
      'Meta appears to be a traffic-driving website-conversion campaign for this flight; its CPL should be read as website conversion cost, not native instant-form lead cost.',
      'Act-On supported the campaign with the 02-23 Select Your Rodder launch email plus an in-window Rodders In-Stock email.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Lead quality, closed-won sales, or distributor follow-up outcomes without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a website-traffic and conversion campaign: Meta helped drive website conversion activity while Google PMax carried the higher-intent conversion and ecommerce signal.',
      'Keep the Rodders campaign, selector/guide pages, and Google destination-page evidence together so the report does not overcount unrelated broad catalog traffic.',
      'Ask Bob to validate whether tracked website conversions and ad-attributed purchases translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'The Meta campaign appears twice in the source warehouse under duplicate/renamed campaign names; this wrap-up intentionally uses the dated 02-23 Meta campaign name plus Google PMax to avoid double counting.',
      'Composio/Google Ads landing-page QA confirmed most Google PMax clicks landed on /duct-rodders, with small click volumes to /where-to-buy, /fish-tapes-fish-rods, /lp/selector-tool-intro, /products, /contact, /fiber-installation, /cable-reel-handling, and /overhead-cable-tools; broad secondary pages are included only as Google/CPC campaign-window traffic.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Select Your Rodder', 'Rodders In-Stock email'],
  },
  {
    slug: 'jameson-electrician-tools-cable-benders-2026-03-11',
    brand: 'Jameson',
    product: 'Cable Benders',
    parentProduct: 'Cable Benders',
    campaignGroupName: 'Jameson Electrician Tools — Cable Benders',
    campaignNames: [
      '[LEAD] 03-09: Electrician Tools- Cable Benders',
      '[SALES] 03-09: Electrician Tools- Cable Benders',
    ],
    sourceMediumPagePaths: [
      '/lp/bulldog-cable-benders',
      '/lp/bulldog-cable-benders/',
      '/bulldog-bender',
      '/product-category/wiring-splicing-tools/cable-bending',
      '/product-category/all/accessories/cable-bender-head',
      '/download/brochure-bulldog-bender',
      '/spartaco-acquires-bulldog-bender-cable-bending-made-easy',
      '/spartaco-acquires-bulldog-bender',
    ],
    campaignStart: '2026-03-11',
    campaignEnd: '2026-03-31',
    beforeStart: '2026-02-11',
    beforeEnd: '2026-03-10',
    afterStart: '2026-04-01',
    afterEnd: '2026-04-28',
    status: 'Draft',
    executiveSummary:
      'The Jameson Electrician Tools — Cable Benders campaign ran as a March Meta + Google sales/lead flight for the Bulldog Cable Bender product family. Using the dated 03-09 rows only, the campaign generated 103K paid impressions, 4.5K paid clicks, 44 tracked conversions, 6 ad-attributed purchases, and $1.7K in ad-attributed revenue. Scoped Cable Benders pages rose from 184 pre-period sessions to 2,998 campaign-period sessions, led by /lp/bulldog-cable-benders, and GA4 recorded 7 purchases / $1.5K revenue on the landing page during the campaign window. The campaign also had one product-specific Act-On email with 7.4K sends and 138 clicks. This wrap-up is intentionally scoped to the dated 03-09 Cable Benders rows, Bulldog Cable Benders landing/product pages, Act-On, GA4, and online sales — not broad Electrician Tools or unrelated battery/bending-tool pages.',
    canClaim: [
      'This Cable Benders flight included both Meta and Google rows in the ads warehouse.',
      'The dedicated /lp/bulldog-cable-benders landing page was the primary campaign-period traffic and ecommerce destination in GA4.',
      'Scoped Cable Benders sessions and landing-page ecommerce rose sharply during the campaign window versus the prior four weeks.',
      'The 03-09 Act-On email supported the launch with a product-specific Bulldog Bender message.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Performance for broad Electrician Tools, unrelated battery-powered bending tools, or Cut/Crimp tools.',
      'Lead quality, closed-won sales, or distributor follow-up outcomes without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Tell this as a strong landing-page traffic and ecommerce story: the dedicated Bulldog Cable Benders LP carried almost all campaign-period scoped sessions and all scoped GA4 revenue.',
      'Use both ad-platform purchases and GA4 landing-page purchases in the talk track, while keeping them clearly labeled as separate attribution systems.',
      'Keep this report scoped to Cable Benders/Bulldog Bender pages rather than broad Electrician Tools or adjacent bending/cut-crimp categories.',
      'Ask Bob to validate whether the tracked conversions and online purchases translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'The source warehouse also contains an undated duplicate/renamed Meta row, [LEAD] Jameson Electrician Tools: Cable Benders, with the same metrics as the dated 03-09 Meta row; this wrap-up uses only the dated 03-09 row to avoid double counting.',
      'Core GA4 totals are limited to Bulldog Cable Bender landing/product/support pages; broad bending-tool, battery-powered-tool, and cut/crimp pages are excluded from the product story unless they explicitly identify Cable Benders.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['3-09 Cable Benders Campaign', 'One Cable Bending Tool for Big Wire Jobs'],
  },
  {
    slug: 'jameson-hot-stick-tree-tools-2026-03-05',
    brand: 'Jameson',
    product: 'Hot-Stick',
    parentProduct: 'Hot-Stick',
    campaignGroupName: 'Jameson Hot-Stick Tree Tools — Mar 2026',
    campaignNames: [
      '[LEAD] 03-02: Jameson Hot-Stick Tree Tools | Interests',
      '[LEAD] Performance Max | 03-02: Jameson Hot-Stick Tree Tools',
    ],
    sourceMediumPagePaths: [
      '/lp/hot-stick-tools',
    ],
    campaignStart: '2026-03-05',
    campaignEnd: '2026-03-27',
    beforeStart: '2026-02-05',
    beforeEnd: '2026-03-04',
    afterStart: '2026-03-28',
    afterEnd: '2026-04-24',
    status: 'Draft',
    executiveSummary:
      'The Jameson Hot-Stick Tree Tools campaign ran as a March Google PMax + Meta interests flight, separate from the later/current HERO Hot Stick campaign. The campaign generated 53.9K paid impressions, 1,587 paid clicks, 23 tracked conversions, 2 ad-attributed purchases, and $1.0K in ad-attributed revenue. GA4 reporting is intentionally scoped to the clean campaign page only (/lp/hot-stick-tools), which rose from 72 pre-period sessions to 851 campaign-period sessions. The campaign also had one product-specific Act-On email with 7.4K sends and 124 clicks. This wrap-up is intentionally scoped to the dated 03-02 Hot-Stick campaign rows, the dedicated Hot-Stick campaign page, Act-On, GA4, and online sales — not the later HERO Hot Stick flight or broader Tree Tools campaigns/pages.',
    canClaim: [
      'This March Hot-Stick flight included both Meta and Google/PMax rows in the ads warehouse.',
      'The dedicated /lp/hot-stick-tools landing page was the primary campaign-period traffic destination in GA4.',
      'The campaign period produced a clear lift on the dedicated campaign page versus the prior four weeks.',
      'The 03-02 Act-On email supported the launch with a product-specific Hot-Stick message.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'The later/current HERO Hot Stick campaign performance; that is a separate flight and intentionally excluded here.',
      'Lead quality, closed-won sales, or distributor follow-up outcomes without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Tell this as a Hot-Stick-specific traffic and conversion campaign, with Google/PMax and Meta working together during the March run.',
      'Keep this report separate from the later HERO Hot Stick campaign and from broad Tree Tools / Added Value Kit reporting.',
      'Use the dedicated campaign-page lift and product-specific email support as the core narrative, rather than broad Tree Tools or Hot-Stick category/product-page ecommerce.',
      'Ask Bob to validate whether the tracked conversions and ad-attributed purchases translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'The source warehouse also contains an undated duplicate/renamed Meta row, [LEAD] Jameson Hot-Stick Tree Tools | Interests, with the same metrics as the dated 03-02 Meta row; this wrap-up uses only the dated 03-02 row to avoid double counting.',
      'The later/current 06-01 Tree Tools-HERO Hot Stick Tree Tools flight is intentionally excluded from this March Hot-Stick report.',
      'The March/April comparison periods contain other Tree Tools activity, including Tree Tools merchandiser and Added Value Kit campaigns; core GA4 totals are therefore limited to the dedicated /lp/hot-stick-tools campaign page instead of broad Tree Tools, Hot-Stick category, or product pages.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['03-02 Jameson Hot-Stick Tree Tools', 'One Hot Stick. More Ways to get the Job Done.'],
  },
  {
    slug: 'jameson-fiber-driver-fishtape-driver-2026-05-07',
    brand: 'Jameson',
    product: 'Fiber Driver',
    parentProduct: 'Fiber Drivers',
    campaignGroupName: 'Jameson Fiber Driver V1: FISHTAPE DRIVER — May 2026',
    campaignNames: [
      '[LEAD] 05-04: Fiber Driver V1: FISHTAPE DRIVER',
    ],
    sourceMediumPagePaths: [
      '/lp/jameson-fiber-driver-fish-tape-driver',
      '/sand/lp/jameson-fiber-driver-fish-tape-driver',
      '/fiber-installation',
      '/product-category/fiber-installation',
      '/product-category/fiber-installation/page/2',
      '/lp/fiber-installation',
      '/product/fg-bs-kit1',
      '/product/fg-bs-kit2',
      '/sand/product/flat-drop-fiber-driver-conduit-adapters-10-mm',
      '/product/fg-4',
      '/product/fg-4f',
      '/product/fg-4sfp',
      '/product/fg-6',
      '/product/fg-6f',
      '/product/fg-6-3',
      '/product/fg-6-3f',
      '/product/fg-6-3w',
      '/product/fg-6pkg-1',
      '/product/fg-6pkg-2',
      '/product/fg-6pkg-3',
      '/product/fg-6pkg-7',
      '/product/fg-6sfp',
      '/product/fg-6x3',
      '/product/fg-6x3f',
      '/product/fg-6x3f-w',
      '/product/fg-8',
      '/product/fg-8f',
      '/product/fg-8sfp',
      '/product/fg-10',
      '/product/fg-10f',
      '/product/fg-10sfp',
      '/product/fg-11k',
      '/product/fg-12',
      '/product/fg-12f',
      '/product/fg-14k',
    ],
    campaignStart: '2026-05-07',
    campaignEnd: '2026-05-28',
    beforeStart: '2026-04-09',
    beforeEnd: '2026-05-06',
    afterStart: '2026-05-29',
    afterEnd: '2026-06-25',
    status: 'Draft',
    executiveSummary:
      'The Jameson Fiber Driver V1: FISHTAPE DRIVER campaign ran as a Meta-only website conversion/lead campaign in the dashboard ad data. The campaign generated 175K+ paid impressions, 3.1K paid clicks, 128 tracked conversions, 2 ad-attributed purchases, and $941 in ad-attributed revenue. Scoped Fiber Driver/Fish Tape Driver pages rose from 455 pre-period sessions to 1,623 campaign-period sessions, led by the dedicated /lp/jameson-fiber-driver-fish-tape-driver landing page. The campaign also had one product-specific Act-On email with 9.2K sends and 1.7K clicks. This wrap-up is intentionally scoped to the dated Meta campaign row, the dedicated Fiber Driver/Fish Tape Driver landing page, Fiber Driver product pages, Act-On, GA4, and online sales — not Air Boost, V2, or offline/distributor sales.',
    canClaim: [
      'The paid campaign data for this flight shows Meta only; no matching Google/PMax campaign row was found for the 2026-05-07 to 2026-05-28 run window.',
      'The dedicated Fiber Driver/Fish Tape Driver landing page was the primary campaign-period traffic destination in GA4.',
      'The campaign period produced a clear lift in scoped Fiber Driver landing-page and product-page sessions versus the prior four weeks.',
      'The Act-On email on 2026-05-21 strongly supported the push with high click volume.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'That Google ran for this specific V1 flight; only the dated Meta campaign row appears in the ads data for this window.',
      'Lead quality, closed-won sales, or distributor follow-up outcomes without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Tell this one as a Meta-led traffic/conversion campaign supported by a high-click Act-On email, not as a Google/PMax sales campaign.',
      'Confirm with the media team whether Google was intentionally not launched for this V1 flight or if the Google campaign used a different naming convention outside the current warehouse match.',
      'Keep this V1 Fishtape Driver report separate from Air Boost and V2 reporting; those are separate products/campaigns and should not be mixed into this page.',
      'Ask Bob to validate whether the tracked conversions and small number of online purchases translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'The ads warehouse shows only [LEAD] 05-04: Fiber Driver V1: FISHTAPE DRIVER during this 2026-05-07 to 2026-05-28 window; no matching Google row, Air Boost row, or V2 row is included in this exact campaign.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Fiber Driver-Fishtape Driver', 'Fish Tape into a Faster System', 'Fishtape Driver'],
  },
  {
    slug: 'jameson-fiber-driver-air-boost-awareness-2026-06-02',
    brand: 'Jameson',
    product: 'Air Boost',
    parentProduct: 'Fiber Drivers',
    campaignGroupName: 'Jameson Fiber Driver with Air Boost — Jun 2026',
    campaignNames: [
      '[LEAD] 06-01: Fiber Driver- Fiber Driver with Air Boost',
      '[SALES] Performance Max | 06-01: Fiber Driver- Fiber Driver with Air Boost',
    ],
    sourceMediumPagePaths: [
      '/lp/jameson-fiber-driver-fiber-driver-w-airboost',
    ],
    campaignStart: '2026-06-02',
    campaignEnd: '2026-06-26',
    beforeStart: '2026-05-05',
    beforeEnd: '2026-06-01',
    afterStart: '2026-06-27',
    afterEnd: '2026-07-24',
    status: 'Draft',
    executiveSummary:
      'The Jameson Fiber Driver with Air Boost June campaign ran from 2026-06-02 through 2026-06-26 across Meta and Google/PMax rows in the dashboard warehouse. Excluding separate V2 rows, the campaign generated 57.1K paid impressions, 2.3K paid clicks, 131 tracked conversions, 4 ad-attributed purchases, and $2.7K in ad-attributed revenue. GA4 reporting is intentionally scoped to the clean campaign page only (/lp/jameson-fiber-driver-fiber-driver-w-airboost), which shows 999 sessions, 428 engaged sessions, 10 GA4 purchases, and $2.6K in GA4 revenue during the campaign window. Product category pages are excluded because they are too broad to represent ad-driven before/after performance, especially for Google/PMax. The after-period is intentionally shown as an incomplete future/early read until 2026-07-24 fills out.',
    canClaim: [
      'The non-V2 Air Boost campaign ran in the warehouse from 2026-06-02 through 2026-06-26.',
      'The campaign combined Meta website/lead activity with a Google/PMax sales layer.',
      'The campaign produced tracked conversions plus ad-attributed purchases and revenue in the paid data.',
      'The campaign page generated 999 GA4 sessions, 428 engaged sessions, 10 GA4 purchases, and $2.6K in GA4 revenue during the campaign window.',
      'Two product-specific Act-On emails supported the campaign on 2026-06-16.',
      'V2 rows are excluded from this report so the page stays scoped to the original 06-01 Air Boost flight.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'That broad product category pages represent ad-driven before/after performance; those pages are intentionally excluded from the GA4 story because they are too broad, especially for Google/PMax.',
      'A complete 4-week post-campaign read until the after window reaches 2026-07-24.',
      'That V2 performance is part of this report; V2 should be handled separately.',
    ],
    recommendations: [
      'Tell this as an efficient paid reach/conversion, campaign-page, and email-support story while keeping Google/PMax category-page ambiguity out of the before/after narrative.',
      'Keep the original Air Boost and V2 flights separate in reporting because both appear in June with overlapping names and dates.',
      'Use CPL and ROAS together for the next-run read: Meta generated most conversion volume while Google/PMax carried the stronger sales/revenue signal.',
      'Before the next Air Boost run, tighten URL and UTM routing so paid clicks reconcile more clearly to the intended Air Boost campaign page in GA4.',
    ],
    caveats: [
      'The actual warehouse rows begin on 2026-06-02 even though the campaign naming uses 06-01.',
      'This wrap-up includes only [LEAD] 06-01: Fiber Driver- Fiber Driver with Air Boost and [SALES] Performance Max | 06-01: Fiber Driver- Fiber Driver with Air Boost. V2 rows are excluded.',
      'GA4 landing-page reporting is scoped only to /lp/jameson-fiber-driver-fiber-driver-w-airboost. Broader category pages such as /fiber-installation and /product-category/fiber-installation are intentionally excluded because they are too broad to prove ad-driven before/after performance.',
      'The after window is 2026-06-27 to 2026-07-24, but the full 4-week post-period is not yet available as of the build date, so early after-period metrics should not be overinterpreted.',
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Fiber Driver w/Air Boost', 'Air Boost-A Version', 'Air Boost-B Version'],
  },
  {
    slug: 'jameson-fiber-driver-air-boost-2026-02-24',
    brand: 'Jameson',
    product: 'Air Boost',
    parentProduct: 'Fiber Drivers',
    campaignGroupName: 'Jameson Fiber Driver + Air Boost — Feb/Mar 2026',
    campaignNames: [
      '[LEAD] 02-23: Jameson Fiber Driver + Air Boost',
      '[SALES] Performance Max | 02-23: Jameson Fiber Driver + Air Boost',
    ],
    sourceMediumPagePaths: [
      '/fiber-installation',
      '/product-category/fiber-installation',
      '/fiber-blowing',
    ],
    sourceMediumScopedPageRules: [
      {
        pagePath: '/fiber-installation/',
        sources: ['google'],
        mediums: ['cpc'],
        start: '2026-02-24',
        end: '2026-03-20',
      },
      {
        pagePath: '/products',
        sources: ['google'],
        mediums: ['cpc'],
        start: '2026-02-24',
        end: '2026-03-20',
      },
      {
        pagePath: '/contact',
        sources: ['google'],
        mediums: ['cpc'],
        start: '2026-02-24',
        end: '2026-03-20',
      },
      {
        pagePath: '/fish-tapes-fish-rods',
        sources: ['google'],
        mediums: ['cpc'],
        start: '2026-02-24',
        end: '2026-03-20',
      },
      {
        pagePath: '/where-to-buy',
        sources: ['google'],
        mediums: ['cpc'],
        start: '2026-02-24',
        end: '2026-03-20',
      },
    ],
    campaignStart: '2026-02-24',
    campaignEnd: '2026-03-20',
    beforeStart: '2026-01-27',
    beforeEnd: '2026-02-23',
    afterStart: '2026-03-21',
    afterEnd: '2026-04-17',
    status: 'Draft',
    executiveSummary:
      'The Jameson Fiber Driver + Air Boost campaign drove a clear campaign-period lift in website traffic and tracked sales/conversions. The campaign generated 204K+ paid impressions, 3.96K paid clicks, 277 tracked conversions, 6 ad-attributed purchases, $2.0K in ad-attributed revenue, 785 scoped landing-page sessions, 469 engaged sessions, 8 GA4 purchases, and one product-specific Act-On email with 3.2K sends and 82 clicks. This wrap-up is limited to digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales.',
    canClaim: [
      'The campaign drove a clear increase in scoped Fiber Installation and Google Ads destination-page sessions during the campaign period.',
      'Google PMax produced the strongest on-site traffic and ecommerce signal, including GA4 purchases/revenue on the scoped landing-page set.',
      'Meta lead/conversion ads added low-cost tracked conversion volume alongside the Google sales campaign.',
      'The Act-On email supported the launch with a product-specific Fiber Driver + Air Boost touchpoint.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Lead quality, closed-won sales, or distributor follow-up outcomes without Bob’s offline/sales feedback.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a sales-oriented digital campaign: PMax drove high-intent website traffic and purchases, while Meta added conversion volume at lower CPL.',
      'Keep Fiber Driver/Air Boost landing-page URLs, campaign names, and product taxonomy aligned so future Air Boost reporting does not mix with broader Fiber Driver traffic.',
      'Ask Bob to validate whether the website purchases and tracked conversions translated into qualified distributor or sales conversations.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 and ad platforms are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'The Meta campaign rows appear twice in the source warehouse under duplicate campaign names; this wrap-up intentionally uses the dated 02-23 Meta campaign name plus Google PMax to avoid double counting.',
      'Composio/Google Ads landing-page QA confirmed that most Google PMax clicks landed on /fiber-installation, with smaller click volumes to /products, /contact, /fish-tapes-fish-rods, and /where-to-buy; those secondary Google/CPC destination pages are included only during the campaign window.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['Fiber Driver + Air Boost', 'Fiber Driver', 'Air Boost'],
  },
  {
    slug: 'huskie-60-100-ton-presses-2026-02-03',
    brand: 'Huskie',
    product: 'Huskie 60-100 Ton Presses',
    parentProduct: 'Huskie 60-100 Ton Presses',
    campaignGroupName: 'Huskie 60-100 Ton Presses — Feb 2026',
    campaignNames: [
      '[LEAD] Huskie | 02-02: Huskie 60-100 Ton Presses',
      '[LEAD] P.Max | 02-02: Huskie 60-100 Ton Presse',
    ],
    sourceMediumPagePaths: [
      '/huskie-60-100-ton-compression-tools',
      '/huskie-60-100-ton-compression-tools/undefined',
    ],
    campaignStart: '2026-02-03',
    campaignEnd: '2026-02-27',
    beforeStart: '2026-01-06',
    beforeEnd: '2026-02-02',
    afterStart: '2026-02-28',
    afterEnd: '2026-03-27',
    status: 'Draft',
    executiveSummary:
      'The Huskie 60-100 Ton Presses campaign created a clear lift in campaign landing-page activity and product-specific lead activity while marketing was live. The campaign generated 91K+ paid impressions, 1.1K+ paid clicks, 13 tracked leads/conversions, 661 campaign landing-page GA4 sessions, 291 engaged sessions, and one product-specific Act-On email with 7.2K+ sends during the campaign window. This wrap-up is intentionally limited to the digital data EIC has available: ads, GA4 campaign landing-page traffic, Act-On, social, and online sales. The story is marketing-driven awareness, traffic, engagement, and lead activity — not offline/distributor sales.',
    canClaim: [
      'Paid media created measurable awareness, traffic, and tracked lead activity while the campaign was live.',
      'Campaign landing-page sessions and engaged sessions increased sharply during the campaign period versus the before and after windows.',
      'Google/on-site activity drove a meaningful share of the tracked lead volume, supporting the higher-intent lead quality story.',
      'Act-On email added a measurable owned-channel touchpoint for the product campaign.',
      'Campaign landing-page traffic dropped after the campaign window, which supports the “marketing on = more activity” story.',
    ],
    cannotClaim: [
      'Total company sales lift or distributor/offline revenue impact.',
      'True end-to-end ROAS across all Spartaco sales channels.',
      'Offline sales causation; this report only includes the digital sources currently available.',
    ],
    recommendations: [
      'Use this page as the presentation-ready source of truth instead of manually changing Product Performance filters.',
      'Tell the story as a higher-intent lead-generation campaign: paid reach, site traffic, engaged sessions, tracked leads, and email support.',
      'Continue separating Facebook lead ads from Google/on-site actions because Meta is cheaper while website/Google leads may signal higher intent.',
      'For future Huskie campaigns, keep Monday item names, ad campaign names, email names, and landing-page URLs aligned so product attribution stays automatic.',
    ],
    caveats: [
      'Online purchases/revenue in GA4 are not the same as total Spartaco sales.',
      'The current report does not include offline/distributor sales because that data is not available in the dashboard warehouse.',
      'Paid leads/conversions are platform-reported conversions; quality must be validated downstream in sales/CRM follow-up.',
      'Act-On creative previews/links are not currently stored in the warehouse; the email deep dive shows subject-line context and performance instead.',
    ],
    emailSearchTerms: ['60-100 Ton Presses', '60T/100T', 'Hydraulic Crimping Presses', 'crimping presses', 'compression tools'],
  },
];

function paramsFor(config: SpartacoWrapupConfig, start: string, end: string): SpartacoFilterParams {
  return {
    ...BASE_PARAMS,
    brand: config.brand,
    product: config.product,
    start,
    end,
    // comp values are required by the existing product fetcher but ignored by this wrap-up period summary.
    compStart: start,
    compEnd: end,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

function openRate(row: ProductPerformanceRow): number {
  return row.email_total_sent > 0 ? row.email_opens / row.email_total_sent : 0;
}

function clickRate(row: ProductPerformanceRow): number {
  return row.email_total_sent > 0 ? row.email_clicks / row.email_total_sent : 0;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekStartKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoDate(d);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function bucketFor(dateStr: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') return dateStr;
  if (grain === 'week') return weekStartKey(dateStr);
  return monthKey(dateStr);
}

function bucketLabel(bucket: string, grain: TimeSeriesGrain): string {
  if (grain === 'day') {
    const d = new Date(`${bucket}T00:00:00Z`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  if (grain === 'week') {
    const d = new Date(`${bucket}T00:00:00Z`);
    return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const [yr, mo] = bucket.split('-');
  const d = new Date(Date.UTC(Number(yr), Number(mo) - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function emptyTimeSeriesPoint(bucket: string, grain: TimeSeriesGrain): ProductTimeSeriesPoint {
  return {
    bucket,
    label: bucketLabel(bucket, grain),
    ad_cost: 0,
    ad_impressions: 0,
    ad_clicks: 0,
    ad_conversions: 0,
    ad_purchases: 0,
    ad_revenue: 0,
    ad_roas: 0,
    ad_cpl: 0,
    ga4_sessions: 0,
    ga4_engaged_sessions: 0,
    ga4_purchases: 0,
    ga4_revenue: 0,
    email_total_sent: 0,
    email_opens: 0,
    email_clicks: 0,
    email_open_rate: 0,
    email_click_rate: 0,
    gsc_clicks: 0,
    gsc_impressions: 0,
    gsc_ctr: 0,
    gsc_avg_position: 0,
    gsc_keywords_ranked: 0,
    social_post_count: 0,
    social_impressions: 0,
    social_interactions: 0,
    social_engagement: 0,
    social_engagement_rate: 0,
  };
}

function fillTimeSeriesWindow(
  points: ProductTimeSeriesPoint[],
  grain: TimeSeriesGrain,
  start: string,
  end: string
): ProductTimeSeriesPoint[] {
  const byBucket = new Map(points.map((point) => [point.bucket, point]));
  const buckets: string[] = [];
  let cursor = new Date(`${bucketFor(start, grain)}${grain === 'month' ? '-01' : ''}T00:00:00Z`);
  const endBucket = bucketFor(end, grain);

  while (true) {
    const bucket = grain === 'month' ? isoDate(cursor).slice(0, 7) : isoDate(cursor);
    buckets.push(bucket);
    if (bucket === endBucket) break;
    if (grain === 'day') cursor = addDays(cursor, 1);
    else if (grain === 'week') cursor = addDays(cursor, 7);
    else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return buckets.map((bucket) => byBucket.get(bucket) ?? emptyTimeSeriesPoint(bucket, grain));
}

const PAID_CHANNEL_GROUPS = new Set([
  'Cross-network',
  'Paid Search',
  'Paid Social',
  'Paid Shopping',
  'Paid Video',
  'Display',
]);

function isPaidChannelGroup(label: string): boolean {
  return PAID_CHANNEL_GROUPS.has(label) || label.toLowerCase().includes('paid');
}

type WrapupGa4SourceRow = {
  date?: string | null;
  ga4_source: string | null;
  ga4_medium: string | null;
  ga4_default_channel_group: string | null;
  ga4_pageviews?: number | null;
  ga4_total_users?: number | null;
  ga4_sessions: number | null;
  ga4_engaged_sessions: number | null;
  ga4_purchases: number | null;
  ga4_total_revenue: number | null;
  ga4_add_to_carts: number | null;
  ga4_checkouts?: number | null;
};

type ActOnEmailRow = {
  id: number;
  email_id: string | null;
  email_name: string | null;
  subject_line: string | null;
  total_sent: number | null;
  opens: number | null;
  clicks: number | null;
  open_rate: number | null;
  click_rate: number | null;
  report_date: string | null;
};

type WrapupAdRow = {
  campaign_name: string | null;
  ad_channel: string | null;
  ad_origem: string | null;
  ad_impressions: number | null;
  ad_clicks: number | null;
  ad_cost: number | null;
  ad_conversions: number | null;
};

function sourceMediumKey(source: string | null, medium: string | null) {
  const s = source || '(direct)';
  const m = medium || '(none)';
  return `${s} / ${m}`;
}

const LANDING_PAGE_GA4_SELECT = 'date,ga4_source,ga4_medium,ga4_default_channel_group,ga4_sessions,ga4_engaged_sessions,ga4_pageviews,ga4_total_users,ga4_purchases,ga4_total_revenue,ga4_add_to_carts,ga4_checkouts';

async function fetchLandingPageGa4Rows(
  config: SpartacoWrapupConfig,
  start: string,
  end: string
): Promise<WrapupGa4SourceRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const rows: WrapupGa4SourceRow[] = [];

  if (config.sourceMediumPagePaths.length > 0) {
    const pagePathFilter = config.sourceMediumPagePaths.map((path) => `page_path.eq.${path}`).join(',');
    const { data, error } = await supabase
      .from('spartaco_master_products')
      .select(LANDING_PAGE_GA4_SELECT)
      .eq('source', 'ga4')
      .gte('date', start)
      .lte('date', end)
      .or(pagePathFilter)
      .limit(10000);

    if (error) throw error;
    rows.push(...((data ?? []) as WrapupGa4SourceRow[]));
  }

  for (const rule of config.sourceMediumScopedPageRules ?? []) {
    const ruleStart = rule.start && rule.start > start ? rule.start : start;
    const ruleEnd = rule.end && rule.end < end ? rule.end : end;
    if (ruleStart > ruleEnd) continue;

    let query = supabase
      .from('spartaco_master_products')
      .select(LANDING_PAGE_GA4_SELECT)
      .eq('source', 'ga4')
      .gte('date', ruleStart)
      .lte('date', ruleEnd)
      .eq('page_path', rule.pagePath)
      .limit(10000);

    if (rule.sources?.length) query = query.in('ga4_source', rule.sources);
    if (rule.mediums?.length) query = query.in('ga4_medium', rule.mediums);
    if (rule.channelGroups?.length) query = query.in('ga4_default_channel_group', rule.channelGroups);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as WrapupGa4SourceRow[]));
  }

  return rows;
}

function summarizeLandingPageGa4(rows: WrapupGa4SourceRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.ga4_sessions += Number(row.ga4_sessions) || 0;
      acc.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
      acc.ga4_pageviews += Number(row.ga4_pageviews) || 0;
      acc.ga4_total_users += Number(row.ga4_total_users) || 0;
      acc.ga4_purchases += Number(row.ga4_purchases) || 0;
      acc.ga4_total_revenue += Number(row.ga4_total_revenue) || 0;
      acc.ga4_add_to_carts += Number(row.ga4_add_to_carts) || 0;
      acc.ga4_checkouts += Number(row.ga4_checkouts) || 0;
      return acc;
    },
    {
      ga4_sessions: 0,
      ga4_engaged_sessions: 0,
      ga4_pageviews: 0,
      ga4_total_users: 0,
      ga4_purchases: 0,
      ga4_total_revenue: 0,
      ga4_add_to_carts: 0,
      ga4_checkouts: 0,
    }
  );
}

function withEmailDetails(summary: ProductPerformanceRow, emailDetails: SpartacoProductWrapup['emailDetails']): ProductPerformanceRow {
  return {
    ...summary,
    email_total_sent: emailDetails.reduce((sum, email) => sum + email.totalSent, 0),
    email_opens: emailDetails.reduce((sum, email) => sum + email.opens, 0),
    email_clicks: emailDetails.reduce((sum, email) => sum + email.clicks, 0),
  };
}

function zeroPaidMetrics(summary: ProductPerformanceRow): ProductPerformanceRow {
  return {
    ...summary,
    ad_impressions: 0,
    ad_clicks: 0,
    ad_cost: 0,
    ad_conversions: 0,
    ad_purchases: 0,
    ad_revenue: 0,
  };
}

function zeroPaidMetricsOutsideCampaign(
  points: ProductTimeSeriesPoint[],
  config: SpartacoWrapupConfig,
  grain: TimeSeriesGrain,
): ProductTimeSeriesPoint[] {
  return points.map((point) => {
    const start = new Date(`${point.bucket}${grain === 'month' ? '-01' : ''}T00:00:00Z`);
    const end = grain === 'day'
      ? start
      : grain === 'week'
        ? addDays(start, 6)
        : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const campaignStart = new Date(`${config.campaignStart}T00:00:00Z`);
    const campaignEnd = new Date(`${config.campaignEnd}T00:00:00Z`);
    const outsideCampaign = end < campaignStart || start > campaignEnd;
    if (!outsideCampaign) return point;
    return {
      ...point,
      ad_impressions: 0,
      ad_clicks: 0,
      ad_cost: 0,
      ad_conversions: 0,
      ad_purchases: 0,
      ad_revenue: 0,
      ad_roas: 0,
      ad_cpl: 0,
    };
  });
}

function withLandingPageGa4(summary: ProductPerformanceRow, rows: WrapupGa4SourceRow[]): ProductPerformanceRow {
  return {
    ...summary,
    ...summarizeLandingPageGa4(rows),
  };
}

type CampaignAdSummary = Pick<
  ProductPerformanceRow,
  'ad_impressions' | 'ad_clicks' | 'ad_cost' | 'ad_conversions' | 'ad_purchases' | 'ad_revenue'
>;

function emptyCampaignAdSummary(): CampaignAdSummary {
  return {
    ad_impressions: 0,
    ad_clicks: 0,
    ad_cost: 0,
    ad_conversions: 0,
    ad_purchases: 0,
    ad_revenue: 0,
  };
}

async function fetchCampaignAdRows(config: SpartacoWrapupConfig, start: string, end: string) {
  const supabase = createSpartacoSupabaseClient();
  const { data, error } = await supabase
    .from('spartaco_master_products')
    .select('campaign_name,ad_channel,ad_origem,ad_impressions,ad_clicks,ad_cost,ad_conversions,ad_purchases,ad_revenue')
    .eq('source', 'ads')
    .gte('date', start)
    .lte('date', end)
    .in('campaign_name', config.campaignNames)
    .limit(10000);

  if (error) throw error;
  return (data ?? []) as (WrapupAdRow & { ad_purchases: number | null; ad_revenue: number | null })[];
}

function summarizeCampaignAdRows(rows: Awaited<ReturnType<typeof fetchCampaignAdRows>>): CampaignAdSummary {
  return rows.reduce((acc, row) => {
    acc.ad_impressions += Number(row.ad_impressions) || 0;
    acc.ad_clicks += Number(row.ad_clicks) || 0;
    acc.ad_cost += Number(row.ad_cost) || 0;
    acc.ad_conversions += Number(row.ad_conversions) || 0;
    acc.ad_purchases += Number(row.ad_purchases) || 0;
    acc.ad_revenue += Number(row.ad_revenue) || 0;
    return acc;
  }, emptyCampaignAdSummary());
}

function withCampaignAdSummary(summary: ProductPerformanceRow, adSummary: CampaignAdSummary): ProductPerformanceRow {
  return {
    ...summary,
    ...adSummary,
  };
}

function paidTrafficRowForAd(row: WrapupAdRow): Pick<TrafficBreakdownRow, 'label' | 'sublabel' | 'channelGroup'> {
  const campaign = (row.campaign_name ?? '').toLowerCase();
  const channel = (row.ad_channel ?? '').toLowerCase();
  const origem = (row.ad_origem ?? '').toLowerCase();

  if (channel.includes('meta') || origem.includes('meta') || campaign.includes('facebook')) {
    const isWebsiteConversion = campaign.includes('utility pole maintenance');
    return {
      label: 'fb',
      sublabel: 'paid',
      channelGroup: isWebsiteConversion ? 'Paid Social' : 'Paid Social',
    };
  }

  if (channel.includes('google') || origem.includes('google') || campaign.includes('p.max') || campaign.includes('performance max') || campaign.includes('[sales]')) {
    return { label: 'google', sublabel: 'cpc', channelGroup: 'Cross-network' };
  }

  return { label: 'paid', sublabel: 'other', channelGroup: 'Paid Other' };
}

function buildCampaignPaidTrafficRows(rows: Awaited<ReturnType<typeof fetchCampaignAdRows>>): TrafficBreakdownRow[] {
  const grouped = new Map<string, TrafficBreakdownRow>();
  for (const row of rows) {
    const meta = paidTrafficRowForAd(row);
    const key = `${meta.label} / ${meta.sublabel}`;
    const existing = grouped.get(key) ?? {
      ...meta,
      ga4_sessions: 0,
      prev_sessions: 0,
      ga4_engaged_sessions: 0,
      prev_engaged: 0,
      tracked_leads: 0,
      prev_tracked_leads: 0,
      ga4_purchases: 0,
      prev_purchases: 0,
      ga4_total_revenue: 0,
      prev_revenue: 0,
      ga4_add_to_carts: 0,
      prev_carts: 0,
    };
    existing.tracked_leads += Number(row.ad_conversions) || 0;
    grouped.set(key, existing);
  }
  return Array.from(grouped.values());
}

function buildLandingPageGa4TimeSeries(
  rows: WrapupGa4SourceRow[],
  grain: TimeSeriesGrain
): Map<string, Pick<ProductTimeSeriesPoint, 'ga4_sessions' | 'ga4_engaged_sessions' | 'ga4_purchases' | 'ga4_revenue'>> {
  const buckets = new Map<string, { sessions: number; engaged: number; purchases: number; revenue: number }>();
  for (const row of rows) {
    if (!row.date) continue;
    const bucket = bucketFor(row.date, grain);
    const existing = buckets.get(bucket) ?? { sessions: 0, engaged: 0, purchases: 0, revenue: 0 };
    existing.sessions += Number(row.ga4_sessions) || 0;
    existing.engaged += Number(row.ga4_engaged_sessions) || 0;
    existing.purchases += Number(row.ga4_purchases) || 0;
    existing.revenue += Number(row.ga4_total_revenue) || 0;
    buckets.set(bucket, existing);
  }

  return new Map(
    Array.from(buckets.entries()).map(([bucket, values]) => [
      bucket,
      {
        ga4_sessions: values.sessions,
        ga4_engaged_sessions: values.engaged,
        ga4_purchases: values.purchases,
        ga4_revenue: values.revenue,
      },
    ])
  );
}

function mergeLandingPageGa4TimeSeries(
  points: ProductTimeSeriesPoint[],
  landingPageGa4ByBucket: Map<string, Pick<ProductTimeSeriesPoint, 'ga4_sessions' | 'ga4_engaged_sessions' | 'ga4_purchases' | 'ga4_revenue'>>
) {
  return points.map((point) => ({
    ...point,
    ga4_sessions: landingPageGa4ByBucket.get(point.bucket)?.ga4_sessions ?? 0,
    ga4_engaged_sessions: landingPageGa4ByBucket.get(point.bucket)?.ga4_engaged_sessions ?? 0,
    ga4_purchases: landingPageGa4ByBucket.get(point.bucket)?.ga4_purchases ?? 0,
    ga4_revenue: landingPageGa4ByBucket.get(point.bucket)?.ga4_revenue ?? 0,
  }));
}

function isRelevantWrapupEmail(config: SpartacoWrapupConfig, row: Pick<ActOnEmailRow, 'email_name' | 'subject_line'>): boolean {
  const searchable = `${row.email_name ?? ''} ${row.subject_line ?? ''}`.toLowerCase();
  const terms = config.emailSearchTerms ?? ['material handling', 'material lifting', 'material', 'lift', 'lifts', 'lifting', 'power ascender', 'titan lift', 'ronin-lift'];
  return terms.some((term) => searchable.includes(term.toLowerCase()));
}

function emailSearchOrFilter(config: SpartacoWrapupConfig): string {
  const terms = config.emailSearchTerms ?? ['Material', 'Lift', 'Handling', 'Ascender', 'Titan'];
  return terms
    .flatMap((term) => [`email_name.ilike.%${term}%`, `subject_line.ilike.%${term}%`])
    .join(',');
}

async function buildEmailDetails(config: SpartacoWrapupConfig) {
  const supabase = createSpartacoSupabaseClient();
  const { data, error } = await supabase
    .from('act_on_emails')
    .select('id,email_id,email_name,subject_line,total_sent,opens,clicks,open_rate,click_rate,report_date')
    .gte('report_date', config.campaignStart)
    .lte('report_date', config.campaignEnd)
    .or(emailSearchOrFilter(config))
    .order('report_date', { ascending: true })
    .limit(25);

  if (error) throw error;

  return ((data ?? []) as ActOnEmailRow[])
    .filter((row) => row.report_date)
    .filter((row) => isRelevantWrapupEmail(config, row))
    .map((row) => {
      const name = row.email_name ?? 'Untitled email';
      const subjectLine = row.subject_line ?? name;
      return {
        id: row.id,
        emailId: row.email_id,
        date: row.report_date!,
        name,
        subjectLine,
        totalSent: Number(row.total_sent) || 0,
        opens: Number(row.opens) || 0,
        clicks: Number(row.clicks) || 0,
        openRate: Number(row.open_rate) ? Number(row.open_rate) / 100 : 0,
        clickRate: Number(row.click_rate) ? Number(row.click_rate) / 100 : 0,
        relevance: 'Product-specific' as const,
      };
    })
    .sort((a, b) => b.totalSent - a.totalSent);
}

async function buildComprehensiveSourceMediumRows(
  config: SpartacoWrapupConfig,
  paidLeadRows: TrafficBreakdownRow[]
): Promise<TrafficBreakdownRow[]> {
  const data = await fetchLandingPageGa4Rows(config, config.campaignStart, config.campaignEnd);

  type Acc = TrafficBreakdownRow;
  const rows = new Map<string, Acc>();

  for (const row of data) {
    const key = sourceMediumKey(row.ga4_source, row.ga4_medium);
    if (!key) continue;
    const [label, sublabel] = key.split(' / ');
    const existing = rows.get(key) ?? {
      label,
      sublabel,
      channelGroup: row.ga4_default_channel_group ?? undefined,
      ga4_sessions: 0,
      prev_sessions: 0,
      ga4_engaged_sessions: 0,
      prev_engaged: 0,
      tracked_leads: 0,
      prev_tracked_leads: 0,
      ga4_purchases: 0,
      prev_purchases: 0,
      ga4_total_revenue: 0,
      prev_revenue: 0,
      ga4_add_to_carts: 0,
      prev_carts: 0,
    };
    existing.ga4_sessions += Number(row.ga4_sessions) || 0;
    existing.ga4_engaged_sessions += Number(row.ga4_engaged_sessions) || 0;
    existing.ga4_purchases += Number(row.ga4_purchases) || 0;
    existing.ga4_total_revenue += Number(row.ga4_total_revenue) || 0;
    existing.ga4_add_to_carts += Number(row.ga4_add_to_carts) || 0;
    rows.set(key, existing);
  }

  // Merge paid lead/conversion counts from the product attribution layer into the
  // comprehensive GA4 source/medium table. This preserves organic/direct/referral
  // traffic while still showing the known paid outcomes by source.
  for (const paid of paidLeadRows) {
    if (!paid.tracked_leads) continue;
    const key = `${paid.label} / ${paid.sublabel ?? '(none)'}`;
    const existing = rows.get(key) ?? {
      label: paid.label,
      sublabel: paid.sublabel,
      channelGroup: paid.channelGroup,
      ga4_sessions: 0,
      prev_sessions: 0,
      ga4_engaged_sessions: 0,
      prev_engaged: 0,
      tracked_leads: 0,
      prev_tracked_leads: 0,
      ga4_purchases: 0,
      prev_purchases: 0,
      ga4_total_revenue: 0,
      prev_revenue: 0,
      ga4_add_to_carts: 0,
      prev_carts: 0,
    };
    existing.tracked_leads += paid.tracked_leads;
    existing.channelGroup = existing.channelGroup ?? paid.channelGroup;
    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((a, b) => {
    const aScore = a.ga4_sessions + a.tracked_leads;
    const bScore = b.ga4_sessions + b.tracked_leads;
    return bScore - aScore;
  });
}

function buildOutcomeAttribution(
  duringData: Awaited<ReturnType<typeof fetchSpartacoProductData>>,
  duringSummary: ProductPerformanceRow,
  sourceMediumRows: TrafficBreakdownRow[]
) {
  const paidTrafficRows = sourceMediumRows.filter((row) => isPaidChannelGroup(row.channelGroup ?? row.label));
  const paidSessions = paidTrafficRows.reduce((sum, row) => sum + row.ga4_sessions, 0);
  const paidEngagedSessions = paidTrafficRows.reduce((sum, row) => sum + row.ga4_engaged_sessions, 0);

  return {
    totalTrackedLeads: duringSummary.ad_conversions,
    paidTrackedLeads: duringSummary.ad_conversions,
    nonPaidTrackedLeads: null,
    totalOnlineSales: duringSummary.ga4_purchases,
    paidAttributedSales: duringSummary.ad_purchases,
    totalSessions: duringSummary.ga4_sessions,
    paidSessions,
    haloSessions: Math.max(0, duringSummary.ga4_sessions - paidSessions),
    totalEngagedSessions: duringSummary.ga4_engaged_sessions,
    paidEngagedSessions,
    haloEngagedSessions: Math.max(0, duringSummary.ga4_engaged_sessions - paidEngagedSessions),
  };
}

async function buildEmailBenchmark(config: SpartacoWrapupConfig) {
  const allProducts = await fetchSpartacoProductData({
    ...BASE_PARAMS,
    brand: config.brand,
    product: 'all',
    start: config.campaignStart,
    end: config.campaignEnd,
    compStart: config.beforeStart,
    compEnd: config.beforeEnd,
  });

  const comparable = allProducts.productRows.filter((row) => row.email_total_sent > 0);
  const sent = comparable.reduce((sum, row) => sum + row.email_total_sent, 0);
  const opens = comparable.reduce((sum, row) => sum + row.email_opens, 0);
  const clicks = comparable.reduce((sum, row) => sum + row.email_clicks, 0);

  const product = allProducts.productRows.find((row) => row.product === config.product)
    ?? allProducts.productRows.find((row) => row.product === config.parentProduct);

  return {
    productSent: product?.email_total_sent ?? 0,
    productOpenRate: product ? openRate(product) : 0,
    productClickRate: product ? clickRate(product) : 0,
    productClicks: product?.email_clicks ?? 0,
    comparableProducts: comparable.length,
    avgOpenRate: sent > 0 ? opens / sent : 0,
    avgClickRate: sent > 0 ? clicks / sent : 0,
  };
}

async function buildPaidOverview(config: SpartacoWrapupConfig, during: ProductPerformanceRow) {
  const allProducts = await fetchSpartacoProductData({
    ...BASE_PARAMS,
    brand: 'all',
    product: 'all',
    start: config.campaignStart,
    end: config.campaignEnd,
    compStart: config.beforeStart,
    compEnd: config.beforeEnd,
  });

  const comparableProducts = allProducts.productRows
    .filter((row) => row.product !== config.product)
    .filter((row) => row.ad_cost > 0 && row.ad_conversions > 0);
  const benchmarkCost = comparableProducts.reduce((sum, row) => sum + row.ad_cost, 0);
  const benchmarkLeads = comparableProducts.reduce((sum, row) => sum + row.ad_conversions, 0);
  const benchmarkCpl = benchmarkLeads > 0 ? benchmarkCost / benchmarkLeads : null;
  const cpl = during.ad_conversions > 0 ? during.ad_cost / during.ad_conversions : 0;
  const cplRankedProducts = allProducts.productRows
    .filter((row) => row.ad_cost > 0 && row.ad_conversions > 0)
    .map((row) => ({ product: row.product, cpl: row.ad_cost / row.ad_conversions }))
    .sort((a, b) => a.cpl - b.cpl);
  const cplRank = cplRankedProducts.findIndex((row) => row.product === config.product);

  return {
    impressions: during.ad_impressions,
    clicks: during.ad_clicks,
    ctr: during.ad_impressions > 0 ? during.ad_clicks / during.ad_impressions : 0,
    cost: during.ad_cost,
    cpc: during.ad_clicks > 0 ? during.ad_cost / during.ad_clicks : 0,
    leads: during.ad_conversions,
    cpl,
    revenue: during.ad_revenue,
    purchases: during.ad_purchases,
    roas: during.ad_cost > 0 ? during.ad_revenue / during.ad_cost : 0,
    benchmarkCpl,
    benchmarkProducts: comparableProducts.length,
    cplDelta: benchmarkCpl && cpl > 0 ? (cpl - benchmarkCpl) / benchmarkCpl : null,
    cplRank: cplRank >= 0 ? cplRank + 1 : null,
  };
}

function leadBucketForAd(row: WrapupAdRow): Pick<LeadCaptureBreakdownRow, 'key' | 'label' | 'description'> {
  const campaign = (row.campaign_name ?? '').toLowerCase();
  const channel = (row.ad_channel ?? '').toLowerCase();
  const origem = (row.ad_origem ?? '').toLowerCase();

  if (channel.includes('meta') || origem.includes('meta') || campaign.includes('[lead]') && (campaign.includes('facebook') || channel.includes('meta'))) {
    if (
      campaign.includes('utility pole maintenance') ||
      campaign.includes('rodders - select your rodder') ||
      campaign.includes('little buddy-telecom') ||
      campaign.includes('little buddy-electrical') ||
      campaign.includes('fiber driver- fiber driver with air boost') ||
      campaign.includes('hot-stick tree tools') ||
      campaign.includes('cable benders')
    ) {
      return {
        key: 'facebook_lead_ads',
        label: 'Meta Website Conversions',
        description: 'Website-driving Meta conversion campaign. CPL is based on tracked website conversions, not native instant-form leads.',
      };
    }

    return {
      key: 'facebook_lead_ads',
      label: 'Facebook Lead Ads',
      description: 'Native Meta/Facebook lead forms: lower-friction and usually lower CPL.',
    };
  }

  if (channel.includes('google') || origem.includes('google') || campaign.includes('p.max') || campaign.includes('[sales]')) {
    return {
      key: 'onsite_google_ads',
      label: 'On-site / Google Ads',
      description: 'Website-driving Google, PMax, search, or sales campaigns. Usually higher intent and higher CPL.',
    };
  }

  return {
    key: 'other_paid',
    label: 'Other Paid',
    description: 'Paid campaign rows that do not cleanly classify as Meta lead ads or on-site/search ads.',
  };
}

async function buildLeadCaptureBreakdown(config: SpartacoWrapupConfig): Promise<LeadCaptureBreakdownRow[]> {
  const supabase = createSpartacoSupabaseClient();
  const { data, error } = await supabase
    .from('spartaco_master_products')
    .select('campaign_name,ad_channel,ad_origem,ad_impressions,ad_clicks,ad_cost,ad_conversions')
    .eq('source', 'ads')
    .gte('date', config.campaignStart)
    .lte('date', config.campaignEnd)
    .in('campaign_name', config.campaignNames)
    .limit(10000);

  if (error) throw error;

  const buckets = new Map<LeadCaptureBreakdownRow['key'], LeadCaptureBreakdownRow>();
  for (const row of (data ?? []) as WrapupAdRow[]) {
    const bucket = leadBucketForAd(row);
    const existing = buckets.get(bucket.key) ?? {
      ...bucket,
      impressions: 0,
      clicks: 0,
      cost: 0,
      leads: 0,
      cpl: null,
      campaigns: [],
    };
    existing.impressions += Number(row.ad_impressions) || 0;
    existing.clicks += Number(row.ad_clicks) || 0;
    existing.cost += Number(row.ad_cost) || 0;
    existing.leads += Number(row.ad_conversions) || 0;
    if (row.campaign_name && !existing.campaigns.includes(row.campaign_name)) existing.campaigns.push(row.campaign_name);
    buckets.set(bucket.key, existing);
  }

  return Array.from(buckets.values())
    .map((row) => ({ ...row, cpl: row.leads > 0 ? row.cost / row.leads : null }))
    .sort((a, b) => {
      const order = { facebook_lead_ads: 0, onsite_google_ads: 1, other_paid: 2 } as const;
      return order[a.key] - order[b.key];
    });
}

export function getSpartacoWrapup(slug: string): SpartacoWrapupConfig | null {
  return SPARTACO_WRAPUPS.find((wrapup) => wrapup.slug === slug) ?? null;
}

export async function fetchSpartacoProductWrapup(slug: string): Promise<SpartacoProductWrapup | null> {
  const config = getSpartacoWrapup(slug);
  if (!config) return null;

  const fullWindowParams = paramsFor(config, config.beforeStart, config.afterEnd);

  const [beforeData, duringData, afterData, fullWindowData, emailBenchmark, emailDetails, metaAdsByBrand, leadCaptureBreakdown, beforeLandingGa4, duringLandingGa4, afterLandingGa4, fullWindowLandingGa4, duringCampaignAdRows] = await Promise.all([
    fetchSpartacoProductData(paramsFor(config, config.beforeStart, config.beforeEnd)),
    fetchSpartacoProductData(paramsFor(config, config.campaignStart, config.campaignEnd)),
    fetchSpartacoProductData(paramsFor(config, config.afterStart, config.afterEnd)),
    fetchSpartacoProductData(fullWindowParams),
    buildEmailBenchmark(config),
    buildEmailDetails(config),
    fetchSpartacoMetaAds({
      mode: 'ALL',
      params: fullWindowParams,
      campaignNames: config.campaignNames,
    }),
    buildLeadCaptureBreakdown(config),
    fetchLandingPageGa4Rows(config, config.beforeStart, config.beforeEnd),
    fetchLandingPageGa4Rows(config, config.campaignStart, config.campaignEnd),
    fetchLandingPageGa4Rows(config, config.afterStart, config.afterEnd),
    fetchLandingPageGa4Rows(config, config.beforeStart, config.afterEnd),
    fetchCampaignAdRows(config, config.campaignStart, config.campaignEnd),
  ]);

  const duringCampaignAdSummary = summarizeCampaignAdRows(duringCampaignAdRows);
  const before = zeroPaidMetrics(withLandingPageGa4(beforeData.summary, beforeLandingGa4));
  const during = withEmailDetails(withCampaignAdSummary(withLandingPageGa4(duringData.summary, duringLandingGa4), duringCampaignAdSummary), emailDetails);
  const after = zeroPaidMetrics(withLandingPageGa4(afterData.summary, afterLandingGa4));
  const campaignPaidTrafficRows = buildCampaignPaidTrafficRows(duringCampaignAdRows);
  const [sourceMediumRows, paidOverview] = await Promise.all([
    buildComprehensiveSourceMediumRows(config, campaignPaidTrafficRows),
    buildPaidOverview(config, during),
  ]);
  const fullWindowTimeSeries = zeroPaidMetricsOutsideCampaign(fillTimeSeriesWindow(
    fullWindowData.timeSeries,
    fullWindowData.timeSeriesGrain,
    config.beforeStart,
    config.afterEnd
  ), config, fullWindowData.timeSeriesGrain);
  const landingPageGa4TimeSeries = buildLandingPageGa4TimeSeries(fullWindowLandingGa4, fullWindowData.timeSeriesGrain);

  return {
    config,
    periods: [
      { key: 'before', label: '4w Before', start: config.beforeStart, end: config.beforeEnd, summary: before },
      { key: 'during', label: 'Campaign Period', start: config.campaignStart, end: config.campaignEnd, summary: during },
      { key: 'after', label: '4w After', start: config.afterStart, end: config.afterEnd, summary: after },
    ],
    fullWindowTimeSeries: mergeLandingPageGa4TimeSeries(fullWindowTimeSeries, landingPageGa4TimeSeries),
    fullWindowTimeSeriesGrain: fullWindowData.timeSeriesGrain,
    sourceMediumRows,
    emailDetails: emailDetails.slice(0, 6),
    metaAds: metaAdsByBrand[config.brand] ?? [],
    outcomeAttribution: buildOutcomeAttribution(duringData, during, sourceMediumRows),
    leadCaptureBreakdown,
    emailBenchmark,
    paidOverview,
    gscLift: {
      duringVsBeforeImpressions: pctChange(during.gsc_impressions, before.gsc_impressions),
      afterVsDuringImpressions: pctChange(after.gsc_impressions, during.gsc_impressions),
      duringVsBeforeClicks: pctChange(during.gsc_clicks, before.gsc_clicks),
      afterVsDuringClicks: pctChange(after.gsc_clicks, during.gsc_clicks),
      duringVsBeforeKeywords: pctChange(during.gsc_keywords_ranked, before.gsc_keywords_ranked),
      afterVsDuringKeywords: pctChange(after.gsc_keywords_ranked, during.gsc_keywords_ranked),
    },
  };
}
