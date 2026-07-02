import type { MetaCreative, MetaCreativeSummary } from '@/services/analytics';
import type { CreativeAiInsight } from '@/services/creative-ai-insights';

// Shared data shape for every single-brand client's "Ad Analysis" tab
// (Kinsey, Arabella, CBA, Bloom, Duro Dyne). Unlike Spartaco/NSI, these
// clients have exactly one brand and one channel (Meta), so one type/one
// component covers all of them.
export type CreativeAnalysis = {
  creatives: MetaCreative[];
  summary: MetaCreativeSummary;
  aiInsight: CreativeAiInsight | null;
};
