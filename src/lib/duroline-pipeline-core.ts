import type { DurolineLead, DurolineDeal, DurolinePipelineSnapshot } from './duroline-pipeline-types';

export const QUALITY_STAGES = ['Interested - Small', 'Interested', 'Finding Distributor', 'Sent To Sales'];
export const GHL_LOCATION = 'KU4RlCj1mDVF6eNxwqcZ';
export const GHL_PIPELINE = 'DAtuQG1i9iWE5JGvK0a5';
export const MMC_ORGANIZATION = 75;
export const MMC_FUNNEL = 14159165;

type LeadInput = Omit<DurolineLead, 'quality' | 'mmcDealIds' | 'matchStatus'>;
type DealInput = Omit<DurolineDeal, 'salesState' | 'matchStatus'>;

export function salesStateForStage(stage: string, type: string): DurolineDeal['salesState'] {
  if (type === 'won') return 'won';
  if (type === 'lost') return 'lost';
  if (stage === 'Lead Generated') return 'awaiting_contact';
  if (stage === 'Contacted') return 'contacted';
  if (stage === 'Negotiating') return 'negotiating';
  if (stage === 'Qualified') return 'legacy_qualified';
  return 'other';
}

export function buildDurolineSnapshot(input: {
  leads: LeadInput[];
  deals: DealInput[];
  stageDefinitions: DurolinePipelineSnapshot['stageDefinitions'];
  capturedAt: string;
  entryStage: string | null;
}): DurolinePipelineSnapshot {
  const leads: DurolineLead[] = input.leads.map(x => ({ ...x, quality: QUALITY_STAGES.includes(x.stage), mmcDealIds: [], matchStatus: 'unmatched' }));
  const deals: DurolineDeal[] = input.deals.map(x => ({ ...x, salesState: salesStateForStage(x.stage, x.stageType), matchStatus: 'unmatched' }));
  const byId = new Map<string, DurolineLead>();
  const byContact = new Map<string, DurolineLead[]>();
  for (const lead of leads) {
    if (!lead.id || byId.has(lead.id)) throw new Error('Duplicate or missing HighLevel opportunity ID');
    byId.set(lead.id, lead);
    if (lead.contactId) byContact.set(lead.contactId, [...(byContact.get(lead.contactId) ?? []), lead]);
  }
  const seenDeals = new Set<number>();
  for (const deal of deals) {
    if (!Number.isSafeInteger(deal.id) || seenDeals.has(deal.id)) throw new Error('Duplicate or invalid MMC deal ID');
    seenDeals.add(deal.id);
    let candidates: DurolineLead[] = [];
    if (deal.highlevelOpportunityId) {
      const exact = byId.get(deal.highlevelOpportunityId);
      if (exact) candidates = [exact];
      // An explicit opportunity ID is authoritative. Do not attach a deleted or out-of-scope opportunity by contact.
      if (exact && deal.highlevelContactId && exact.contactId && exact.contactId !== deal.highlevelContactId) {
        deal.matchStatus = 'ambiguous';
        exact.matchStatus = 'ambiguous';
        continue;
      }
    } else if (deal.highlevelContactId) {
      candidates = byContact.get(deal.highlevelContactId) ?? [];
    }
    if (candidates.length > 1) {
      deal.matchStatus = 'ambiguous';
      for (const candidate of candidates) candidate.matchStatus = 'ambiguous';
    } else if (candidates.length === 1) {
      const candidate = candidates[0];
      deal.matchStatus = 'matched';
      if (candidate.matchStatus !== 'ambiguous') candidate.matchStatus = 'matched';
      candidate.mmcDealIds.push(deal.id);
    }
  }
  for (const lead of leads) {
    if (lead.mmcDealIds.length > 1) lead.matchStatus = 'ambiguous';
    if (lead.matchStatus === 'ambiguous') {
      for (const deal of deals) if (lead.mmcDealIds.includes(deal.id)) deal.matchStatus = 'ambiguous';
    }
  }
  const warnings: string[] = [];
  if (input.entryStage === 'Qualified') warnings.push('The handoff integration creates MMC deals in hidden Qualified. This is an automated handoff, not evidence of salesperson contact.');
  if (deals.some(x => x.matchStatus !== 'matched')) warnings.push('Some MMC deals cannot be uniquely matched to a current HighLevel Duro Line opportunity. These remain visible separately and do not receive matched-lead sales credit.');
  if (leads.some(x => x.matchStatus === 'ambiguous')) warnings.push('Conflicting identifiers or multiple records require review. Ambiguous matches are excluded from matched funnel counts.');
  warnings.push('Current stages are a snapshot, not a historical stage-entry ledger. No contact date or historical qualification date is inferred from an updated timestamp.');
  return {
    schemaVersion: 1, capturedAt: input.capturedAt,
    ghlLocationId: GHL_LOCATION, ghlPipelineId: GHL_PIPELINE,
    mmcOrganizationId: MMC_ORGANIZATION, mmcFunnelId: MMC_FUNNEL,
    leads, deals, qualityStages: [...QUALITY_STAGES], stageDefinitions: input.stageDefinitions,
    warnings, entryStage: input.entryStage,
  };
}
