import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('URL-first Builder consumes the strict public project DTO and opaque command contract', async () => {
  const ui = await source('../components/creative-studio/UrlCreativeBuilder.tsx');
  assert.match(ui, /PublicCreativeProjectSchema\.safeParse/);
  assert.match(ui, /operation: 'create-and-analyze', url: submittedUrl/);
  assert.match(ui, /operation: 'edit-plan'[\s\S]*expectedProjectRevision[\s\S]*expectedPlanRevisionId/);
  assert.match(ui, /operation: 'confirm-plan'[\s\S]*expectedProjectRevision[\s\S]*confirmedClaimIds/);
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
  assert.match(ui, /Confirm the claims you kept/);
  assert.match(ui, /Remove from plan/);
  assert.match(ui, /confirmedClaimIds: needsClaimConfirmation\.map\(claim => claim\.id\)/);
  assert.match(ui, /Confirming records this exact plan and unlocks generation of six creative concepts/);
  assert.doesNotMatch(ui, /disabled=\{!!busy \|\| planDirty \|\| !allClaimsConfirmed\}[^>]*><span>I reviewed/);
  assert.match(ui, /project\.phase === 'generated' && <section className="cs-panel cb-revise"/);
  assert.match(ui, /Generate six concepts/);
  assert.match(ui, /project\.concepts\.length/);
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
