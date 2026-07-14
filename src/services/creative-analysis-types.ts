import type { MetaCreative, MetaCreativeSummary, GoogleCreative } from '@/services/analytics';
import type { CreativeAiInsight } from '@/services/creative-ai-insights';

// Image asset for PMax (used by Kinsey and Spartaco).
export type PmaxImageCreative = {
  id: string;
  name: string;
  imageUrl: string;
  type: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
};

// Shared data shape for every single-brand client's "Ad Analysis" tab
// (Kinsey, Arabella, CBA, Bloom, Duro Dyne). Unlike Spartaco/NSI, these
// clients have exactly one brand and one channel (Meta), so one type/one
// component covers all of them.
// googleSearch and googlePmax are optional — only populated for clients
// that run Google Ads (currently Kinsey).
export type CreativeAnalysis = {
  creatives: MetaCreative[];
  summary: MetaCreativeSummary;
  aiInsight: CreativeAiInsight | null;
  googleSearch?: GoogleCreative[];
  googlePmax?: PmaxImageCreative[];
};
