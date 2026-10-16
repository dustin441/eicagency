import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssetCandidateSchema,
  CONCEPT_CATALOG,
  COPY_MAXIMA,
  ClaimSchema,
  ConceptRevisionSchema,
  ConceptSelectionReceiptSchema,
  ConfirmPlanInputSchema,
  CreateProjectInputSchema,
  CreateStudioHandoffInputSchema,
  CreativeStrategySchema,
  EditPlanInputSchema,
  GenerateConceptsInputSchema,
  GeneratedConceptSchema,
  ImportCandidateInputSchema,
  InitialConceptPortfolioSchema,
  LandingPageReceiptSchema,
  PublicCreativeProjectSchema,
  ReviseConceptInputSchema,
  SelectConceptInputSchema,
  SourceExcerptSchema,
} from '../lib/creative-studio/strategy.ts';

const IDS = {
  project: '00000000-0000-4000-8000-000000000001',
  plan: '00000000-0000-4000-8000-000000000002',
  page: '00000000-0000-4000-8000-000000000003',
  scan: '00000000-0000-4000-8000-000000000004',
  planConfirmation: '00000000-0000-4000-8000-000000000005',
  claimConfirmation: '00000000-0000-4000-8000-000000000006',
  user: '00000000-0000-4000-8000-000000000007',
  portfolio: '00000000-0000-4000-8000-000000000008',
  conceptRevision: '00000000-0000-4000-8000-000000000009',
  asset: '00000000-0000-4000-8000-00000000000a',
  message: '00000000-0000-4000-8000-00000000000b',
  selectionA: '00000000-0000-4000-8000-00000000000c',
  selectionB: '00000000-0000-4000-8000-00000000000d',
} as const;

const page = {
  id: IDS.page,
  kind: 'landing' as const,
  requestedUrl: 'https://example.com/offer',
  finalUrl: 'https://example.com/offer',
  canonicalUrl: 'https://example.com/offer',
  title: 'Example offer',
  description: 'A bounded page description.',
};
const excerpt = {id: 'excerpt-1', pageId: IDS.page, kind: 'body' as const, text: 'A plainly stated service offer.'};
const candidate = {id: 'candidate-1', pageId: IDS.page, sourceUrl: 'https://example.com/image.jpg', kind: 'hero' as const, alt: '', sourceExcerptIds: ['excerpt-1']};
const receipt = {id: IDS.scan, scannedAt: '2026-10-16T12:00:00.000Z', pages: [page], excerpts: [excerpt], assets: [candidate], warnings: []};
const assumption = (recommendation: string) => ({recommendation, observedPageExcerptIds: ['excerpt-1'], confirmed: true});
const assumptions = {
  advertisedSubject: assumption('Example service'),
  offer: assumption('A clearly scoped offer'),
  audience: assumption('Operations leaders'),
  awareness: assumption('problem-aware'),
  funnelStage: assumption('middle'),
  objective: assumption('Build consideration'),
  message: assumption('Make the process understandable'),
  cta: assumption('Learn more'),
  claims: [{id: 'claim-1', kind: 'general' as const, text: 'The page offers the service.', status: 'page-observed' as const, pageExcerptIds: ['excerpt-1']}],
};
const jobs = ['problem-recognition', 'human-trust', 'low-friction-process', 'proof', 'social-conversation', 'offer-clarity'] as const;
const families = ['editorial', 'founder-note', 'tracker', 'communication-proof', 'text-thread', 'receipt'] as const;
const catalogIds = ['breaking-news-editorial', 'founder-note', 'paid-media-launch-tracker', 'white-label-communication-gap', 'agency-owner-text-thread', 'zero-due-today-receipt'] as const;
const concept = (index: number) => ({
  id: `concept-${index}`,
  catalogEntryId: catalogIds[index],
  title: `Concept ${index + 1}`,
  persuasionJob: jobs[index],
  visualFamily: families[index],
  mediaType: 'static' as const,
  staticOutput: true,
  hypothesis: 'A bounded test hypothesis.',
  primaryText: 'Clear primary text.',
  headline: 'Clear headline',
  description: 'Short description',
  cta: 'Learn More',
  rationale: 'Why this is materially different.',
  visualDirection: 'A realistic, customer-specific native treatment.',
  claims: [{id: `concept-claim-${index}`, kind: 'general' as const, text: 'The service is offered.', status: 'page-observed' as const, pageExcerptIds: ['excerpt-1']}],
  winnerClaim: false as const,
  fabricatedProof: false as const,
});
const confirmations = [
  {id: IDS.planConfirmation, scope: 'plan' as const, planRevisionId: IDS.plan, contentSha256: 'a'.repeat(64), claimIds: [], confirmedAt: '2026-10-16T12:05:00.000Z', confirmedBy: IDS.user},
  {id: IDS.claimConfirmation, scope: 'claim' as const, planRevisionId: IDS.plan, contentSha256: 'b'.repeat(64), claimIds: ['price-claim'], confirmedAt: '2026-10-16T12:06:00.000Z', confirmedBy: IDS.user},
];
const base = {version: 1 as const, projectId: IDS.project, planRevisionId: IDS.plan, receipt, assumptions, channels: [{channel: 'meta' as const, recommended: true, rationale: 'Static placements fit the test.', placements: ['feed-1:1']}], confirmationReceipts: confirmations, conversation: []};
const portfolio = {id: IDS.portfolio, planRevisionId: IDS.plan, confirmationReceiptId: IDS.planConfirmation, concepts: Array.from({length: 6}, (_, index) => concept(index))};
const generatedStrategy = {...base, phase: 'generated' as const, confirmationReceiptId: IDS.planConfirmation, portfolio, conceptRevisions: []};
const conceptRevision = {id: IDS.conceptRevision, parentRevisionId: null, concept: concept(0), createdAt: '2026-10-16T12:10:00.000Z'};
const selectionA = {id: IDS.selectionA, source: 'portfolio' as const, conceptSetId: IDS.portfolio, conceptId: 'concept-0', assetIds: [IDS.asset], contentSha256: 'c'.repeat(64), createdAt: '2026-10-16T12:11:00.000Z', createdBy: IDS.user};
const selectionB = {...selectionA, id: IDS.selectionB, assetIds: [IDS.message], contentSha256: 'd'.repeat(64), createdAt: '2026-10-16T12:12:00.000Z'};

const doesNotThrowFailure = (parse: () => unknown) => {
  let result: unknown;
  assert.doesNotThrow(() => { result = parse(); });
  assert.equal((result as {success: boolean}).success, false);
};

test('catalog preserves the eleven ClickUp treatments and adds six complementary research families', () => {
  assert.equal(CONCEPT_CATALOG.length, 17);
  const ids = new Set(CONCEPT_CATALOG.map(entry => entry.id));
  for (const id of ['zero-due-today-receipt', 'agency-owner-text-thread', 'this-sounds-fake-founder-reel', 'founder-note', 'paid-media-launch-tracker', 'breaking-news-editorial', 'job-posting-cancelled', 'agency-owner-comment-section', 'one-client-math', 'think-vs-reality', 'white-label-communication-gap', 'outcome-demo', 'self-diagnostic', 'benchmark-gap', 'roi-calculator', 'proof-story', 'practical-playbook'] as const) assert.ok(ids.has(id), id);
  assert.equal(CONCEPT_CATALOG.find(entry => entry.id === 'this-sounds-fake-founder-reel')?.staticSelectable, false);
});

test('malformed or unsafe URL forms return safeParse failures instead of throwing', () => {
  doesNotThrowFailure(() => CreateProjectInputSchema.safeParse({landingUrl: 'http://['}));
  doesNotThrowFailure(() => LandingPageReceiptSchema.safeParse({...receipt, pages: [{...page, finalUrl: 'not a URL'}]}));
  doesNotThrowFailure(() => AssetCandidateSchema.safeParse({...candidate, sourceUrl: 'https://%'}));
  assert.equal(CreateProjectInputSchema.safeParse({landingUrl: 'https://user:password@example.com/offer'}).success, false);
  assert.equal(CreateProjectInputSchema.safeParse({landingUrl: 'https://example.com:8443/offer'}).success, false);
});

test('canonical pages own excerpt and asset provenance and all IDs are unique', () => {
  assert.equal(LandingPageReceiptSchema.safeParse(receipt).success, true);
  assert.equal(SourceExcerptSchema.safeParse({...excerpt, sourceUrl: page.finalUrl}).success, false, 'excerpts cannot carry arbitrary source URLs');
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt, excerpts: [{...excerpt, pageId: IDS.user}]}).success, false);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt, assets: [{...candidate, pageId: IDS.user}]}).success, false);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt, excerpts: [excerpt, {...excerpt}]}).success, false);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt, assets: [candidate, {...candidate}]}).success, false);
  assert.equal(LandingPageReceiptSchema.safeParse({...receipt, assets: [{...candidate, sourceExcerptIds: ['missing']}]}).success, false);
});

test('draft, confirmed, and generated phases are explicit and generation requires a server receipt', () => {
  assert.equal(CreativeStrategySchema.safeParse({...base, phase: 'draft'}).success, true);
  assert.equal(CreativeStrategySchema.safeParse({...base, phase: 'confirmed', confirmationReceiptId: IDS.planConfirmation}).success, true);
  assert.equal(CreativeStrategySchema.safeParse(generatedStrategy).success, true);
  assert.equal(CreativeStrategySchema.safeParse({...base, phase: 'draft', portfolio}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...base, phase: 'confirmed', portfolio}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, confirmationReceiptId: IDS.claimConfirmation}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, confirmationReceipts: [{...confirmations[0], contentSha256: 'not-a-hash'}, confirmations[1]]}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, portfolio: {...portfolio, planRevisionId: IDS.user}}).success, false);
});

test('only the initial portfolio imposes six-way diversity', () => {
  assert.equal(InitialConceptPortfolioSchema.safeParse(portfolio).success, true);
  assert.equal(InitialConceptPortfolioSchema.safeParse({...portfolio, concepts: portfolio.concepts.slice(0, 5)}).success, false);
  assert.equal(InitialConceptPortfolioSchema.safeParse({...portfolio, concepts: [...portfolio.concepts.slice(0, 5), {...portfolio.concepts[5], visualFamily: portfolio.concepts[0].visualFamily}]}).success, false);
  assert.equal(ConceptRevisionSchema.safeParse(conceptRevision).success, true, 'one concept can be revised without reconstructing a diverse portfolio');
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, conceptRevisions: [conceptRevision, {...conceptRevision, id: IDS.asset}]}).success, true, 'later revisions may reuse a persuasion job and visual family');
});

test('selection receipts immutably bind concept and asset choices for idempotent handoff', () => {
  assert.equal(ConceptSelectionReceiptSchema.safeParse(selectionA).success, true);
  assert.equal(ConceptSelectionReceiptSchema.safeParse(selectionB).success, true);
  assert.notEqual(selectionA.id, selectionB.id);
  assert.notDeepEqual(selectionA.assetIds, selectionB.assetIds);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, selections: [selectionA, selectionB], currentSelectionId: IDS.selectionB}).success, true);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, selections: [selectionA, {...selectionA}], currentSelectionId: IDS.selectionA}).success, false, 'selection IDs are immutable and unique');
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, selections: [{...selectionA, conceptSetId: IDS.user}], currentSelectionId: IDS.selectionA}).success, false);
  const revisionSelection = {id: IDS.selectionA, source: 'revision' as const, conceptRevisionId: IDS.conceptRevision, conceptId: 'concept-0', assetIds: [IDS.asset], contentSha256: 'e'.repeat(64), createdAt: '2026-10-16T12:13:00.000Z', createdBy: IDS.user};
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, conceptRevisions: [conceptRevision], selections: [revisionSelection], currentSelectionId: IDS.selectionA}).success, true);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, selections: [selectionA], currentSelectionId: IDS.selectionB}).success, false);
});

test('page observation is distinct from confirmation and sensitive final claims require receipts', () => {
  assert.equal(ClaimSchema.safeParse({id: 'c', kind: 'general', text: 'Observed copy', status: 'source-backed', pageExcerptIds: ['excerpt-1']}).success, false);
  assert.equal(ClaimSchema.safeParse({id: 'c', kind: 'general', text: 'Observed copy', status: 'page-observed', pageExcerptIds: ['excerpt-1']}).success, true);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), claims: [{id: 'price-claim', kind: 'price', text: '$100', status: 'page-observed', pageExcerptIds: ['excerpt-1']}]}).success, false);
  const confirmedPrice = {id: 'price-claim', kind: 'price' as const, text: '$100', status: 'user-confirmed' as const, pageExcerptIds: [], confirmationReceiptId: IDS.claimConfirmation};
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), claims: [confirmedPrice]}).success, true, 'user confirmation does not require a fabricated excerpt');
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, portfolio: {...portfolio, concepts: [{...concept(0), claims: [confirmedPrice]}, ...portfolio.concepts.slice(1)]}}).success, true);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, confirmationReceipts: confirmations.slice(0, 1), portfolio: {...portfolio, concepts: [{...concept(0), claims: [confirmedPrice]}, ...portfolio.concepts.slice(1)]}}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, confirmationReceipts: [confirmations[0], {...confirmations[1], claimIds: ['another-claim']}], portfolio: {...portfolio, concepts: [{...concept(0), claims: [confirmedPrice]}, ...portfolio.concepts.slice(1)]}}).success, false);
  assert.equal(CreativeStrategySchema.safeParse({...generatedStrategy, confirmationReceipts: [confirmations[0], {...confirmations[1], planRevisionId: IDS.user}], portfolio: {...portfolio, concepts: [{...concept(0), claims: [confirmedPrice]}, ...portfolio.concepts.slice(1)]}}).success, false);
});

test('unsupported winner, fabricated proof, video-as-static, and oversized copy fail closed', () => {
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), winnerClaim: true}).success, false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), fabricatedProof: true}).success, false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), mediaType: 'video', staticOutput: true}).success, false);
  assert.equal(GeneratedConceptSchema.safeParse({...concept(0), persuasionJob: 'human-trust'}).success, false, 'catalog strategy must match the generated concept');
  const fields: Record<string, number> = {primaryText: COPY_MAXIMA.primaryText, headline: COPY_MAXIMA.headline, description: COPY_MAXIMA.description, cta: COPY_MAXIMA.cta, rationale: COPY_MAXIMA.rationale, visualDirection: COPY_MAXIMA.visualDirection};
  for (const [field, max] of Object.entries(fields)) assert.equal(GeneratedConceptSchema.safeParse({...concept(0), [field]: 'x'.repeat(max + 1)}).success, false, field);
});

test('browser write contracts accept only canonical IDs and one user-authored message', () => {
  const valid = [
    [CreateProjectInputSchema, {landingUrl: page.finalUrl}],
    [EditPlanInputSchema, {action: 'edit', projectId: IDS.project, expectedPlanRevisionId: IDS.plan, assumptions: {offer: {recommendation: 'Edited offer'}}}],
    [ConfirmPlanInputSchema, {action: 'confirm', projectId: IDS.project, expectedPlanRevisionId: IDS.plan}],
    [GenerateConceptsInputSchema, {projectId: IDS.project, expectedConfirmedPlanRevisionId: IDS.plan}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptRevisionId: IDS.conceptRevision, target: 'concept', conceptId: 'concept-0', message: 'Make the headline more direct.'}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptSetId: IDS.portfolio, target: 'portfolio', message: 'Make the six concepts more direct.'}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedPlanRevisionId: IDS.plan, target: 'plan', message: 'Change the target audience.'}],
    [ImportCandidateInputSchema, {projectId: IDS.project, scanId: IDS.scan, candidateId: 'candidate-1'}],
    [SelectConceptInputSchema, {projectId: IDS.project, source: 'portfolio', expectedConceptSetId: IDS.portfolio, conceptId: 'concept-0', assetIds: [IDS.asset]}],
    [SelectConceptInputSchema, {projectId: IDS.project, source: 'revision', expectedConceptRevisionId: IDS.conceptRevision, conceptId: 'concept-0', assetIds: [IDS.asset]}],
    [CreateStudioHandoffInputSchema, {projectId: IDS.project, expectedSelectionId: IDS.selectionA}],
  ] as const;
  for (const [schema, value] of valid) assert.equal(schema.safeParse(value).success, true);

  const forbidden = [
    [CreateProjectInputSchema, {landingUrl: page.finalUrl, scannedAt: receipt.scannedAt}],
    [EditPlanInputSchema, {action: 'edit', projectId: IDS.project, expectedPlanRevisionId: IDS.plan, assumptions: {offer: {recommendation: 'x', confirmedAt: receipt.scannedAt}}}],
    [ConfirmPlanInputSchema, {action: 'confirm', projectId: IDS.project, expectedPlanRevisionId: IDS.plan, confirmedBy: IDS.user}],
    [GenerateConceptsInputSchema, {projectId: IDS.project, expectedConfirmedPlanRevisionId: IDS.plan, concepts: portfolio.concepts}],
    [GenerateConceptsInputSchema, {projectId: IDS.project, expectedConfirmedPlanRevisionId: IDS.plan, model: 'forged', usage: {tokens: 1}}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptRevisionId: IDS.conceptRevision, target: 'concept', conceptId: 'concept-0', message: 'x', role: 'assistant'}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptRevisionId: IDS.conceptRevision, target: 'concept', conceptId: 'concept-0', message: 'x', messages: [{role: 'user', message: 'x'}]}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptRevisionId: IDS.conceptRevision, target: 'plan', message: 'x'}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedPlanRevisionId: IDS.plan, target: 'portfolio', message: 'x'}],
    [ReviseConceptInputSchema, {projectId: IDS.project, expectedConceptSetId: IDS.portfolio, target: 'concept', conceptId: 'concept-0', message: 'x'}],
    [ImportCandidateInputSchema, {projectId: IDS.project, scanId: IDS.scan, candidateId: 'candidate-1', sourceUrl: candidate.sourceUrl}],
    [SelectConceptInputSchema, {projectId: IDS.project, source: 'revision', expectedConceptRevisionId: IDS.conceptRevision, conceptId: 'concept-0', assetIds: [IDS.asset], url: candidate.sourceUrl}],
    [SelectConceptInputSchema, {projectId: IDS.project, source: 'revision', expectedConceptRevisionId: IDS.conceptRevision, conceptId: 'concept-0', assetIds: [IDS.asset], confirmationReceiptId: IDS.planConfirmation}],
    [SelectConceptInputSchema, {projectId: IDS.project, source: 'portfolio', expectedConceptRevisionId: IDS.conceptRevision, conceptId: 'concept-0', assetIds: [IDS.asset]}],
    [CreateStudioHandoffInputSchema, {projectId: IDS.project, expectedConceptRevisionId: IDS.conceptRevision}],
  ] as const;
  for (const [schema, value] of forbidden) assert.equal(schema.safeParse(value).success, false);
});

test('persisted IDs are UUIDs while bounded local handles remain usable', () => {
  assert.equal(CreateProjectInputSchema.safeParse({landingUrl: page.finalUrl}).success, true);
  assert.equal(GenerateConceptsInputSchema.safeParse({projectId: 'project-1', expectedConfirmedPlanRevisionId: IDS.plan}).success, false);
  assert.equal(ImportCandidateInputSchema.safeParse({projectId: IDS.project, scanId: IDS.scan, candidateId: 'candidate-1'}).success, true);
  assert.equal(ImportCandidateInputSchema.safeParse({projectId: IDS.project, scanId: IDS.scan, candidateId: 'x'.repeat(65)}).success, false);
});

test('public DTO rejects internal receipts, provider metadata, and candidate source URLs', () => {
  const publicProject = {version: 1 as const, projectId: IDS.project, projectRevision: 1, phase: 'draft' as const, landingUrl: page.finalUrl, scanId: IDS.scan, planRevisionId: IDS.plan, assumptions, channels: base.channels, candidates: [{id: candidate.id, pageId: candidate.pageId, kind: candidate.kind, alt: candidate.alt}], conversation: []};
  assert.equal(PublicCreativeProjectSchema.safeParse(publicProject).success, true);
  assert.equal(PublicCreativeProjectSchema.safeParse({...publicProject, receipt}).success, false);
  assert.equal(PublicCreativeProjectSchema.safeParse({...publicProject, usage: {tokens: 100}, model: 'secret'}).success, false);
  assert.equal(PublicCreativeProjectSchema.safeParse({...publicProject, candidates: [{...publicProject.candidates[0], sourceUrl: candidate.sourceUrl}]}).success, false);
  const publicSelection = {id: IDS.selectionA, source: 'portfolio' as const, conceptSetId: IDS.portfolio, conceptId: 'concept-0', assetIds: [IDS.asset], createdAt: selectionA.createdAt};
  const generatedPublicProject = {...publicProject, projectRevision: 2, phase: 'generated' as const, conceptSetId: IDS.portfolio, concepts: portfolio.concepts.map((item,index)=>({revisionId:`00000000-0000-4000-8000-${(20+index).toString(16).padStart(12,'0')}`,source:'portfolio' as const,concept:item})), currentSelection: publicSelection};
  assert.equal(PublicCreativeProjectSchema.safeParse(generatedPublicProject).success, true);
  assert.equal(PublicCreativeProjectSchema.safeParse({...generatedPublicProject, currentSelection: {...publicSelection, contentSha256: selectionA.contentSha256, createdBy: IDS.user}}).success, false);
});
