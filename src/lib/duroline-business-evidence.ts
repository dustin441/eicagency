import 'server-only';
import type { DurolineLead } from '@/lib/duroline-pipeline-types';

export type ReviewedBusinessEvidence = {
  category: 'direct' | 'adjacent';
  description: string;
  sourceUrl: string;
};
export type BusinessReviewedLead = DurolineLead & { reviewedBusinessEvidence?: ReviewedBusinessEvidence };

/** Owner-reviewed public business facts live in private server config, never in Git.
 * Call only after client authorization. Exact email-domain matches only; this is
 * trade evidence, not personal-role verification or sales qualification.
 */
export function enrichReviewedBusinesses(leads: readonly DurolineLead[], config: string | undefined): BusinessReviewedLead[] {
  const clean: BusinessReviewedLead[] = leads.map(lead => {
    const clone: BusinessReviewedLead = { ...lead };
    delete clone.reviewedBusinessEvidence;
    return clone;
  });
  if (!config) return clean;
  let records: unknown;
  try { records = JSON.parse(config); } catch { return clean; }
  if (!Array.isArray(records) || records.length > 500) return clean;
  const byDomain = new Map<string, ReviewedBusinessEvidence>();
  const invalidDomains = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const { domain, category, description, sourceUrl } = record as Record<string, unknown>;
    if (typeof domain !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
      || (category !== 'direct' && category !== 'adjacent') || typeof description !== 'string'
      || !description.trim() || description.length > 500 || typeof sourceUrl !== 'string') continue;
    let source: URL;
    try { source = new URL(sourceUrl); } catch { continue; }
    if (source.protocol !== 'https:' || source.username || source.password) continue;
    const key = domain.toLowerCase();
    // Conflicting duplicate reviews never silently overwrite one another.
    if (byDomain.has(key)) { byDomain.delete(key); invalidDomains.add(key); continue; }
    if (!invalidDomains.has(key)) byDomain.set(key, { category, description: description.trim(), sourceUrl: source.href });
  }
  return leads.map(lead => {
    const clone: BusinessReviewedLead = { ...lead };
    // Re-enrichment never trusts a caller-supplied prior classification.
    delete clone.reviewedBusinessEvidence;
    if (lead.industryEvidenceAvailable !== true) return clone;
    const emails = (lead.industryFields ?? []).filter(field => field.field === 'email').map(field => field.value.trim());
    const reviews = emails.flatMap(email => {
      const match = /^[^\s@]+@([^\s@]+)$/.exec(email);
      const review = match ? byDomain.get(match[1].toLowerCase()) : undefined;
      return review ? [review] : [];
    });
    const distinct = [...new Map(reviews.map(review => [JSON.stringify(review), review])).values()];
    if (distinct.length === 1) clone.reviewedBusinessEvidence = distinct[0];
    return clone;
  });
}
