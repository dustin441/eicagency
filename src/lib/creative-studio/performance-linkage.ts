import { z } from 'zod';

// Pure contract only. No persistence, authentication, native verification or learning.
const Id = z.string().trim().min(1).max(300);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Instant = z.iso.datetime({ offset: true });
const Platform = z.enum(['meta', 'google_ads', 'linkedin']);
const Timezone = Id.refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Unknown timezone');
const Currency = z.string().regex(/^[A-Z]{3}$/); // Native ISO currency validity still needs external verification.
const AssetIdentitySchema = z.object({ projectId: Id, versionId: Id, assetId: Id, placementId: Id, assetSha256: Hash, recipeSha256: Hash }).strict();
export const PublicationBindingSchema = AssetIdentitySchema.extend({
 id: Id, tenantId: Id, ownerId: Id, platform: Platform, accountId: Id,
 campaignId: Id, adSetId: Id, adId: Id, creativeId: Id,
 validFrom: Instant, validTo: Instant, claim: z.literal('operator_claim'),
}).strict().refine(v => Date.parse(v.validFrom) < Date.parse(v.validTo), 'Publication interval must be nonempty');
export type PublicationBinding = z.infer<typeof PublicationBindingSchema>;
const WindowSchema = z.object({
 start: Instant, end: Instant, timezone: Timezone, currency: Currency,
 dateBasis: z.enum(['exposure_cohort', 'event_date']), cohortId: Id, attributionSettingsId: Id,
}).strict().refine(v => Date.parse(v.start) < Date.parse(v.end), 'Reporting interval must be nonempty');
const MonetaryGrainSchema = WindowSchema.safeExtend({
 role: z.enum(['media', 'net_realized_revenue', 'actual_cogs', 'nonmedia_cost']), grain: z.literal('ad_window'),
}).strict();
export const PerformanceEvidenceSchema = z.object({
 id: Id, bindingId: Id, tenantId: Id, platform: Platform, accountId: Id, adId: Id, creativeId: Id,
 lane: z.enum(['first_party_observed', 'external_inspiration', 'advertiser_reported', 'forecast']),
 kind: z.enum(['delivery', 'attributed_conversions', 'attributed_revenue', 'profit_roi', 'incremental_roi']),
 window: WindowSchema,
 source: z.object({ system: Id, revision: Id, manifestSha256: Hash, rowIds: z.array(Id).min(1) }).strict(),
 monetaryGrains: z.array(MonetaryGrainSchema),
 outcomes: z.array(z.object({ id: Id, sourceRevision: Id, provenanceRef: Id, definitionId: Id, touchpointId: Id, credit: z.number().finite().gt(0).max(1) }).strict()),
}).strict();
export type PerformanceEvidence = z.infer<typeof PerformanceEvidenceSchema>;
const ConfirmationsSchema = z.object({
 delivery: Id.optional(), settings: Id.optional(), coverage: Id.optional(), outcomes: Id.optional(),
 attribution: Id.optional(), cohort: Id.optional(), revenue: Id.optional(), refunds: Id.optional(),
 costs: Id.optional(), causal_design: Id.optional(),
}).strict();
/** SERVER-ONLY TRUST BOUNDARY: never construct this context from request JSON.
 * References mean an external verifier has completed the named review for the exact snapshot.
 * This module checks consistency, not whether attestations are honest or authentic.
 */
export const TrustedPerformanceContextSchema = z.object({
 tenantId: Id, ownerId: Id,
 accounts: z.array(z.object({ platform: Platform, accountId: Id }).strict()),
 versions: z.array(AssetIdentitySchema), registryComplete: z.boolean(),
 bindings: z.array(PublicationBindingSchema),
 verifiedPublications: z.array(z.object({ binding: PublicationBindingSchema, verificationRef: Id }).strict()),
 verifiedEvidence: z.array(z.object({ evidence: PerformanceEvidenceSchema, confirmations: ConfirmationsSchema }).strict()),
}).strict();
export type TrustedPerformanceContext = z.infer<typeof TrustedPerformanceContextSchema>;
export type PerformanceEligibility = {
 eligibleForRequestedReview: boolean; blockers: string[];
 automaticWinner: false; performanceLearningEnabled: false; winnerBlockers: readonly string[];
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const duplicate = (ids: string[]) => new Set(ids).size !== ids.length;
const overlap = (a: PublicationBinding, b: PublicationBinding) => Date.parse(a.validFrom) < Date.parse(b.validTo) && Date.parse(b.validFrom) < Date.parse(a.validTo);

/** Eligibility for a scoped measurement review, NOT proof, a winner, or an ROI calculation. */
export function evaluatePerformanceEvidence(bindingInput: unknown, evidenceInput: unknown, trustedContext: unknown): PerformanceEligibility {
 const blockers: string[] = [];
 const result = (): PerformanceEligibility => ({ eligibleForRequestedReview: blockers.length === 0, blockers: [...new Set(blockers)], automaticWinner: false, performanceLearningEnabled: false,
  winnerBlockers: ['objective_comparator_and_analysis_policy_required', 'uncertainty_and_guardrail_review_required', 'human_decision_required', 'no_learning_integration'] });
 const bp = PublicationBindingSchema.safeParse(bindingInput);
 const ep = PerformanceEvidenceSchema.safeParse(evidenceInput);
 const cp = TrustedPerformanceContextSchema.safeParse(trustedContext);
 if (!bp.success) blockers.push('invalid_binding');
 if (!ep.success) blockers.push('invalid_evidence');
 if (!cp.success) blockers.push('trusted_context_missing_or_invalid');
 if (!bp.success || !ep.success || !cp.success) return result();
 const b = bp.data, e = ep.data, c = cp.data;
 if (b.tenantId !== c.tenantId || e.tenantId !== c.tenantId || b.ownerId !== c.ownerId) blockers.push('tenant_or_owner_mismatch');
 if (!c.accounts.some(a => a.platform === b.platform && a.accountId === b.accountId)) blockers.push('account_not_authorized');
 if (!c.versions.some(v => same(v, AssetIdentitySchema.parse({projectId:b.projectId,versionId:b.versionId,assetId:b.assetId,placementId:b.placementId,assetSha256:b.assetSha256,recipeSha256:b.recipeSha256})))) blockers.push('immutable_version_asset_not_verified');
 if (e.bindingId !== b.id || e.platform !== b.platform || e.accountId !== b.accountId || e.adId !== b.adId || e.creativeId !== b.creativeId) blockers.push('evidence_binding_mismatch');
 if (e.lane !== 'first_party_observed') blockers.push('not_first_party_observed');
 if (!c.registryComplete) blockers.push('binding_registry_incomplete');
 if (duplicate(c.bindings.map(v => v.id))) blockers.push('duplicate_binding_id');
 if (duplicate(c.verifiedEvidence.map(v => v.evidence.id)) || duplicate(c.verifiedPublications.map(v => v.binding.id))) blockers.push('duplicate_verification_id');
 if (!c.bindings.some(v => same(v, b))) blockers.push('binding_not_registered');
 if (c.bindings.some(v => v.id !== b.id && v.platform === b.platform && v.accountId === b.accountId && v.adId === b.adId && overlap(v, b))) blockers.push('ambiguous_ad_binding');
 if (!c.verifiedPublications.some(v => same(v.binding, b))) blockers.push('publication_not_verified');
 if (Date.parse(e.window.start) < Date.parse(b.validFrom) || Date.parse(e.window.end) > Date.parse(b.validTo)) blockers.push('outside_publication_window');
 if (duplicate(e.source.rowIds) || duplicate(e.outcomes.map(v => v.id)) || duplicate(e.monetaryGrains.map(v => v.role))) blockers.push('duplicate_fact_identifier');
 const verified = c.verifiedEvidence.find(v => same(v.evidence, e));
 if (!verified) blockers.push('evidence_not_verified');
 const requireConfirmation = (key: keyof z.infer<typeof ConfirmationsSchema>) => { if (!verified?.confirmations[key]) blockers.push(`${key}_not_verified`); };
 for (const key of ['delivery', 'settings', 'coverage'] as const) requireConfirmation(key);
 for (const grain of e.monetaryGrains) {
  if (grain.currency !== e.window.currency || grain.timezone !== e.window.timezone || grain.dateBasis !== e.window.dateBasis || grain.cohortId !== e.window.cohortId || grain.attributionSettingsId !== e.window.attributionSettingsId || Date.parse(grain.start) !== Date.parse(e.window.start) || Date.parse(grain.end) !== Date.parse(e.window.end)) blockers.push('incompatible_monetary_grain');
 }
 if (e.kind !== 'delivery') {
  if (!e.outcomes.length) blockers.push('qualified_outcomes_missing');
  for (const key of ['outcomes', 'attribution', 'cohort'] as const) requireConfirmation(key);
  if (e.window.dateBasis !== 'exposure_cohort') blockers.push('aligned_exposure_cohort_required');
 }
 if (['attributed_revenue', 'profit_roi', 'incremental_roi'].includes(e.kind)) {
  for (const key of ['revenue', 'refunds'] as const) requireConfirmation(key);
  for (const role of ['media', 'net_realized_revenue']) if (!e.monetaryGrains.some(v => v.role === role)) blockers.push(`missing_${role}_grain`);
 }
 if (['profit_roi', 'incremental_roi'].includes(e.kind)) {
  requireConfirmation('costs');
  for (const role of ['actual_cogs', 'nonmedia_cost']) if (!e.monetaryGrains.some(v => v.role === role)) blockers.push(`missing_${role}_grain`);
 }
 if (e.kind === 'incremental_roi') requireConfirmation('causal_design');
 return result();
}
