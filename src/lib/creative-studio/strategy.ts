import { z } from 'zod';

export const STRATEGY_LIMITS = {
  sourceExcerpts: 24,
  assets: 24,
  warnings: 10,
  channels: 5,
  claims: 8,
  claimSources: 8,
  concepts: 6,
  conversationTurns: 20,
} as const;

export const COPY_MAXIMA = {
  primaryText: 125,
  headline: 40,
  description: 25,
  cta: 30,
  rationale: 600,
  visualDirection: 1000,
} as const;

const IdSchema = z.string().trim().min(1).max(64);
const HttpUrlSchema = z.string().trim().max(2048).url().refine(value => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'Only HTTP(S) URLs are supported');

export const SourceExcerptSchema = z.object({
  id: IdSchema,
  sourceUrl: HttpUrlSchema,
  kind: z.enum(['title', 'description', 'heading', 'body', 'offer', 'cta', 'other']),
  text: z.string().trim().min(1).max(1000),
}).strict();
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>;

export const AssetCandidateSchema = z.object({
  id: IdSchema,
  sourceUrl: HttpUrlSchema,
  kind: z.enum(['logo', 'hero', 'product', 'person', 'proof', 'other']),
  alt: z.string().trim().max(300).default(''),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  sourceExcerptIds: z.array(IdSchema).max(STRATEGY_LIMITS.claimSources).default([]),
}).strict();
export type AssetCandidate = z.infer<typeof AssetCandidateSchema>;

export const LandingPageReceiptSchema = z.object({
  requestedUrl: HttpUrlSchema,
  finalUrl: HttpUrlSchema,
  canonicalUrl: HttpUrlSchema.optional(),
  scannedAt: z.string().datetime(),
  title: z.string().trim().max(200).default(''),
  description: z.string().trim().max(500).default(''),
  brandName: z.string().trim().max(120).optional(),
  excerpts: z.array(SourceExcerptSchema).max(STRATEGY_LIMITS.sourceExcerpts),
  assets: z.array(AssetCandidateSchema).max(STRATEGY_LIMITS.assets),
  warnings: z.array(z.string().trim().min(1).max(300)).max(STRATEGY_LIMITS.warnings),
}).strict().superRefine((receipt, ctx) => {
  const ids = receipt.excerpts.map(item => item.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({code:'custom',message:'Source excerpt IDs must be unique',path:['excerpts']});
  const known = new Set(ids);
  for (const [index, asset] of receipt.assets.entries()) {
    for (const id of asset.sourceExcerptIds) if (!known.has(id)) ctx.addIssue({code:'custom',message:'Asset references an unknown source excerpt',path:['assets',index,'sourceExcerptIds']});
  }
});
export type LandingPageReceipt = z.infer<typeof LandingPageReceiptSchema>;

export const ClaimSchema = z.object({
  id: IdSchema,
  text: z.string().trim().min(1).max(500),
  status: z.enum(['source-backed', 'needs-confirmation', 'user-confirmed']),
  sourceExcerptIds: z.array(IdSchema).max(STRATEGY_LIMITS.claimSources),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine((claim, ctx) => {
  if (claim.status === 'needs-confirmation') {
    if (claim.sourceExcerptIds.length) ctx.addIssue({code:'custom',message:'Unconfirmed claims cannot assert source backing',path:['sourceExcerptIds']});
    if (claim.confirmedAt) ctx.addIssue({code:'custom',message:'A claim needing confirmation cannot be confirmed',path:['confirmedAt']});
    return;
  }
  if (!claim.sourceExcerptIds.length) ctx.addIssue({code:'custom',message:'Factual claims require source excerpt provenance',path:['sourceExcerptIds']});
  if (claim.status === 'user-confirmed' && !claim.confirmedAt) ctx.addIssue({code:'custom',message:'User-confirmed claims require a confirmation timestamp',path:['confirmedAt']});
  if (claim.status === 'source-backed' && claim.confirmedAt) ctx.addIssue({code:'custom',message:'Source-backed claims are not user confirmation',path:['confirmedAt']});
});
export type StrategyClaim = z.infer<typeof ClaimSchema>;

export const AssumptionValueSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  observedSourceExcerptIds: z.array(IdSchema).max(STRATEGY_LIMITS.claimSources),
  confirmed: z.boolean(),
}).strict();
export type AssumptionValue = z.infer<typeof AssumptionValueSchema>;

export const CreativeAssumptionsSchema = z.object({
  advertisedSubject: AssumptionValueSchema,
  offer: AssumptionValueSchema,
  audience: AssumptionValueSchema,
  awareness: AssumptionValueSchema,
  funnelStage: AssumptionValueSchema,
  objective: AssumptionValueSchema,
  message: AssumptionValueSchema,
  cta: AssumptionValueSchema,
  claims: z.array(ClaimSchema).max(STRATEGY_LIMITS.claims),
}).strict();
export type CreativeAssumptions = z.infer<typeof CreativeAssumptionsSchema>;

export const ChannelRecommendationSchema = z.object({
  channel: z.enum(['meta', 'google-display', 'google-performance-max', 'linkedin']),
  recommended: z.boolean(),
  rationale: z.string().trim().min(1).max(600),
  placements: z.array(z.string().trim().min(1).max(80)).max(8),
}).strict();
export type ChannelRecommendation = z.infer<typeof ChannelRecommendationSchema>;

export const PERSUASION_JOBS = ['problem-recognition', 'category-explanation', 'demonstration', 'human-trust', 'proof', 'objection-handling', 'comparison', 'offer-clarity', 'economic-case', 'low-friction-process', 'social-conversation', 'pattern-interruption'] as const;
export const VISUAL_FAMILIES = ['receipt', 'text-thread', 'founder-reel', 'founder-note', 'tracker', 'editorial', 'job-post', 'comment-thread', 'math', 'comparison', 'communication-proof', 'problem-solution', 'proof-card'] as const;
export const CONCEPT_CATALOG_IDS = ['zero-due-today-receipt', 'agency-owner-text-thread', 'this-sounds-fake-founder-reel', 'founder-note', 'paid-media-launch-tracker', 'breaking-news-editorial', 'job-posting-cancelled', 'agency-owner-comment-section', 'one-client-math', 'think-vs-reality', 'white-label-communication-gap'] as const;

export const ConceptCatalogEntrySchema = z.object({
  id: z.enum(CONCEPT_CATALOG_IDS),
  name: z.string().trim().min(1).max(120),
  persuasionJob: z.enum(PERSUASION_JOBS),
  visualFamily: z.enum(VISUAL_FAMILIES),
  typicalStages: z.array(z.enum(['top', 'middle', 'bottom'])).min(1).max(3),
  evidenceRequirement: z.string().trim().min(1).max(500),
  mediaType: z.enum(['static', 'video']),
  staticSelectable: z.boolean(),
}).strict().superRefine((entry, ctx) => {
  if (entry.mediaType === 'video' && entry.staticSelectable) ctx.addIssue({code:'custom',message:'Video treatments cannot be selected as static outputs',path:['staticSelectable']});
});
export type ConceptCatalogEntry = z.infer<typeof ConceptCatalogEntrySchema>;

export const CONCEPT_CATALOG = [
  {id:'zero-due-today-receipt',name:'$0 Due Today Receipt',persuasionJob:'offer-clarity',visualFamily:'receipt',typicalStages:['bottom'],evidenceRequirement:'Confirmed price, scope, terms, and CTA.',mediaType:'static',staticSelectable:true},
  {id:'agency-owner-text-thread',name:'Agency Owner Text Thread',persuasionJob:'social-conversation',visualFamily:'text-thread',typicalStages:['middle','bottom'],evidenceRequirement:'An approved real exchange or a prominent illustrative label; never impersonate a person.',mediaType:'static',staticSelectable:true},
  {id:'this-sounds-fake-founder-reel',name:'“This Sounds Fake” Founder Reel',persuasionJob:'objection-handling',visualFamily:'founder-reel',typicalStages:['middle','bottom'],evidenceRequirement:'A consenting real founder and substantiated claims.',mediaType:'video',staticSelectable:false},
  {id:'founder-note',name:'Founder Note',persuasionJob:'human-trust',visualFamily:'founder-note',typicalStages:['middle'],evidenceRequirement:'An approved point of view from a consenting real person or a clearly labeled draft.',mediaType:'static',staticSelectable:true},
  {id:'paid-media-launch-tracker',name:'Paid Media Launch Tracker',persuasionJob:'low-friction-process',visualFamily:'tracker',typicalStages:['middle','bottom'],evidenceRequirement:'Confirmed milestones, responsibilities, timing, and constraints.',mediaType:'static',staticSelectable:true},
  {id:'breaking-news-editorial',name:'Breaking-News Editorial',persuasionJob:'problem-recognition',visualFamily:'editorial',typicalStages:['top'],evidenceRequirement:'Page or user-confirmed problem language and treatment that does not imply earned coverage.',mediaType:'static',staticSelectable:true},
  {id:'job-posting-cancelled',name:'The Job Posting That Gets Cancelled',persuasionJob:'pattern-interruption',visualFamily:'job-post',typicalStages:['top','middle'],evidenceRequirement:'Truthful replacement framing with no invented company, role, or applicant.',mediaType:'static',staticSelectable:true},
  {id:'agency-owner-comment-section',name:'Agency-Owner Comment Section',persuasionJob:'objection-handling',visualFamily:'comment-thread',typicalStages:['middle','bottom'],evidenceRequirement:'Real approved questions or a prominent illustrative label; no fabricated commenters.',mediaType:'static',staticSelectable:true},
  {id:'one-client-math',name:'One-Client Math',persuasionJob:'economic-case',visualFamily:'math',typicalStages:['bottom'],evidenceRequirement:'Verified inputs or a prominent illustrative-calculation label.',mediaType:'static',staticSelectable:true},
  {id:'think-vs-reality',name:'What Agencies Think vs. Reality',persuasionJob:'comparison',visualFamily:'comparison',typicalStages:['middle','bottom'],evidenceRequirement:'Comparable definitions and substantiated claims.',mediaType:'static',staticSelectable:true},
  {id:'white-label-communication-gap',name:'The White-Label Communication Gap',persuasionJob:'proof',visualFamily:'communication-proof',typicalStages:['middle','bottom'],evidenceRequirement:'Approved first-party communication or dashboard proof with permission.',mediaType:'static',staticSelectable:true},
] as const satisfies readonly ConceptCatalogEntry[];

export const GeneratedConceptSchema = z.object({
  id: IdSchema,
  catalogEntryId: z.enum(CONCEPT_CATALOG_IDS),
  title: z.string().trim().min(1).max(120),
  persuasionJob: z.enum(PERSUASION_JOBS),
  visualFamily: z.enum(VISUAL_FAMILIES),
  mediaType: z.enum(['static', 'video']),
  staticOutput: z.boolean(),
  hypothesis: z.string().trim().min(1).max(500),
  primaryText: z.string().trim().min(1).max(COPY_MAXIMA.primaryText),
  headline: z.string().trim().min(1).max(COPY_MAXIMA.headline),
  description: z.string().trim().min(1).max(COPY_MAXIMA.description),
  cta: z.string().trim().min(1).max(COPY_MAXIMA.cta),
  rationale: z.string().trim().min(1).max(COPY_MAXIMA.rationale),
  visualDirection: z.string().trim().min(1).max(COPY_MAXIMA.visualDirection),
  claims: z.array(ClaimSchema).max(STRATEGY_LIMITS.claims),
  winnerClaim: z.literal(false),
  fabricatedProof: z.literal(false),
}).strict().superRefine((concept, ctx) => {
  if (concept.mediaType === 'video' && concept.staticOutput) ctx.addIssue({code:'custom',message:'Video concepts cannot masquerade as static outputs',path:['staticOutput']});
  const catalog = CONCEPT_CATALOG.find(entry => entry.id === concept.catalogEntryId);
  if (catalog && (catalog.visualFamily !== concept.visualFamily || catalog.mediaType !== concept.mediaType)) ctx.addIssue({code:'custom',message:'Concept treatment must match its catalog entry',path:['catalogEntryId']});
  if (catalog && concept.staticOutput && !catalog.staticSelectable) ctx.addIssue({code:'custom',message:'Catalog treatment is not selectable for static output',path:['staticOutput']});
});
export type GeneratedConcept = z.infer<typeof GeneratedConceptSchema>;

export const StrategyConversationTurnSchema = z.object({
  id: IdSchema,
  role: z.enum(['user', 'assistant']),
  createdAt: z.string().datetime(),
  message: z.string().trim().min(1).max(2000),
  target: z.enum(['assumptions', 'portfolio', 'concept']).optional(),
  conceptId: IdSchema.optional(),
}).strict().superRefine((turn, ctx) => {
  if (turn.target === 'concept' && !turn.conceptId) ctx.addIssue({code:'custom',message:'Concept-targeted turns require a concept ID',path:['conceptId']});
  if (turn.target !== 'concept' && turn.conceptId) ctx.addIssue({code:'custom',message:'Concept ID requires a concept target',path:['conceptId']});
});
export type StrategyConversationTurn = z.infer<typeof StrategyConversationTurnSchema>;

export const CreativeStrategySchema = z.object({
  version: z.literal(1),
  receipt: LandingPageReceiptSchema,
  assumptions: CreativeAssumptionsSchema,
  assumptionsConfirmedAt: z.string().datetime().nullable(),
  channels: z.array(ChannelRecommendationSchema).max(STRATEGY_LIMITS.channels),
  concepts: z.array(GeneratedConceptSchema).length(STRATEGY_LIMITS.concepts),
  conversation: z.array(StrategyConversationTurnSchema).max(STRATEGY_LIMITS.conversationTurns),
  selectedConceptId: IdSchema.optional(),
}).strict().superRefine((strategy, ctx) => {
  const jobs = strategy.concepts.map(concept => concept.persuasionJob);
  if (new Set(jobs).size !== jobs.length) ctx.addIssue({code:'custom',message:'Initial concepts require unique persuasion jobs',path:['concepts']});
  const families = strategy.concepts.map(concept => concept.visualFamily);
  if (new Set(families).size !== families.length) ctx.addIssue({code:'custom',message:'Initial concepts require unique visual families',path:['concepts']});
  const conceptIds = strategy.concepts.map(concept => concept.id);
  if (new Set(conceptIds).size !== conceptIds.length) ctx.addIssue({code:'custom',message:'Concept IDs must be unique',path:['concepts']});
  if (strategy.selectedConceptId && !conceptIds.includes(strategy.selectedConceptId)) ctx.addIssue({code:'custom',message:'Selected concept is missing',path:['selectedConceptId']});
  if (strategy.assumptionsConfirmedAt && Object.entries(strategy.assumptions).some(([key, value]) => key !== 'claims' && !Array.isArray(value) && !value.confirmed)) ctx.addIssue({code:'custom',message:'All assumptions must be confirmed before confirmation is recorded',path:['assumptionsConfirmedAt']});
  const sourceIds = new Set(strategy.receipt.excerpts.map(item => item.id));
  const checkIds = (ids: readonly string[], path: (string | number)[]) => {
    for (const id of ids) if (!sourceIds.has(id)) ctx.addIssue({code:'custom',message:'Unknown source excerpt reference',path});
  };
  for (const [key, value] of Object.entries(strategy.assumptions)) {
    if (key === 'claims' || Array.isArray(value)) continue;
    checkIds(value.observedSourceExcerptIds, ['assumptions', key, 'observedSourceExcerptIds']);
  }
  strategy.assumptions.claims.forEach((claim, index) => checkIds(claim.sourceExcerptIds, ['assumptions','claims',index,'sourceExcerptIds']));
  strategy.concepts.forEach((concept, conceptIndex) => concept.claims.forEach((claim, claimIndex) => checkIds(claim.sourceExcerptIds, ['concepts',conceptIndex,'claims',claimIndex,'sourceExcerptIds'])));
  strategy.conversation.forEach((turn, index) => {
    if (turn.conceptId && !conceptIds.includes(turn.conceptId)) ctx.addIssue({code:'custom',message:'Conversation references an unknown concept',path:['conversation',index,'conceptId']});
  });
});
export type CreativeStrategy = z.infer<typeof CreativeStrategySchema>;
