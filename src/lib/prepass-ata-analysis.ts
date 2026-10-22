export type AtaAnalysisMetricRow = {
  platform: 'Google' | 'Meta' | 'LinkedIn';
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  reach: number | null;
  frequency: number | null;
};

export type AtaAnalysisPhase = {
  id: 'pre-event' | 'during-event';
  label: string;
  dates: string;
  rows: readonly AtaAnalysisMetricRow[];
  observations: readonly string[];
};

export type AtaGroundTruthSnapshotRow = {
  adGroupId: string;
  adGroupName: string;
  channel: 'DOOH' | 'Mobile';
  start: string;
  end: string;
  spend: number;
  impressions: number;
  clicks: number | null;
  reach: number | null;
  screens: number | null;
};

export const ATA_GROUNDTRUTH_SNAPSHOT: readonly AtaGroundTruthSnapshotRow[] = [
  { adGroupId: '8118731', adGroupName: 'Intersection Air Transit | Airports', channel: 'DOOH', start: '2026-10-15', end: '2026-10-16', spend: 836.25, impressions: 49191, clicks: null, reach: null, screens: 50 },
  { adGroupId: '8118943', adGroupName: 'TVM Entertainment | Bars', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 35.03, impressions: 3892, clicks: null, reach: null, screens: 10 },
  { adGroupId: '8118940', adGroupName: 'Orange Barrel Media Outdoor | Billboards | Spectacular', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 999.60, impressions: 4998, clicks: null, reach: null, screens: 3 },
  { adGroupId: '8118937', adGroupName: 'Atmosphere TV Entertainment | Casual Dining', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 78.35, impressions: 8706, clicks: null, reach: null, screens: 2 },
  { adGroupId: '8118934', adGroupName: 'TouchTunes Entertainment | Casual Dining', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 108.28, impressions: 9023, clicks: null, reach: null, screens: 1 },
  { adGroupId: '8118931', adGroupName: 'Orange Barrel Media Outdoor | Urban Panels', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 943.09, impressions: 41797, clicks: null, reach: null, screens: 2 },
  { adGroupId: '8118928', adGroupName: 'TVM Entertainment | Casual Dining', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 892.65, impressions: 105018, clicks: null, reach: null, screens: 26 },
  { adGroupId: '8118925', adGroupName: 'Screenverse + Vertical Impression Entertainment | Hotels', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 555.84, impressions: 15440, clicks: null, reach: null, screens: 2 },
  { adGroupId: '8118922', adGroupName: 'TouchTunes Entertainment | Bars', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 574.71, impressions: 38314, clicks: null, reach: null, screens: 4 },
  { adGroupId: '8118919', adGroupName: 'Taiv.tv Entertainment | Casual Dining', channel: 'DOOH', start: '2026-10-17', end: '2026-10-20', spend: 922.54, impressions: 93804, clicks: null, reach: null, screens: 8 },
  { adGroupId: 'mobile-hotels', adGroupName: 'Mobile | Official Hotels | 0.25mi | Broad', channel: 'Mobile', start: '2026-10-20', end: '2026-10-20', spend: 174.69, impressions: 4991, clicks: 38, reach: 499, screens: null },
  { adGroupId: 'mobile-convention-center', adGroupName: 'Mobile | Convention Center | 0.25mi | Broad', channel: 'Mobile', start: '2026-10-20', end: '2026-10-20', spend: 103.11, impressions: 2946, clicks: 29, reach: 340, screens: null },
  { adGroupId: 'mobile-new-ad-group', adGroupName: 'New Ad Group', channel: 'Mobile', start: '2026-10-19', end: '2026-10-20', spend: 102.80, impressions: 2937, clicks: 45, reach: 187, screens: null },
] as const;

/**
 * Completed native-platform snapshot collected 2026-10-22.
 * Google Ads account timezone: America/Chicago.
 * Meta Ads account timezone: America/Los_Angeles.
 * LinkedIn values use the account's local-currency reporting.
 */
export const ATA_EVENT_ANALYSIS = {
  collectedAt: '2026-10-22',
  phases: [
    {
      id: 'pre-event',
      label: 'Pre-event',
      dates: 'Oct 5–16, 2026',
      rows: [
        { platform: 'Google', campaignId: '24301231173', campaignName: 'ATA Event | PrePass | Demand Gen', spend: 2999.321534, impressions: 166267, clicks: 1915, conversions: 9.942054, reach: null, frequency: null },
        { platform: 'Google', campaignId: '24301231161', campaignName: 'ATA Event | PrePass | Search', spend: 1710.756204, impressions: 1996, clicks: 141, conversions: 5.4805, reach: null, frequency: null },
        { platform: 'Meta', campaignId: '120249523811860438', campaignName: 'Website visits | PrePass | ATA MCE 2026 PreEvent', spend: 599.69, impressions: 28900, clicks: 393, conversions: 0, reach: 17634, frequency: 1.638879 },
        { platform: 'Meta', campaignId: '120249616006280438', campaignName: 'Conversions | PrePass | ATA MCE 2026 PreEvent', spend: 311.08, impressions: 6072, clicks: 62, conversions: 2, reach: 1565, frequency: 3.879872 },
        { platform: 'LinkedIn', campaignId: '901952304', campaignName: 'Retarget + Attendee List ATA MCE 2026', spend: 669.100000095, impressions: 7524, clicks: 62, conversions: 0, reach: null, frequency: null },
      ],
      observations: [
        'Google Demand Gen produced the most native conversions (9.94) and nearly all Google scale; Search had the strongest CTR (7.06%) but a $12.13 CPC.',
        'Meta Website Visits generated 393 clicks at $1.53 CPC. The Conversions campaign produced 2 leads at $155.54 CPL, but frequency reached 3.88.',
        'LinkedIn delivered 62 clicks at $10.79 CPC with no reported conversion. Office was the strongest creative by click efficiency; Laptop was the weakest.',
      ],
    },
    {
      id: 'during-event',
      label: 'During the event',
      dates: 'Oct 17–20, 2026',
      rows: [
        { platform: 'Google', campaignId: '24301231173', campaignName: 'ATA Event | PrePass | Demand Gen', spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: null, frequency: null },
        { platform: 'Google', campaignId: '24301231161', campaignName: 'ATA Event | PrePass | Search', spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: null, frequency: null },
        { platform: 'Meta', campaignId: '120249523811860438', campaignName: 'Website visits | PrePass | ATA MCE 2026 PreEvent', spend: 2393.58, impressions: 154477, clicks: 2019, conversions: 0, reach: 52023, frequency: 2.969398 },
        { platform: 'Meta', campaignId: '120249616006280438', campaignName: 'Conversions | PrePass | ATA MCE 2026 PreEvent', spend: 253.39, impressions: 2243, clicks: 24, conversions: 0, reach: 841, frequency: 2.667063 },
        { platform: 'LinkedIn', campaignId: '903512924', campaignName: 'Primer ATA 2026', spend: 550.56, impressions: 6065, clicks: 97, conversions: 0, reach: null, frequency: null },
        { platform: 'LinkedIn', campaignId: '901952304', campaignName: 'Retarget + Attendee List ATA MCE 2026', spend: 0, impressions: 0, clicks: 0, conversions: 1, reach: null, frequency: null },
      ],
      observations: [
        'Google had no delivery because both event campaigns ended Oct 16.',
        'Meta Website Visits scaled to 2,019 clicks at $1.19 CPC. The Conversions campaign spent $253.39 without a lead and was the weakest campaign in this phase.',
        'LinkedIn Primer improved to 1.60% CTR and $5.68 CPC. Tease was the best creative; Truck was weaker. One conversion was attributed to the earlier Retarget campaign after its delivery ended.',
      ],
    },
  ] satisfies AtaAnalysisPhase[],
  ga4: {
    location: 'Charlotte, North Carolina',
    baselineDates: 'Sep 19–Oct 16, 2026',
    eventDates: 'Oct 17–20, 2026',
    organicSearch: { baselineSessions: 164, baselineDaily: 5.857142857, eventSessions: 30, eventDaily: 7.5, sameWeekdayExpected: 20, liftVsDailyBaselinePct: 28.04878049, liftVsSameWeekdaysPct: 50 },
    direct: { baselineSessions: 180, baselineDaily: 6.428571429, eventSessions: 43, eventDaily: 10.75, sameWeekdayExpected: 21, liftVsDailyBaselinePct: 67.22222222, liftVsSameWeekdaysPct: 104.7619048 },
    conclusion: 'Yes—GA4 shows a directional Charlotte lift during the event. Organic Search sessions were 50% above the same-weekday baseline and Direct sessions were 105% above it. The four-day sample is small, and Direct traffic does not prove search demand, so this is evidence of lift rather than proof of causation.',
  },
  highlights: [
    'Best for conversion volume: Google Demand Gen before the event (9.94 native primary conversions).',
    'Best for event-period traffic: Meta Website Visits (2,019 clicks at $1.19 CPC).',
    'Weakest conversion result: Meta Conversions during the event ($253.39 spend, 0 leads).',
    'GroundTruth delivered 381,057 impressions on $6,326.94 spend; Mobile produced 112 clicks at 1.03% CTR.',
  ],
  groundTruth: {
    totalSpend: 6326.94,
    totalImpressions: 381057,
    totalClicks: 112,
    preEvent: { spend: 836.25, impressions: 49191, clicks: 0 },
    duringEvent: { spend: 5490.69, impressions: 331866, clicks: 112 },
    doohDuring: { spend: 5110.09, impressions: 320992, screens: 58 },
    mobileDuring: { spend: 380.60, impressions: 10874, clicks: 112, reportedReach: 1026 },
    rows: ATA_GROUNDTRUTH_SNAPSHOT,
    note: 'Reach is reported by Mobile ad group and is not deduplicated across ad groups. DOOH screenshots report screen counts instead of clicks or reach.',
  },
  detail: {
    google: {
      preEvent: 'Demand Gen ad “ATA MCE | Bypass Beginning” drove 5.00 conversions; “Answers Parking” had the best meaningful ad-level CPL at $206.48. “Bypass Toll Reveal” spent $670.71 with 0 conversions and was the weakest material ad.',
      duringEvent: 'No delivery. Both ATA Google campaigns ended Oct 16.',
      caveat: 'Google conversions are native primary conversions and can be fractional under data-driven attribution; they are not deduplicated people.',
    },
    meta: {
      preEvent: 'For website traffic, the Retarget + Attendee List ad set led with 353 clicks; Truck was its strongest ad. For leads, Primer produced 1 lead on $75.86 spend versus 1 on $235.22 for Retarget. Laptop was the weakest traffic ad.',
      duringEvent: 'The Charlotte Convention Center ad set drove 1,856 clicks; Tease led with 990 clicks. The Conversions campaign produced no leads; Retarget Truck was its highest-spend zero-lead ad ($96.08).',
    },
    linkedin: {
      preEvent: 'Office was the best creative by CPC ($9.24); Laptop was the weakest ($12.65 CPC). No conversion was reported.',
      duringEvent: 'Tease led with 69 clicks at $4.58 CPC. Truck delivered 28 clicks at $8.37 CPC. The single conversion was attributed to the earlier Retarget campaign after delivery ended.',
    },
  },
} as const;
