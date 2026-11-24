import type { DurolineDeal, DurolineLead } from './duroline-pipeline-types';
import { classifyIndustrySubmission, DUROLINE_QUALITY_STAGES } from './duroline-buyer-fit';

/** Current-state intersections, never a historical conversion funnel or revenue estimate. */
export function summarizeDurolineProgression(leads: DurolineLead[], deals: DurolineDeal[]) {
  const assessed = leads.map(lead => ({lead, evidence: classifyIndustrySubmission(lead)}));
  const unavailable = assessed.filter(item => item.evidence.category === 'unavailable').length;
  const legacy = assessed.filter(item => item.evidence.legacy).length;
  const trade = assessed.filter(item => ['direct', 'adjacent'].includes(item.evidence.category)).map(item => item.lead);
  const quality = trade.filter(lead => (DUROLINE_QUALITY_STAGES as readonly string[]).includes(lead.stage));
  const dealMap = new Map(deals.filter(deal => deal.matchStatus === 'matched').map(deal => [deal.id, deal]));
  const matches = (lead: DurolineLead) => lead.matchStatus === 'matched'
    ? [...new Set(lead.mmcDealIds)].flatMap(id => { const deal = dealMap.get(id); return deal ? [deal] : []; }) : [];
  return {
    total: leads.length, assessed: leads.length - unavailable, unavailable, legacy,
    tradeTotal: trade.length,
    tradeQuality: quality.length,
    tradeOutsideQuality: trade.length - quality.length,
    tradeSmall: trade.filter(lead => lead.stage === 'Interested - Small').length,
    tradeMatched: trade.filter(lead => matches(lead).length > 0).length,
    tradeWon: trade.filter(lead => matches(lead).some(deal => deal.salesState === 'won')).length,
  };
}
