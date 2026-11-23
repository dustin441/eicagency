/** Company-name evidence only. Never use contact names, addresses, tags or match IDs. */
export type CompanyEvidence = { companyName?: string | null; companyEvidenceAvailable?: boolean };
export type NameSignalLabel = 'HVAC-related name signal' | 'No recognizable name signal' | 'Company missing' | 'Evidence unavailable';
export type CompanyNameSignal = { label: NameSignalLabel; company: string | null; terms: string[] };
const NAME_TERMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['HVAC', /\bhvac\b/i],
  ['heating', /\bheating\b/i],
  ['cooling', /\bcooling\b/i],
  ['refrigeration', /\brefrigeration\b/i],
  ['air conditioning', /\bair[\s-]+conditioning\b/i],
];

export const DUROLINE_QUALITY_STAGES = ['Interested - Small', 'Interested', 'Finding Distributor', 'Sent To Sales'] as const;

/** Percent of all HighLevel opportunities in the date cohort, never of owner/search results. */
export function cohortPercentage(count: number, total: number): number | null {
  return total > 0 ? count / total * 100 : null;
}

export function summarizeBuyerFit(leads: ReadonlyArray<CompanyEvidence & { stage: string }>) {
  const evidence = leads.map(lead => ({ ...classifyCompanyName(lead), quality: DUROLINE_QUALITY_STAGES.some(stage => stage === lead.stage) }));
  const total = leads.length;
  const signal = evidence.filter(item => item.label === 'HVAC-related name signal').length;
  const unavailable = evidence.filter(item => item.label === 'Evidence unavailable').length;
  const evidenceRead = total - unavailable;
  const stageQuality = evidence.filter(item => item.quality).length;
  const small = leads.filter(lead => lead.stage === 'Interested - Small').length;
  const companyMissing = evidence.filter(item => item.label === 'Company missing').length;
  return {
    total, signal, unavailable, evidenceRead, stageQuality, small, companyMissing,
    companyPresent: evidenceRead - companyMissing,
    noSignal: evidence.filter(item => item.label === 'No recognizable name signal').length,
    signalAndQuality: evidence.filter(item => item.label === 'HVAC-related name signal' && item.quality).length,
    signalNotQuality: evidence.filter(item => item.label === 'HVAC-related name signal' && !item.quality).length,
    signalPercentage: evidenceRead ? cohortPercentage(signal, total) : null,
    qualityPercentage: cohortPercentage(stageQuality, total),
    smallPercentage: cohortPercentage(small, total),
    readPercentage: cohortPercentage(evidenceRead, total),
  };
}

/** Inclusive calendar-day range anchored only to the server's evaluatedAt, in UTC. */
export function durolineCohortPreset(evaluatedAt: string, days: 30 | 90): { start: string; end: string } | null {
  const anchor = new Date(evaluatedAt);
  if (!Number.isFinite(anchor.getTime())) return null;
  const end = anchor.toISOString().slice(0, 10);
  anchor.setUTCDate(anchor.getUTCDate() - (days - 1));
  return { start: anchor.toISOString().slice(0, 10), end };
}

export function classifyCompanyName(lead: CompanyEvidence): CompanyNameSignal {
  if (lead.companyEvidenceAvailable !== true) return { label: 'Evidence unavailable', company: null, terms: [] };
  const company = lead.companyName?.trim() || null;
  const placeholder = company?.toLowerCase().replace(/[\s./_-]+/g, '') ?? '';
  if (!company || !placeholder || ['none', 'self', 'na', 'myself', 'null', 'undefined', 'notavailable', 'notapplicable', 'unknown', 'nocompany'].includes(placeholder)) {
    return { label: 'Company missing', company: null, terms: [] };
  }
  const terms = NAME_TERMS.filter(([, pattern]) => pattern.test(company)).map(([term]) => term);
  return { label: terms.length ? 'HVAC-related name signal' : 'No recognizable name signal', company, terms };
}
