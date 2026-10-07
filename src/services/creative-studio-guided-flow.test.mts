import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AWARENESS_OPTIONS,
  DEFAULT_IDEA,
  IdeaSchema,
  ideaBrief,
  recommend,
  stageForAwareness,
} from '../lib/creative-studio/ideas.ts';
import {
  DEFAULT_BRIEF,
  sceneForConcept,
} from '../lib/creative-studio/model.ts';
import {
  PACKS,
  PLACEMENTS,
  channelForPack,
  packForChannel,
} from '../lib/creative-studio/placements.ts';
import { loadRenderAssets, renderSceneHtml } from '../lib/creative-studio/render.ts';

test('legacy saved Idea records still parse without new advertising fields', () => {
  const legacy = {
    version: 1 as const,
    mode: 'guided' as const,
    step: 0,
    context: 'eic-pilot' as const,
    business: 'Legacy business context',
    audience: 'Marketing leaders at growing agencies',
    goal: 'trust' as const,
    awareness: 'aware' as const,
    stageOverride: null,
    format: 'notes' as const,
    headline: 'A legacy saved headline',
    closing: 'Explore the approach',
    accepted: [],
  };
  assert.deepEqual(IdeaSchema.parse(legacy), legacy);
});

test('advertising subject and type persist additively and inform the brief', () => {
  const idea = IdeaSchema.parse({
    ...DEFAULT_IDEA,
    advertisingType: 'offer',
    advertisingSubject: 'A free paid-media plan for agency owners',
    awareness: 'ready',
    audience: 'Agency owners ready to add paid media',
    headline: 'See your paid-media plan',
    closing: 'Request your plan',
    content: { kind: 'note', body: 'Review the plan before deciding whether to launch.' },
  });
  assert.equal(idea.advertisingType, 'offer');
  assert.equal(idea.advertisingSubject, 'A free paid-media plan for agency owners');
  const brief = ideaBrief(idea, DEFAULT_BRIEF);
  assert.equal(brief.stage, 'Action');
  assert.equal(brief.objective, 'Encourage action');
  assert.match(brief.hypothesis, /free paid-media plan/);
});

test('legacy goal-based recommendations remain stable while the new flow uses awareness', () => {
  const legacy = { ...DEFAULT_IDEA, advertisingSubject: undefined, goal: 'trust' as const, awareness: 'aware' as const };
  assert.equal(recommend(legacy).stage, 'Desire');
  assert.equal(recommend({ ...legacy, advertisingType: 'service', advertisingSubject: 'Paid media management' }).stage, 'Interest');
});

test('plain-language awareness choices map deterministically to funnel stages', () => {
  assert.deepEqual(AWARENESS_OPTIONS.map(option => [option.id, stageForAwareness(option.id)]), [
    ['new', 'Awareness'],
    ['problem', 'Interest'],
    ['aware', 'Interest'],
    ['considering', 'Desire'],
    ['ready', 'Action'],
  ]);
  assert.equal(stageForAwareness('unknown'), null);
});

test('channel choices preserve old packs and Both contains PNG-only supported placements', () => {
  assert.equal(channelForPack('meta-images'), 'meta');
  assert.equal(channelForPack('meta-feed'), 'meta');
  assert.equal(channelForPack('google-assets'), 'google');
  assert.equal(channelForPack('google-banners'), 'google');
  assert.equal(packForChannel('meta', sceneForConcept('founder-note')), 'meta-feed');
  assert.equal(packForChannel('google', sceneForConcept('launch-tracker-v1')), 'google-assets');
  assert.equal(packForChannel('both', sceneForConcept('launch-tracker-v1')), 'meta-google-images');
  assert.equal(packForChannel('google', sceneForConcept('founder-note')), null);
  assert.equal(packForChannel('both', sceneForConcept('benefit-comparison-v2')), null);
  assert.deepEqual(PACKS['meta-google-images'].placements, [
    '1:1', '4:5', '9:16',
    'google-landscape', 'google-square', 'google-portrait',
    'logo-square', 'logo-wide',
  ]);
  assert.ok(PACKS['meta-google-images'].placements.every(placement => PLACEMENTS[placement].mimeType === 'image/png'));
});

test('Both pack placements all render with the supported Launch Tracker renderer', async () => {
  const assets = await loadRenderAssets();
  const scene = sceneForConcept('launch-tracker-v1');
  for (const placement of PACKS['meta-google-images'].placements) {
    const html = renderSceneHtml(scene, placement, assets);
    assert.match(html, /<!doctype html>/);
  }
});

test('primary style cards stay renderable and structured scenes hide ignored controls', async () => {
  const ideaBuilder = await readFile(new URL('../components/creative-studio/IdeaBuilder.tsx', import.meta.url), 'utf8');
  const studio = await readFile(new URL('../components/creative-studio/CreativeStudio.tsx', import.meta.url), 'utf8');
  assert.match(ideaBuilder, /FORMATS\.filter\(f=>f\.id!==['"]process['"]\)/);
  assert.match(ideaBuilder, /Process walkthrough · planning only/);
  assert.match(studio, /const channelPlacements = pack\.placements/);
  assert.match(studio, /const structuredEditable = scene\.template === 'editable-note-v2' \|\| scene\.template === 'benefit-comparison-v2'/);
  assert.match(studio, /structuredEditable\?<fieldset/);
  assert.match(studio, /This renderer does not use supporting copy, logo alignment or headline-size controls/);
});
