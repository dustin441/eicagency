/** Only submitted contact values, never prompts, tags, owners or matching identifiers. */
export type CompanyEvidence = { companyName?: string | null; companyEvidenceAvailable?: boolean };
export type IndustryEvidence = CompanyEvidence & {
  industryFields?: Array<{ field: string; value: string }>;
  industryEvidenceAvailable?: boolean;
};
export type NameSignalLabel = 'HVAC-related name signal' | 'No recognizable name signal' | 'Company missing' | 'Evidence unavailable';
export type CompanyNameSignal = { label: NameSignalLabel; company: string | null; terms: string[] };
export const INDUSTRY_FIELD_LABELS = {
  firstName: 'First name', lastName: 'Last name', email: 'Email',
  company: 'Company (form)', companyName: 'Company (standard)',
  jobTitle: 'Job Title', role: 'What best describes your role', identity: 'I am a…', message: 'Message',
} as const;
export type IndustryField = keyof typeof INDUSTRY_FIELD_LABELS;
const NAME_TERMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['HVAC', /\bhvac\b/i], ['heating', /\bheating\b/i], ['cooling', /\bcooling\b/i],
  ['refrigeration', /\brefrigeration\b/i], ['air conditioning', /\bair[\s-]+conditioning\b/i],
];
function usable(value?: string | null): string | null {
  const normalized = value?.toLowerCase().replace(/[\s./_-]+/g, '') ?? '';
  return !normalized || ['none', 'self', 'na', 'myself', 'null', 'undefined', 'notavailable', 'notapplicable', 'unknown', 'nocompany'].includes(normalized) ? null : value!;
}
function matchedTerms(value: string, email = false, submittedName = false): string[] {
  return NAME_TERMS.filter(([term, pattern]) => {
    if (pattern.test(value)) return true;
    if (submittedName && term === 'HVAC' && /hvac(?:r)?/i.test(value)) return true;
    if (!email) return false;
    // Embedded HVAC is explicit. Other compounds need a word-ending business term,
    // not arbitrary substrings (cheating, coolingwood, chair, mac, Scott).
    if (term === 'HVAC') return /hvac/i.test(value);
    const tokens = value.toLowerCase().split(/[^a-z]+/);
    if (term === 'heating') return tokens.some(token => /heating(?:(?:and)?(?:cooling|air(?:flow)?|ac|plumbing))?(?:llc|inc|co|company|services?|systems?|solutions?)?$/.test(token) && !/cheating/.test(token));
    if (term === 'cooling') return tokens.some(token => /cooling$/.test(token));
    if (term === 'refrigeration') return tokens.some(token => /refrigeration$/.test(token));
    return tokens.some(token => /airconditioning$/.test(token));
  }).map(([term]) => term);
}
export function industryFieldSource(field: string): 'Company' | 'Name' | 'Email' | 'Form answer' {
  return field === 'company' || field === 'companyName' ? 'Company' : field === 'firstName' || field === 'lastName' ? 'Name' : field === 'email' ? 'Email' : 'Form answer';
}
export function classifyIndustrySubmission(lead: IndustryEvidence) {
  const full = lead.industryEvidenceAvailable === true;
  const legacy = !full && lead.companyEvidenceAvailable === true;
  const fields = full ? (lead.industryFields ?? []).filter(item => Object.prototype.hasOwnProperty.call(INDUSTRY_FIELD_LABELS, item.field)) : legacy && lead.companyName ? [{ field: 'companyName', value: lead.companyName }] : [];
  const present = fields.filter(item => usable(item.value) !== null);
  const hits = present.flatMap(({ field, value }) => {
    const terms = matchedTerms(value, field === 'email', field === 'firstName' || field === 'lastName');
    return terms.length ? [{ field, value, terms }] : [];
  });
  const label = !full && !legacy ? 'Evidence unavailable' : hits.length ? 'HVAC-related submission signal' : !present.length ? 'Submission fields blank' : 'No recognizable submission signal';
  return { label, hits, terms: [...new Set(hits.flatMap(hit => hit.terms))], company: usable(lead.companyName)?.trim() ?? null, full, legacy };
}
export const DUROLINE_QUALITY_STAGES = ['Interested - Small', 'Interested', 'Finding Distributor', 'Sent To Sales'] as const;
/** Percent of all HighLevel opportunities in the date cohort, never owner/search results. */
export function cohortPercentage(count: number, total: number): number | null {
  return total > 0 ? count / total * 100 : null;
}
export function summarizeBuyerFit(leads: ReadonlyArray<IndustryEvidence & { stage: string }>) {
  const evidence = leads.map(lead => ({ ...classifyIndustrySubmission(lead), quality: DUROLINE_QUALITY_STAGES.some(stage => stage === lead.stage) }));
  const total = leads.length;
  const signal = evidence.filter(item => item.hits.length > 0).length;
  const unavailable = evidence.filter(item => item.label === 'Evidence unavailable').length;
  const evidenceRead = total - unavailable;
  const stageQuality = evidence.filter(item => item.quality).length;
  const small = leads.filter(lead => lead.stage === 'Interested - Small').length;
  const companyMissing = leads.filter(lead => lead.companyEvidenceAvailable && !usable(lead.companyName)).length;
  const sourceSignals = { Company: 0, Name: 0, Email: 0, 'Form answer': 0 };
  for (const item of evidence) for (const source of new Set(item.hits.map(hit => industryFieldSource(hit.field)))) sourceSignals[source]++;
  return {
    total, signal, unavailable, evidenceRead, stageQuality, small, companyMissing, sourceSignals,
    fullEvidenceRead: evidence.filter(item => item.full).length,
    legacyCompanyOnly: evidence.filter(item => item.legacy).length,
    fieldsBlank: evidence.filter(item => item.label === 'Submission fields blank').length,
    companyPresent: leads.filter(lead => lead.companyEvidenceAvailable && usable(lead.companyName)).length,
    noSignal: evidence.filter(item => item.label === 'No recognizable submission signal').length,
    signalAndQuality: evidence.filter(item => item.hits.length > 0 && item.quality).length,
    signalNotQuality: evidence.filter(item => item.hits.length > 0 && !item.quality).length,
    signalPercentage: evidenceRead ? cohortPercentage(signal, total) : null,
    qualityPercentage: cohortPercentage(stageQuality, total), smallPercentage: cohortPercentage(small, total),
    readPercentage: cohortPercentage(evidenceRead, total), fullReadPercentage: cohortPercentage(evidence.filter(item => item.full).length, total),
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
/** Compatibility API for older company-only consumers. */
export function classifyCompanyName(lead: CompanyEvidence): CompanyNameSignal {
  if (lead.companyEvidenceAvailable !== true) return { label: 'Evidence unavailable', company: null, terms: [] };
  const company = usable(lead.companyName)?.trim() ?? null;
  if (!company) return { label: 'Company missing', company: null, terms: [] };
  const terms = NAME_TERMS.filter(([term, pattern]) => (term === 'HVAC' ? /\bhvac\b/i : pattern).test(company)).map(([term]) => term);
  return { label: terms.length ? 'HVAC-related name signal' : 'No recognizable name signal', company, terms };
}
