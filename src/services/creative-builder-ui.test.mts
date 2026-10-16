import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('URL-first Builder consumes the strict public project DTO and opaque command contract', async () => {
  const ui = await source('../components/creative-studio/UrlCreativeBuilder.tsx');
  assert.match(ui, /PublicCreativeProjectSchema\.safeParse/);
  assert.match(ui, /operation: 'create-and-analyze', url: submittedUrl/);
  assert.match(ui, /operation: 'edit-plan'[\s\S]*expectedProjectRevision[\s\S]*expectedPlanRevisionId/);
  assert.match(ui, /operation: 'confirm-plan'[\s\S]*expectedProjectRevision[\s\S]*acknowledged: true/);
  assert.match(ui, /operation: 'generate-concepts'[\s\S]*expectedProjectRevision[\s\S]*expectedPlanRevisionId/);
  assert.match(ui, /operation: 'select-concept'[\s\S]*expectedProjectRevision[\s\S]*orderedAssetIds/);
  assert.match(ui, /operation: 'revise'[\s\S]*expectedProjectRevision[\s\S]*message:/);
  assert.match(ui, /operation: 'handoff'[\s\S]*expectedProjectRevision[\s\S]*selectionId:/);
  assert.doesNotMatch(ui, /landingUrl: submittedUrl/);
  assert.doesNotMatch(ui, /sourceUrl|objectKey|pageExcerpt\.text/);
});

test('Builder presents the required safe workflow and leaves legacy Studio available', async () => {
  const ui = await source('../components/creative-studio/UrlCreativeBuilder.tsx');
  assert.match(ui, /Landing-page URL/);
  assert.match(ui, /Analyzing the landing page and building a source-backed plan/);
  assert.match(ui, /Approve the saved plan/);
  assert.match(ui, /Remove from plan/);
  assert.match(ui, /Claim requiring approval:/);
  assert.match(ui, /Approval records this exact plan and unlocks generation of six creative concepts/);
  assert.doesNotMatch(ui, /setConfirmedClaims|allClaimsConfirmed/);
  const loadBlock = ui.slice(ui.indexOf('const load = useCallback'), ui.indexOf('useEffect(() => { void load();'));
  assert.match(loadBlock, /setPlanAcknowledged\(false\)/);
  assert.match(ui, /project\.phase === 'generated' && <section className="cs-panel cb-revise"/);
  assert.match(ui, /Generate six concepts/);
  assert.match(ui, /project\.concepts\.length/);
  assert.match(ui, /SIX CONCEPT BRIEFS/);
  assert.match(ui, /illustrative layout mockups, not final ads/);
  const preview = await source('../components/creative-studio/ConceptPreview.tsx');
  assert.match(preview, /Illustrative concept mockup/);
  for (const treatment of ['cb-mock-phone','cb-mock-note','cb-mock-editorial','cb-mock-tracker','cb-mock-math','cb-mock-compare']) assert.match(preview, new RegExp(treatment));
  for (const unsupported of ['Founder, EIC','Clarify the offer','Build the campaign','Better decisions','One measurable plan','<button']) assert.doesNotMatch(preview, new RegExp(unsupported));
  assert.match(ui, /<dd>\{concept\.primaryText\}<\/dd>/);
  assert.match(ui, /Founder Reel · planning only/);
  assert.match(ui, /kind: 'preview'[\s\S]*projectId: project\.projectId[\s\S]*scanId: project\.scanId[\s\S]*candidateId/);
  assert.match(ui, /Source image imported/);
  assert.match(ui, /Saved revision history/);
  assert.match(ui, /Apply to artwork/);
  assert.match(ui, /Publishing remains unavailable/);
  assert.match(ui, /href="\/dashboard\/eicagency\/creative-studio"/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /Refresh saved work/);
});

test('canonical Builder route is feature-gated and authorized while Studio route remains legacy', async () => {
  const builderPage = await source('../app/dashboard/eicagency/creative-builder/page.tsx');
  assert.match(builderPage, /CREATIVE_STUDIO_HOSTED_ENABLED !== 'true'/);
  assert.match(builderPage, /await authorizeStudioServer\(process\.env, createClient\)/);
  assert.match(builderPage, /await requireClientAccess\('eicagency'\)/);
  assert.match(builderPage, /return <UrlCreativeBuilder/);

  const studioPage = await source('../app/dashboard/eicagency/creative-studio/page.tsx');
  assert.match(studioPage, /return <CreativeStudio mode="hosted-private-beta"/);
});
