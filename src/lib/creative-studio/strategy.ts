import { z } from 'zod';

export const STRATEGY_LIMITS = {
  scannedPages: 2,
  sourceExcerpts: 24,
  assets: 24,
  warnings: 10,
  channels: 5,
  claims: 8,
  claimSources: 8,
  concepts: 6,
  selections: 30,
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

const PersistedIdSchema = z.string().uuid();
const LocalHandleSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Invalid local handle');
const HttpUrlSchema = z.string().trim().max(2048).superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') ctx.addIssue({code: 'custom', message: 'Only HTTP(S) URLs are supported'});
    if (url.username || url.password) ctx.addIssue({code: 'custom', message: 'URL credentials are not supported'});
    if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) ctx.addIssue({code: 'custom', message: 'Only standard HTTP(S) ports are supported'});
  } catch {
    ctx.addIssue({code: 'custom', message: 'Invalid URL'});
  }
});

export const ScannedPageSchema = z.object({
  id: PersistedIdSchema,
  kind: z.enum(['landing', 'homepage-fallback']),
  requestedUrl: HttpUrlSchema,
  finalUrl: HttpUrlSchema,
  canonicalUrl: HttpUrlSchema.optional(),
  title: z.string().trim().max(200).default(''),
  description: z.string().trim().max(500).default(''),
}).strict();
export type ScannedPage = z.infer<typeof ScannedPageSchema>;

export const SourceExcerptSchema = z.object({
  id: LocalHandleSchema,
  pageId: PersistedIdSchema,
  kind: z.enum(['title', 'description', 'heading', 'body', 'offer', 'cta', 'other']),
  text: z.string().trim().min(1).max(1000),
}).strict();
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>;

export const AssetCandidateSchema = z.object({
  id: LocalHandleSchema,
  pageId: PersistedIdSchema,
  sourceUrl: HttpUrlSchema,
  kind: z.enum(['logo', 'hero', 'product', 'person', 'proof', 'other']),
  alt: z.string().trim().max(300).default(''),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  sourceExcerptIds: z.array(LocalHandleSchema).max(STRATEGY_LIMITS.claimSources).default([]),
}).strict();
export type AssetCandidate = z.infer<typeof AssetCandidateSchema>;

export const LandingPageReceiptSchema = z.object({
  id: PersistedIdSchema,
  scannedAt: z.string().datetime(),
  brandName: z.string().trim().max(120).optional(),
  pages: z.array(ScannedPageSchema).min(1).max(STRATEGY_LIMITS.scannedPages),
  excerpts: z.array(SourceExcerptSchema).max(STRATEGY_LIMITS.sourceExcerpts),
  assets: z.array(AssetCandidateSchema).max(STRATEGY_LIMITS.assets),
  warnings: z.array(z.string().trim().min(1).max(300)).max(STRATEGY_LIMITS.warnings),
}).strict().superRefine((receipt, ctx) => {
  const pageIds = receipt.pages.map(page => page.id);
  if (new Set(pageIds).size !== pageIds.length) ctx.addIssue({code: 'custom', message: 'Scanned page IDs must be unique', path: ['pages']});
  if (receipt.pages.filter(page => page.kind === 'landing').length !== 1) ctx.addIssue({code: 'custom', message: 'A receipt requires exactly one landing page', path: ['pages']});
  const knownPages = new Set(pageIds);
  const excerptIds = receipt.excerpts.map(item => item.id);
  if (new Set(excerptIds).size !== excerptIds.length) ctx.addIssue({code: 'custom', message: 'Source excerpt IDs must be unique', path: ['excerpts']});
  const assetIds = receipt.assets.map(item => item.id);
  if (new Set(assetIds).size !== assetIds.length) ctx.addIssue({code: 'custom', message: 'Asset candidate IDs must be unique', path: ['assets']});
  const knownExcerpts = new Set(excerptIds);
  receipt.excerpts.forEach((excerpt, index) => {
    if (!knownPages.has(excerpt.pageId)) ctx.addIssue({code: 'custom', message: 'Excerpt references an unknown scanned page', path: ['excerpts', index, 'pageId']});
  });
  receipt.assets.forEach((asset, index) => {
    if (!knownPages.has(asset.pageId)) ctx.addIssue({code: 'custom', message: 'Asset references an unknown scanned page', path: ['assets', index, 'pageId']});
    for (const id of asset.sourceExcerptIds) {
      if (!knownExcerpts.has(id)) ctx.addIssue({code: 'custom', message: 'Asset references an unknown source excerpt', path: ['assets', index, 'sourceExcerptIds']});
    }
  });
});
export type LandingPageReceipt = z.infer<typeof LandingPageReceiptSchema>;

export const CLAIM_KINDS = ['general', 'price', 'percentage', 'guarantee', 'testimonial', 'comparison', 'result', 'operational'] as const;
export const SENSITIVE_CLAIM_KINDS = ['price', 'percentage', 'guarantee', 'testimonial', 'comparison', 'result', 'operational'] as const;
const SensitiveClaimKinds = new Set<string>(SENSITIVE_CLAIM_KINDS);

export const ServerConfirmationReceiptSchema = z.object({
  id: PersistedIdSchema,
  scope: z.enum(['plan', 'claim']),
  planRevisionId: PersistedIdSchema,
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  claimIds: z.array(LocalHandleSchema).max(STRATEGY_LIMITS.claims),
  confirmedAt: z.string().datetime(),
  confirmedBy: PersistedIdSchema,
}).strict().superRefine((receipt, ctx) => {
  if (receipt.scope === 'plan' && receipt.claimIds.length) ctx.addIssue({code: 'custom', message: 'Plan confirmation cannot name individual claims', path: ['claimIds']});
  if (receipt.scope === 'claim' && !receipt.claimIds.length) ctx.addIssue({code: 'custom', message: 'Claim confirmation must name at least one claim', path: ['claimIds']});
});
export type ServerConfirmationReceipt = z.infer<typeof ServerConfirmationReceiptSchema>;

export const ClaimSchema = z.object({
  id: LocalHandleSchema,
  kind: z.enum(CLAIM_KINDS),
  text: z.string().trim().min(1).max(500),
  status: z.enum(['page-observed', 'needs-confirmation', 'user-confirmed']),
  pageExcerptIds: z.array(LocalHandleSchema).max(STRATEGY_LIMITS.claimSources),
  confirmationReceiptId: PersistedIdSchema.optional(),
}).strict().superRefine((claim, ctx) => {
  if (claim.status === 'page-observed' && !claim.pageExcerptIds.length) ctx.addIssue({code: 'custom', message: 'Page-observed claims require page excerpt provenance', path: ['pageExcerptIds']});
  if (claim.status !== 'user-confirmed' && claim.confirmationReceiptId) ctx.addIssue({code: 'custom', message: 'Only user-confirmed claims may reference a confirmation receipt', path: ['confirmationReceiptId']});
  if (claim.status === 'user-confirmed' && !claim.confirmationReceiptId) ctx.addIssue({code: 'custom', message: 'User-confirmed claims require a server confirmation receipt', path: ['confirmationReceiptId']});
  if (claim.status === 'needs-confirmation' && claim.pageExcerptIds.length) ctx.addIssue({code: 'custom', message: 'Claims needing confirmation cannot assert page observation', path: ['pageExcerptIds']});
});
export type StrategyClaim = z.infer<typeof ClaimSchema>;

export const AssumptionValueSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  observedPageExcerptIds: z.array(LocalHandleSchema).max(STRATEGY_LIMITS.claimSources),
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

export const PERSUASION_JOBS = ['problem-recognition', 'category-explanation', 'demonstration', 'human-trust', 'proof', 'objection-handling', 'comparison', 'offer-clarity', 'economic-case', 'low-friction-process', 'social-conversation', 'pattern-interruption', 'self-diagnosis', 'benchmark-gap', 'practical-utility'] as const;
export const VISUAL_FAMILIES = ['receipt', 'text-thread', 'founder-reel', 'founder-note', 'tracker', 'editorial', 'job-post', 'comment-thread', 'math', 'comparison', 'communication-proof', 'problem-solution', 'proof-card', 'product-demo', 'scorecard', 'benchmark-chart', 'calculator', 'case-study', 'checklist'] as const;
export const CONCEPT_CATALOG_IDS = ['zero-due-today-receipt', 'agency-owner-text-thread', 'this-sounds-fake-founder-reel', 'founder-note', 'paid-media-launch-tracker', 'breaking-news-editorial', 'job-posting-cancelled', 'agency-owner-comment-section', 'one-client-math', 'think-vs-reality', 'white-label-communication-gap', 'outcome-demo', 'self-diagnostic', 'benchmark-gap', 'roi-calculator', 'proof-story', 'practical-playbook'] as const;
export const CONCEPT_OVERLAP_GROUPS = [
  ['one-client-math', 'roi-calculator'],
  ['white-label-communication-gap', 'proof-story'],
] as const;

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
  if (entry.mediaType === 'video' && entry.staticSelectable) ctx.addIssue({code: 'custom', message: 'Video treatments cannot be selected as static outputs', path: ['staticSelectable']});
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
  {id:'outcome-demo',name:'Outcome Demo',persuasionJob:'demonstration',visualFamily:'product-demo',typicalStages:['middle','bottom'],evidenceRequirement:'A real workflow, approved interface or process artifact, and reproducible output.',mediaType:'static',staticSelectable:true},
  {id:'self-diagnostic',name:'Scorecard / Quiz',persuasionJob:'self-diagnosis',visualFamily:'scorecard',typicalStages:['top','middle'],evidenceRequirement:'Defensible criteria, scoring logic, result bands, and a relevant next step.',mediaType:'static',staticSelectable:true},
  {id:'benchmark-gap',name:'Benchmark / Maturity Chart',persuasionJob:'benchmark-gap',visualFamily:'benchmark-chart',typicalStages:['top','middle'],evidenceRequirement:'A credible dated dataset, cohort definitions, methodology, and comparable measures.',mediaType:'static',staticSelectable:true},
  {id:'roi-calculator',name:'ROI Calculator',persuasionJob:'economic-case',visualFamily:'calculator',typicalStages:['middle','bottom'],evidenceRequirement:'Confirmed inputs, formulas, sensitivity ranges, and illustrative labeling where appropriate.',mediaType:'static',staticSelectable:true},
  {id:'proof-story',name:'Case Study / Proof Story',persuasionJob:'proof',visualFamily:'case-study',typicalStages:['middle','bottom'],evidenceRequirement:'Approved customer identity or anonymization, baseline, intervention, timeframe, result definition, and permission.',mediaType:'static',staticSelectable:true},
  {id:'practical-playbook',name:'Checklist / Playbook',persuasionJob:'practical-utility',visualFamily:'checklist',typicalStages:['top','middle'],evidenceRequirement:'Expert-authored steps, examples or templates, completion criteria, and a relevant next action.',mediaType:'static',staticSelectable:true},
] as const satisfies readonly ConceptCatalogEntry[];

export const GeneratedConceptSchema = z.object({
  id: LocalHandleSchema,
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
  if (concept.mediaType === 'video' && concept.staticOutput) ctx.addIssue({code: 'custom', message: 'Video concepts cannot masquerade as static outputs', path: ['staticOutput']});
  const catalog = CONCEPT_CATALOG.find(entry => entry.id === concept.catalogEntryId);
  if (catalog && (catalog.persuasionJob !== concept.persuasionJob || catalog.visualFamily !== concept.visualFamily || catalog.mediaType !== concept.mediaType)) ctx.addIssue({code: 'custom', message: 'Concept strategy and treatment must match its catalog entry', path: ['catalogEntryId']});
  if (catalog && concept.staticOutput && !catalog.staticSelectable) ctx.addIssue({code: 'custom', message: 'Catalog treatment is not selectable for static output', path: ['staticOutput']});
  concept.claims.forEach((claim, index) => {
    if (SensitiveClaimKinds.has(claim.kind) && (claim.status !== 'user-confirmed' || !claim.confirmationReceiptId)) {
      ctx.addIssue({code: 'custom', message: 'Sensitive final claims require server-recorded user confirmation', path: ['claims', index, 'confirmationReceiptId']});
    }
  });
});
export type GeneratedConcept = z.infer<typeof GeneratedConceptSchema>;

export const InitialConceptPortfolioSchema = z.object({
  id: PersistedIdSchema,
  planRevisionId: PersistedIdSchema,
  confirmationReceiptId: PersistedIdSchema,
  concepts: z.array(GeneratedConceptSchema).length(STRATEGY_LIMITS.concepts),
}).strict().superRefine((portfolio, ctx) => {
  const jobs = portfolio.concepts.map(concept => concept.persuasionJob);
  if (new Set(jobs).size !== jobs.length) ctx.addIssue({code: 'custom', message: 'Initial concepts require unique persuasion jobs', path: ['concepts']});
  const families = portfolio.concepts.map(concept => concept.visualFamily);
  if (new Set(families).size !== families.length) ctx.addIssue({code: 'custom', message: 'Initial concepts require unique visual families', path: ['concepts']});
  const ids = portfolio.concepts.map(concept => concept.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({code: 'custom', message: 'Concept IDs must be unique', path: ['concepts']});
  const catalogIds = new Set(portfolio.concepts.map(concept => concept.catalogEntryId));
  for (const group of CONCEPT_OVERLAP_GROUPS) {
    if (group.every(id => catalogIds.has(id))) ctx.addIssue({code: 'custom', message: `Initial concepts cannot combine overlapping catalog families: ${group.join(', ')}`, path: ['concepts']});
  }
});
export type InitialConceptPortfolio = z.infer<typeof InitialConceptPortfolioSchema>;

export const ConceptRevisionSchema = z.object({
  id: PersistedIdSchema,
  parentRevisionId: PersistedIdSchema.nullable(),
  concept: GeneratedConceptSchema,
  createdAt: z.string().datetime(),
}).strict();
export type ConceptRevision = z.infer<typeof ConceptRevisionSchema>;

const SelectionBaseShape = {
  id: PersistedIdSchema,
  conceptId: LocalHandleSchema,
  assetIds: z.array(PersistedIdSchema).max(STRATEGY_LIMITS.assets),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
  createdBy: PersistedIdSchema,
};
export const ConceptSelectionReceiptSchema = z.discriminatedUnion('source', [
  z.object({...SelectionBaseShape, source: z.literal('portfolio'), conceptSetId: PersistedIdSchema}).strict(),
  z.object({...SelectionBaseShape, source: z.literal('revision'), conceptRevisionId: PersistedIdSchema}).strict(),
]);
export type ConceptSelectionReceipt = z.infer<typeof ConceptSelectionReceiptSchema>;

export const StrategyConversationTurnSchema = z.object({
  id: PersistedIdSchema,
  role: z.enum(['user', 'assistant']),
  createdAt: z.string().datetime(),
  message: z.string().trim().min(1).max(2000),
  target: z.enum(['assumptions', 'portfolio', 'concept']).optional(),
  conceptId: LocalHandleSchema.optional(),
}).strict().superRefine((turn, ctx) => {
  if (turn.target === 'concept' && !turn.conceptId) ctx.addIssue({code: 'custom', message: 'Concept-targeted turns require a concept ID', path: ['conceptId']});
  if (turn.target !== 'concept' && turn.conceptId) ctx.addIssue({code: 'custom', message: 'Concept ID requires a concept target', path: ['conceptId']});
});
export type StrategyConversationTurn = z.infer<typeof StrategyConversationTurnSchema>;

const StrategyBaseShape = {
  version: z.literal(1),
  projectId: PersistedIdSchema,
  planRevisionId: PersistedIdSchema,
  receipt: LandingPageReceiptSchema,
  assumptions: CreativeAssumptionsSchema,
  channels: z.array(ChannelRecommendationSchema).max(STRATEGY_LIMITS.channels),
  confirmationReceipts: z.array(ServerConfirmationReceiptSchema).max(STRATEGY_LIMITS.claims + 1),
  conversation: z.array(StrategyConversationTurnSchema).max(STRATEGY_LIMITS.conversationTurns),
};

export const DraftCreativeStrategySchema = z.object({...StrategyBaseShape, phase: z.literal('draft')}).strict();
export const ConfirmedCreativeStrategySchema = z.object({...StrategyBaseShape, phase: z.literal('confirmed'), confirmationReceiptId: PersistedIdSchema}).strict();
export const GeneratedCreativeStrategySchema = z.object({
  ...StrategyBaseShape,
  phase: z.literal('generated'),
  confirmationReceiptId: PersistedIdSchema,
  portfolio: InitialConceptPortfolioSchema,
  conceptRevisions: z.array(ConceptRevisionSchema).max(STRATEGY_LIMITS.conversationTurns).default([]),
  selections: z.array(ConceptSelectionReceiptSchema).max(STRATEGY_LIMITS.selections).default([]),
  currentSelectionId: PersistedIdSchema.optional(),
}).strict();

function validateStrategy(strategy: z.infer<typeof DraftCreativeStrategySchema> | z.infer<typeof ConfirmedCreativeStrategySchema> | z.infer<typeof GeneratedCreativeStrategySchema>, ctx: z.RefinementCtx) {
  const excerptIds = new Set(strategy.receipt.excerpts.map(item => item.id));
  const confirmationReceipts = new Map(strategy.confirmationReceipts.map(item => [item.id, item]));
  if (confirmationReceipts.size !== strategy.confirmationReceipts.length) ctx.addIssue({code: 'custom', message: 'Confirmation receipt IDs must be unique', path: ['confirmationReceipts']});
  const checkExcerptIds = (ids: readonly string[], path: (string | number)[]) => {
    for (const id of ids) if (!excerptIds.has(id)) ctx.addIssue({code: 'custom', message: 'Unknown page excerpt reference', path});
  };
  const checkClaim = (claim: StrategyClaim, path: (string | number)[]) => {
    checkExcerptIds(claim.pageExcerptIds, [...path, 'pageExcerptIds']);
    if (!claim.confirmationReceiptId) return;
    const confirmation = confirmationReceipts.get(claim.confirmationReceiptId);
    if (!confirmation || confirmation.scope !== 'claim' || confirmation.planRevisionId !== strategy.planRevisionId || !confirmation.claimIds.includes(claim.id)) {
      ctx.addIssue({code: 'custom', message: 'Unknown or mismatched claim confirmation receipt', path: [...path, 'confirmationReceiptId']});
    }
  };
  for (const [key, value] of Object.entries(strategy.assumptions)) {
    if (key === 'claims' || Array.isArray(value)) continue;
    checkExcerptIds(value.observedPageExcerptIds, ['assumptions', key, 'observedPageExcerptIds']);
  }
  strategy.assumptions.claims.forEach((claim, index) => checkClaim(claim, ['assumptions', 'claims', index]));
  if (strategy.phase === 'draft') return;
  const planConfirmation = confirmationReceipts.get(strategy.confirmationReceiptId);
  if (!planConfirmation || planConfirmation.scope !== 'plan' || planConfirmation.planRevisionId !== strategy.planRevisionId) {
    ctx.addIssue({code: 'custom', message: 'Confirmed phases require a matching server plan confirmation receipt', path: ['confirmationReceiptId']});
  }
  if (Object.entries(strategy.assumptions).some(([key, value]) => key !== 'claims' && !Array.isArray(value) && !value.confirmed)) {
    ctx.addIssue({code: 'custom', message: 'All assumptions must be confirmed before leaving draft', path: ['assumptions']});
  }
  if (strategy.phase !== 'generated') return;
  if (strategy.portfolio.planRevisionId !== strategy.planRevisionId || strategy.portfolio.confirmationReceiptId !== strategy.confirmationReceiptId) {
    ctx.addIssue({code: 'custom', message: 'Portfolio must be generated from the confirmed plan revision', path: ['portfolio']});
  }
  const concepts = [...strategy.portfolio.concepts, ...strategy.conceptRevisions.map(revision => revision.concept)];
  concepts.forEach((concept, conceptIndex) => concept.claims.forEach((claim, claimIndex) => checkClaim(claim, ['concepts', conceptIndex, 'claims', claimIndex])));
  const canonicalConceptIds = new Set(concepts.map(concept => concept.id));
  strategy.conversation.forEach((turn, index) => {
    if (turn.conceptId && !canonicalConceptIds.has(turn.conceptId)) ctx.addIssue({code: 'custom', message: 'Conversation references an unknown concept', path: ['conversation', index, 'conceptId']});
  });
  const revisionById = new Map(strategy.conceptRevisions.map(revision => [revision.id, revision]));
  if (revisionById.size !== strategy.conceptRevisions.length) ctx.addIssue({code: 'custom', message: 'Concept revision IDs must be unique', path: ['conceptRevisions']});
  const selectionIds = strategy.selections.map(selection => selection.id);
  if (new Set(selectionIds).size !== selectionIds.length) ctx.addIssue({code: 'custom', message: 'Selection receipt IDs must be unique', path: ['selections']});
  strategy.selections.forEach((selection, index) => {
    if (selection.source === 'portfolio') {
      const selected = strategy.portfolio.concepts.find(concept => concept.id === selection.conceptId);
      if (selection.conceptSetId !== strategy.portfolio.id || !selected || !selected.staticOutput) ctx.addIssue({code: 'custom', message: 'Selection must reference a static portfolio concept', path: ['selections', index]});
      return;
    }
    const revision = revisionById.get(selection.conceptRevisionId);
    if (!revision || revision.concept.id !== selection.conceptId || !revision.concept.staticOutput) ctx.addIssue({code: 'custom', message: 'Selection must reference a static concept revision', path: ['selections', index]});
  });
  if (strategy.currentSelectionId && !selectionIds.includes(strategy.currentSelectionId)) ctx.addIssue({code: 'custom', message: 'Current selection must reference an immutable selection receipt', path: ['currentSelectionId']});
}

export const CreativeStrategySchema = z.discriminatedUnion('phase', [DraftCreativeStrategySchema, ConfirmedCreativeStrategySchema, GeneratedCreativeStrategySchema]).superRefine(validateStrategy);
export type CreativeStrategy = z.infer<typeof CreativeStrategySchema>;

const EditableClaimSchema = z.object({id: LocalHandleSchema, kind: z.enum(CLAIM_KINDS), text: z.string().trim().min(1).max(500)}).strict();
const EditableAssumptionValueSchema = z.object({recommendation: z.string().trim().min(1).max(500)}).strict();
export const EditableCreativeAssumptionsSchema = z.object({
  advertisedSubject: EditableAssumptionValueSchema,
  offer: EditableAssumptionValueSchema,
  audience: EditableAssumptionValueSchema,
  awareness: EditableAssumptionValueSchema,
  funnelStage: EditableAssumptionValueSchema,
  objective: EditableAssumptionValueSchema,
  message: EditableAssumptionValueSchema,
  cta: EditableAssumptionValueSchema,
  claims: z.array(EditableClaimSchema).max(STRATEGY_LIMITS.claims),
}).strict().partial();

export const CreateProjectInputSchema = z.object({landingUrl: HttpUrlSchema}).strict();
export const EditPlanInputSchema = z.object({
  action: z.literal('edit'),
  projectId: PersistedIdSchema,
  expectedPlanRevisionId: PersistedIdSchema,
  assumptions: EditableCreativeAssumptionsSchema.optional(),
  channels: z.array(z.object({channel: z.enum(['meta', 'google-display', 'google-performance-max', 'linkedin']), recommended: z.boolean(), placements: z.array(z.string().trim().min(1).max(80)).max(8)}).strict()).max(STRATEGY_LIMITS.channels).optional(),
}).strict().superRefine((input, ctx) => {
  if (!input.assumptions && !input.channels) ctx.addIssue({code: 'custom', message: 'Plan edit requires an editable change'});
});
export const ConfirmPlanInputSchema = z.object({action: z.literal('confirm'), projectId: PersistedIdSchema, expectedPlanRevisionId: PersistedIdSchema}).strict();
export const PlanWriteInputSchema = z.discriminatedUnion('action', [EditPlanInputSchema, ConfirmPlanInputSchema]);
export const GenerateConceptsInputSchema = z.object({projectId: PersistedIdSchema, expectedConfirmedPlanRevisionId: PersistedIdSchema}).strict();
const RevisionMessageSchema = z.string().trim().min(1).max(2000);
const RevisePlanInputSchema = z.object({
  projectId: PersistedIdSchema,
  target: z.literal('plan'),
  expectedPlanRevisionId: PersistedIdSchema,
  message: RevisionMessageSchema,
}).strict();
const RevisePortfolioInputSchema = z.object({
  projectId: PersistedIdSchema,
  target: z.literal('portfolio'),
  expectedConceptSetId: PersistedIdSchema,
  message: RevisionMessageSchema,
}).strict();
const ReviseSingleConceptInputSchema = z.object({
  projectId: PersistedIdSchema,
  target: z.literal('concept'),
  expectedConceptRevisionId: PersistedIdSchema,
  conceptId: LocalHandleSchema,
  message: RevisionMessageSchema,
}).strict();
export const ReviseConceptInputSchema = z.discriminatedUnion('target', [RevisePlanInputSchema, RevisePortfolioInputSchema, ReviseSingleConceptInputSchema]);
export const ImportCandidateInputSchema = z.object({projectId: PersistedIdSchema, scanId: PersistedIdSchema, candidateId: LocalHandleSchema}).strict();
const SelectionWriteBaseShape = {
  projectId: PersistedIdSchema,
  conceptId: LocalHandleSchema,
  assetIds: z.array(PersistedIdSchema).max(STRATEGY_LIMITS.assets),
};
export const SelectConceptInputSchema = z.discriminatedUnion('source', [
  z.object({...SelectionWriteBaseShape, source: z.literal('portfolio'), expectedConceptSetId: PersistedIdSchema}).strict(),
  z.object({...SelectionWriteBaseShape, source: z.literal('revision'), expectedConceptRevisionId: PersistedIdSchema}).strict(),
]);

export const CreateStudioHandoffInputSchema = z.object({projectId: PersistedIdSchema, expectedSelectionId: PersistedIdSchema}).strict();

export const CreativeStrategyCreateInputSchema = CreateProjectInputSchema;
export const CreativeStrategyPlanWriteInputSchema = PlanWriteInputSchema;
export const CreativeStrategyGenerateInputSchema = GenerateConceptsInputSchema;
export const CreativeStrategyRevisionInputSchema = ReviseConceptInputSchema;
export const CreativeStrategyImportInputSchema = ImportCandidateInputSchema;
export const CreativeStrategySelectionInputSchema = SelectConceptInputSchema;

const PublicCandidateSchema = AssetCandidateSchema.omit({sourceUrl: true, sourceExcerptIds: true});
const PublicSelectionBaseShape = {id: PersistedIdSchema, conceptId: LocalHandleSchema, assetIds: z.array(PersistedIdSchema).max(STRATEGY_LIMITS.assets), createdAt: z.string().datetime()};
const PublicConceptSelectionSchema = z.discriminatedUnion('source', [
  z.object({...PublicSelectionBaseShape, source: z.literal('portfolio'), conceptSetId: PersistedIdSchema}).strict(),
  z.object({...PublicSelectionBaseShape, source: z.literal('revision'), conceptRevisionId: PersistedIdSchema}).strict(),
]);
const PublicProjectBaseShape = {
  version: z.literal(1),
  projectId: PersistedIdSchema,
  phase: z.enum(['draft', 'confirmed', 'generated']),
  landingUrl: HttpUrlSchema,
  planRevisionId: PersistedIdSchema,
  assumptions: CreativeAssumptionsSchema,
  channels: z.array(ChannelRecommendationSchema).max(STRATEGY_LIMITS.channels),
  candidates: z.array(PublicCandidateSchema).max(STRATEGY_LIMITS.assets),
};
export const PublicCreativeProjectSchema = z.discriminatedUnion('phase', [
  z.object({...PublicProjectBaseShape, phase: z.literal('draft')}).strict(),
  z.object({...PublicProjectBaseShape, phase: z.literal('confirmed')}).strict(),
  z.object({...PublicProjectBaseShape, phase: z.literal('generated'), concepts: z.array(GeneratedConceptSchema).min(1).max(STRATEGY_LIMITS.concepts), currentSelection: PublicConceptSelectionSchema.optional()}).strict(),
]);
export type PublicCreativeProject = z.infer<typeof PublicCreativeProjectSchema>;
