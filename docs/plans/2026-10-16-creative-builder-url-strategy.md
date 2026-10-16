# URL-Led Creative Strategy and Concept Studio Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current style-first Creative Builder entry flow with an authenticated URL-led workflow that scans one landing page, proposes editable funnel/media assumptions, generates six materially distinct ad concepts, supports conversational revision, and exports approved Meta static assets without publishing to ad platforms.

**Architecture:** Add a bounded, SSRF-resistant landing-page scanner and an Anthropic structured-generation adapter behind a new authenticated Creative Strategy API. Persist the scan receipt, confirmed assumptions, concepts, and conversation additively in the existing direction JSONB contract, then map a selected concept into a generic generated-native scene that the existing immutable HTML, PNG export, review, and approval pipeline can render. Keep old saved projects and templates readable.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, AI SDK with `@ai-sdk/anthropic`, Node HTTP/HTTPS and DNS APIs, Sharp, existing Supabase-authenticated Creative Studio repository/runtime, Puppeteer export tests.

---

## Scope and non-goals

### Included

- Exact landing-page scan, with homepage retrieval only when the landing page lacks basic brand metadata.
- Editable recommendation for offer, audience, awareness, funnel stage, objective, channels, message, CTA, claims, and asset candidates.
- Exactly six distinct test hypotheses drawn from a researched concept catalog that includes the 11 EIC ClickUp concepts.
- Real primary text, headline, CTA, visual direction, test rationale, and Meta-style visual mockup for every concept.
- Conversational revision of the plan or concepts, with bounded history and version preservation through existing direction revisions.
- Selection of one concept and composition into the existing immutable preview/export/review flow.
- Website image candidates, with safe server-side refetch, resize, metadata stripping, and immutable embedding when a selected image is used.
- Meta static placement exports only: 1:1, 4:5, and 9:16.
- Private-beta cost controls, claim confirmation, and source provenance.

### Explicitly excluded

- Ad-platform publishing or campaign creation.
- Google Search copy workflow.
- Video rendering or MP4 export. Video concepts may be suggested only as clearly labeled planning recommendations, not selectable static outputs.
- Unbounded site crawling.
- Claims that any concept is a predicted winner or guaranteed to convert.
- Fabricated testimonials, comments, messages, press coverage, metrics, or people.
- AI image generation in this PR. Website imagery and text-led graphic treatments are supported first.

## Acceptance criteria

1. An eligible authenticated user can enter an `http` or `https` landing-page URL and receive a source-backed recommendation.
2. Private, loopback, link-local, metadata-service, nonstandard-port, credentialed, over-size, slow, and unsafe redirect URLs fail closed before model invocation.
3. The scanner retains only bounded extracted text and metadata, never scripts, raw HTML, cookies, or arbitrary response headers.
4. The assumptions screen is editable and requires confirmation before concept generation.
5. Generation returns exactly six concepts with unique persuasion jobs and unique visual families.
6. Each concept contains complete ad copy, headline, CTA, rationale, evidence references, and a realistic static preview.
7. The user can type feedback and receive a revised plan or concept without losing prior revisions.
8. Selecting a supported concept creates a generic, customer-specific scene, not an EIC-hardcoded template.
9. Website imagery used in an export is safely refetched, resized, stripped, embedded into immutable HTML, and never loaded remotely by the preview sandbox.
10. Existing saved Idea records, Direction records, Scene records, previews, and exports continue to parse and render.
11. Export, QA, human review, and approval remain separate from publishing.
12. All focused tests, type checking, linting, production build, and browser QA pass before a preview PR is handed to Dustin.

---

### Task 1: Add the researched concept catalog and selection rules

**Objective:** Encode the EIC ClickUp concepts and additional persuasion jobs as a bounded product catalog rather than exposing internal template names as user choices.

**Files:**
- Create: `src/lib/creative-studio/strategy.ts`
- Create: `src/services/creative-studio-strategy.test.mts`
- Reference: `docs/research/2026-10-16-creative-builder-concept-library.md`

**Step 1: Write failing schema tests**

Test that:

- The catalog includes receipt, text thread, founder note, tracker, editorial, job post, comment thread, math, comparison, and communication-proof treatments.
- A generated portfolio must contain exactly six concepts.
- `persuasionJob` and `visualFamily` are unique across the six initial concepts.
- Unsupported “winner,” fabricated testimonial, or video-as-static output flags are rejected.
- Every factual claim points to a bounded source excerpt ID or is marked `needs-confirmation`.
- Primary text, headline, description, CTA, rationale, and visual direction respect Meta-oriented maxima.

**Step 2: Run the new test and verify failure**

Run:

```bash
env -u VERCEL -u VERCEL_ENV node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/creative-studio-strategy.test.mts
```

Expected: FAIL because `strategy.ts` does not exist.

**Step 3: Implement bounded Zod contracts**

Define additive contracts for:

- `LandingPageReceipt`
- `SourceExcerpt`
- `AssetCandidate`
- `CreativeAssumptions`
- `ChannelRecommendation`
- `GeneratedConcept`
- `CreativeStrategy`
- `StrategyConversationTurn`
- `ConceptCatalogEntry`

Keep arrays, strings, and conversation history bounded. Separate `recommendation` from `observedSource` so an inferred audience is never presented as page fact.

**Step 4: Run the focused test and verify pass**

Expected: all strategy schema/catalog tests pass.

**Step 5: Commit**

```bash
git add src/lib/creative-studio/strategy.ts src/services/creative-studio-strategy.test.mts docs/research/2026-10-16-creative-builder-concept-library.md
git commit -m "feat: add creative strategy concept catalog"
```

---

### Task 2: Build an SSRF-resistant bounded landing-page scanner

**Objective:** Fetch the exact user-supplied page safely and extract only the context needed for planning.

**Files:**
- Create: `src/services/creative-studio-page-scan.ts`
- Create: `src/services/creative-studio-page-scan.test.mts`

**Step 1: Write failing scanner tests**

Use injected DNS and HTTP transports. Cover:

- HTTPS public hostname success.
- Optional homepage fallback only when title/description/logo context is missing.
- Reject URL credentials, fragments after normalization, ports other than 80/443, IP literals, localhost names, `.local`, and non-HTTP protocols.
- Reject IPv4 and IPv6 loopback, RFC1918, carrier-grade NAT, link-local, unique-local, multicast, unspecified, and documentation/metadata destinations.
- Re-resolve and revalidate every redirect, cap redirects at three, and pin the validated address for the connection.
- Abort on timeout, response body beyond 1 MiB, disallowed MIME type, and decompression/body errors.
- Do not forward cookies, authorization, referrer, or browser credentials.
- Extract canonical URL, title, meta description, Open Graph fields, headings, bounded body text, logo candidates, and image candidates.
- Strip scripts, styles, SVG scripts, forms, comments, and control characters.

**Step 2: Run the test and verify failure**

Expected: missing module failure.

**Step 3: Implement scanner and pure extractors**

Use Node `dns/promises` and `http`/`https` with an injected pinned `lookup` callback. Use manual redirects. Keep maximums as exported constants and return a normalized receipt, not raw HTML.

**Step 4: Run scanner tests**

Expected: all security and extraction cases pass without network access.

**Step 5: Commit**

```bash
git add src/services/creative-studio-page-scan.ts src/services/creative-studio-page-scan.test.mts
git commit -m "feat: add bounded landing page scanner"
```

---

### Task 3: Add safe website-image preparation for immutable recipes

**Objective:** Allow selected landing-page imagery to appear in exports without remote image loading or oversized raw assets.

**Files:**
- Modify: `src/services/creative-studio-page-scan.ts`
- Modify: `src/lib/creative-studio/render.ts`
- Modify: `src/services/creative-studio-page-scan.test.mts`
- Modify: `src/services/creative-studio-snapshots.test.mts`

**Step 1: Write failing image tests**

Cover:

- Candidate URL must pass the same public-network and redirect validation as page scans.
- Accept only JPEG, PNG, or WebP bytes whose signatures match their declared type.
- Cap input at 8 MiB and decoded dimensions/pixels at a safe bound.
- Resize to at most 1600 px, rotate from EXIF, strip metadata, convert to WebP, and cap output quality/size.
- Return a trusted `data:image/webp;base64,...` value.
- Reject SVG, animated/malformed inputs, MIME confusion, decompression bombs, and private redirects.

**Step 2: Run tests and verify failure**

Expected: image preparation function is missing.

**Step 3: Implement with Sharp**

Extend `RenderAssets` with optional `subjectImageData`. Never persist the downloaded original or remote-load it in recipe HTML.

**Step 4: Run focused tests**

Expected: all image and snapshot tests pass.

**Step 5: Commit**

```bash
git add src/services/creative-studio-page-scan.ts src/lib/creative-studio/render.ts src/services/creative-studio-page-scan.test.mts src/services/creative-studio-snapshots.test.mts
git commit -m "feat: prepare safe landing page images"
```

---

### Task 4: Add structured AI planning and revision adapters

**Objective:** Produce source-grounded assumptions and diverse concepts without allowing page content to control the model.

**Files:**
- Create: `src/services/creative-studio-strategy-ai.ts`
- Create: `src/services/creative-studio-strategy-ai.test.mts`

**Step 1: Write failing adapter tests**

Inject the model executor and assert:

- Page text is delimited and explicitly treated as untrusted data.
- The model receives only the bounded receipt and catalog metadata.
- Initial analysis returns assumptions and channel recommendations, not concepts.
- Concept generation requires `assumptionsConfirmedAt` and returns exactly six diverse concepts.
- Revision can target assumptions, one concept, or the portfolio, while preserving immutable prior turns.
- The adapter rejects claims without receipt references or confirmation flags.
- Text claiming to override instructions is carried as page content, not executed.
- Model/provider errors are sanitized.

**Step 2: Run test and verify failure**

Expected: missing adapter failure.

**Step 3: Implement production adapter**

Use the repository’s existing `@ai-sdk/anthropic` integration and structured output with Zod. Set explicit token/output bounds. Use a current Sonnet model already supported by the project. Do not add a second provider in this PR.

Prompts must enforce:

- TOF: audience + problem + solution category.
- MOF: education + proof + trust.
- BOF: offer + objection handling + clear next step.
- Format does not determine funnel stage.
- Recommendations are hypotheses, not winners.
- No invented reviews, results, people, publications, or guarantees.

**Step 4: Run focused tests**

Expected: adapter tests pass with fake executor and no network.

**Step 5: Commit**

```bash
git add src/services/creative-studio-strategy-ai.ts src/services/creative-studio-strategy-ai.test.mts
git commit -m "feat: add structured creative planning adapter"
```

---

### Task 5: Add shared authorization and the Creative Strategy API

**Objective:** Expose scan, concept generation, and revision only to the same eligible users as Creative Studio.

**Files:**
- Create: `src/services/creative-studio-request-context.ts`
- Create: `src/app/api/creative-studio/strategy/route.ts`
- Create: `src/services/creative-studio-strategy-route.test.mts`
- Modify: `src/app/api/creative-studio/route.ts`

**Step 1: Write failing route tests**

Cover:

- Authenticate and authorize before scanner or model construction.
- Deny anonymous, ineligible, cross-origin, wrong content type, duplicate query/body fields, and oversized requests.
- Supported operations: `analyze-url`, `generate-concepts`, and `revise-strategy`.
- One active expensive request per user in a process, with bounded input/output. Treat this as private-beta protection, not durable billing enforcement.
- Return `Cache-Control: private, no-store` and `nosniff`.
- Do not return raw HTML, provider details, model chain-of-thought, internal prompts, or credentials.
- Existing `/api/creative-studio` behavior remains unchanged after auth extraction.

**Step 2: Run tests and verify failure**

Expected: missing route/context failures.

**Step 3: Extract shared context and implement route**

The route performs:

1. Same-origin and JSON validation.
2. Shared Creative Studio authorization.
3. Zod command parsing.
4. Scanner/model invocation through bounded adapters.
5. Sanitized typed response.

**Step 4: Run route and existing authorization tests**

Expected: all pass.

**Step 5: Commit**

```bash
git add src/services/creative-studio-request-context.ts src/app/api/creative-studio/strategy/route.ts src/services/creative-studio-strategy-route.test.mts src/app/api/creative-studio/route.ts
git commit -m "feat: add authenticated creative strategy API"
```

---

### Task 6: Persist strategy state additively in saved directions

**Objective:** Save scans, assumptions, concepts, selections, and conversation without a database migration or legacy breakage.

**Files:**
- Modify: `src/lib/creative-studio/directions.ts`
- Modify: `src/services/creative-studio-directions.test.mts`
- Modify: `src/services/creative-studio-repository.test.mts`
- Modify: `src/services/creative-studio-ideas.test.mts`

**Step 1: Write failing compatibility tests**

Test that:

- Legacy Direction JSON without `strategy` still parses exactly.
- `DirectionSchema` accepts optional `strategy` and no unknown keys.
- Strategy saves use the existing optimistic `expectedDirectionId` conflict guard.
- Prior saved direction revisions remain immutable.
- Project/list projections expose the customer-safe strategy but no raw HTML or model internals.

**Step 2: Run focused tests and verify failure**

Expected: `strategy` is rejected by the strict schema.

**Step 3: Add optional strategy field**

Import `CreativeStrategySchema` into `directions.ts`. Keep `DEFAULT_DIRECTION` unchanged and avoid database DDL because the direction is already persisted as JSONB through the existing RPC.

**Step 4: Run focused and repository tests**

Expected: legacy and new records pass.

**Step 5: Commit**

```bash
git add src/lib/creative-studio/directions.ts src/services/creative-studio-directions.test.mts src/services/creative-studio-repository.test.mts src/services/creative-studio-ideas.test.mts
git commit -m "feat: persist creative strategy in directions"
```

---

### Task 7: Add generic generated-native scenes and renderers

**Objective:** Turn a selected concept into customer-specific artwork instead of an EIC-hardcoded template.

**Files:**
- Create: `src/lib/creative-studio/generated-renderer.ts`
- Modify: `src/lib/creative-studio/model.ts`
- Modify: `src/lib/creative-studio/render.ts`
- Modify: `src/services/creative-studio-concepts.test.mts`
- Create: `src/services/creative-studio-generated-renderer.test.mts`

**Step 1: Write failing scene and rendering tests**

Cover generic static families:

- Receipt/pricing.
- Text thread.
- Founder note.
- Editorial headline.
- Process tracker.
- Comment/Q&A.
- Math/economic case.
- Comparison.
- Problem/solution typography.
- Proof card.

For each, assert:

- Customer-specific brand/copy fields are present.
- HTML escapes every model/user string.
- Optional prepared image is a trusted data URI only.
- No remote URL appears in recipe HTML.
- 1:1, 4:5, and 9:16 render with safe zones and no overflow in fixture cases.
- Unsupported video concepts cannot compose.
- Claim and illustrative-conversation labels remain visible.

**Step 2: Run tests and verify failure**

Expected: generated scene/template is not supported.

**Step 3: Implement additive scene, provenance, and renderer contracts**

Add `generated-native-v1` plus a strict `generatedCreative` payload to `SceneSchema`. Dispatch to a family-specific renderer inside `generated-renderer.ts`. Preserve every legacy template and renderer unchanged.

Extend `BriefSchema` additively with a provenance mode so legacy EIC briefs retain their exact seven required source IDs while URL-strategy briefs can carry landing-page excerpt IDs without falsely claiming the EIC blueprint, transcript, or brand-sheet sources. Update `validateSceneClaims`, `conceptPackCompatible`, and `packForChannel` so:

- Confirmed URL-strategy prices, percentages, comparisons, and guarantees are evaluated against structured claim receipts instead of the legacy blanket regex alone.
- Unconfirmed or unsupported claims still fail closed.
- Internal labels such as TOF, MOF, BOF, and retargeting never appear in artwork copy.
- `generated-native-v1` supports the `meta-images` pack with 1:1, 4:5, and 9:16.
- Existing concept templates preserve their current pack and stage restrictions.

**Step 4: Run renderer and snapshot tests**

Expected: generic fixtures and all legacy fixtures pass.

**Step 5: Commit**

```bash
git add src/lib/creative-studio/generated-renderer.ts src/lib/creative-studio/model.ts src/lib/creative-studio/render.ts src/services/creative-studio-concepts.test.mts src/services/creative-studio-generated-renderer.test.mts
git commit -m "feat: render generic generated ad concepts"
```

---

### Task 8: Map confirmed strategy and concepts into the immutable export pipeline

**Objective:** Compose selected URL-generated concepts using the existing version, recipe, QA, review, and approval protections.

**Files:**
- Modify: `src/lib/creative-studio/strategy.ts`
- Modify: `src/services/creative-studio.ts`
- Modify: `src/services/creative-studio-hosted.ts`
- Modify: `src/services/creative-studio-guided-flow.test.mts`
- Create: `src/services/creative-studio-strategy-compose.test.mts`

**Step 1: Write failing mapping tests**

Test that:

- Only confirmed assumptions and selectable static concepts map to `Brief` and `Scene`.
- Meta channel selection maps to the three approved static placements.
- A selected page image is prepared before recipe creation.
- Source snapshot contains the landing-page URL/excerpts, catalog source, user confirmations, and warnings.
- Unsupported Google/video outputs fail closed rather than silently generating the wrong files.
- New scenes pass existing immutable recipe hashing and optimistic version checks.
- Approval still requires all exports and explicit human review.

**Step 2: Run focused tests and verify failure**

Expected: mapping/composition is missing.

**Step 3: Implement mapping and service support**

Add pure helpers such as `strategyBrief` and `strategyScene`. Make render-asset preparation asynchronous before `renderSceneHtml`, but keep recipe HTML immutable once a version is composed.

**Step 4: Run strategy, hosted, repository, and render tests**

Expected: all pass.

**Step 5: Commit**

```bash
git add src/lib/creative-studio/strategy.ts src/services/creative-studio.ts src/services/creative-studio-hosted.ts src/services/creative-studio-guided-flow.test.mts src/services/creative-studio-strategy-compose.test.mts
git commit -m "feat: compose URL generated concepts"
```

---

### Task 9: Build the URL-first planning and confirmation interface

**Objective:** Replace abstract style selection with the approved URL → assumptions → confirmation flow.

**Files:**
- Create: `src/components/creative-studio/UrlCreativePlanner.tsx`
- Create: `src/components/creative-studio/ConceptPreview.tsx`
- Modify: `src/components/creative-studio/CreativeStudio.tsx`
- Modify: `src/components/creative-studio/studio.css`
- Create: `src/services/creative-studio-url-planner-ui.test.mts`

**Step 1: Write failing UI contract tests**

Assert source structure and pure component behavior for:

- One prominent landing-page URL field.
- Progress states for scanning and recommendation generation.
- Editable advertised subject, audience, awareness, stage, objective, message, CTA, claims, channels, and image candidate.
- Clear distinction between “found on page” and “our assumption.”
- Confirmation required before generating concepts.
- No abstract style picker in the primary path.
- Error, retry, keyboard, label, focus, and live-region behavior.
- Old saved Idea-based projects remain openable through a collapsed legacy editor.

**Step 2: Run test and verify failure**

Expected: planner components do not exist.

**Step 3: Implement planner UI**

The primary flow is:

1. Enter URL.
2. Review and edit assumptions/media recommendation.
3. Confirm plan.
4. Generate six concepts.
5. Select and refine.
6. Compose/export below.

Change the status copy from “No AI provider enabled” to truthful private-beta language only when the strategy endpoint is enabled. Keep publishing explicitly unavailable.

**Step 4: Run UI contract and type tests**

Expected: all pass.

**Step 5: Commit**

```bash
git add src/components/creative-studio/UrlCreativePlanner.tsx src/components/creative-studio/ConceptPreview.tsx src/components/creative-studio/CreativeStudio.tsx src/components/creative-studio/studio.css src/services/creative-studio-url-planner-ui.test.mts
git commit -m "feat: add URL first creative planning flow"
```

---

### Task 10: Add six-concept presentation and conversational revision

**Objective:** Show complete live-ad examples and let users revise them in plain language.

**Files:**
- Modify: `src/components/creative-studio/UrlCreativePlanner.tsx`
- Modify: `src/components/creative-studio/ConceptPreview.tsx`
- Modify: `src/components/creative-studio/studio.css`
- Modify: `src/services/creative-studio-url-planner-ui.test.mts`

**Step 1: Write failing interaction tests**

Cover:

- Exactly six cards with persuasion job, audience/stage, primary text, headline, CTA, design, rationale, evidence/claim warning, and realistic Meta shell.
- Selection of one or more concepts for future A/B variants.
- A chat box that can target the overall plan or a selected concept.
- Common feedback such as “shorten the headline,” “use the second image,” and “combine concept two’s copy with concept four’s design.”
- Previous plan/concept revisions remain inspectable.
- Feedback submission is disabled while a request is active and bounded client-side/server-side.
- “Apply to artwork” is enabled only for confirmed static concepts.

**Step 2: Run tests and verify failure**

Expected: interaction states are missing.

**Step 3: Implement interactions**

Persist each accepted revision by calling the existing optimistic direction save. Never overwrite the previous saved direction revision. On apply, map the selected concept into editable artwork and preserve the concept source receipt.

**Step 4: Run UI and service tests**

Expected: all pass.

**Step 5: Commit**

```bash
git add src/components/creative-studio/UrlCreativePlanner.tsx src/components/creative-studio/ConceptPreview.tsx src/components/creative-studio/studio.css src/services/creative-studio-url-planner-ui.test.mts
git commit -m "feat: add conversational concept refinement"
```

---

### Task 11: Verify full compatibility and production build

**Objective:** Prove the new workflow does not weaken existing ownership, rendering, or approval behavior.

**Files:**
- Modify only as required by test-discovered defects.

**Step 1: Run focused Creative Studio suite**

```bash
env -u VERCEL -u VERCEL_ENV -u CREATIVE_STUDIO_HOSTED_ENABLED CREATIVE_STUDIO_LOCAL_REVIEW=1 node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/creative-studio*.test.mts
```

Expected: all tests pass, with only the previously documented network-dependent skip if still applicable.

**Step 2: Run type check and lint**

```bash
npm run typecheck
npm run lint
```

Expected: exit 0.

**Step 3: Run production build**

```bash
npm run build
```

Expected: exit 0 with the Creative Builder and strategy API routes included.

**Step 4: Run security inspection**

Search generated source and fixtures for:

- Raw secret values.
- Raw HTML persistence.
- Remote URLs inside immutable recipe HTML.
- `dangerouslySetInnerHTML` fed by model/user strings outside the trusted renderer boundary.
- Ad publishing APIs or platform mutations.

Expected: none.

**Step 5: Commit any verification fixes**

```bash
git add -A
git commit -m "test: verify URL creative planning workflow"
```

---

### Task 12: Run authenticated preview QA and open a protected PR

**Objective:** Give Dustin a real preview for review without merging or launching production.

**Files:**
- Create: `docs/qa/2026-10-16-creative-builder-url-strategy.md`

**Step 1: Start a preview environment**

Use the repository’s normal Vercel preview workflow or a verified local hosted-private-beta environment. Do not alter production or merge `main`.

**Step 2: Exercise representative landing pages**

Test at least:

- One EIC offer page with clear copy and images.
- One page with sparse metadata.
- One page with no usable images.
- One malicious/unsafe URL fixture.
- One page containing prompt-injection-like text.

**Step 3: Verify the full user path**

For an eligible authenticated EIC user:

1. Submit URL.
2. Review source-backed assumptions.
3. Edit funnel stage/audience/channel.
4. Confirm.
5. Generate six distinct concepts.
6. Revise one concept conversationally.
7. Select a website image when available.
8. Apply the concept.
9. Compose immutable HTML.
10. Export all three Meta placements.
11. Review each actual-size file.
12. Approve as design only.
13. Reload and verify strategy/history persistence.

**Step 4: Record evidence**

Document tested URLs, timestamps, commit SHA, screenshots, exported dimensions, test/build output, known limitations, and confirmation that no platform publishing occurred.

**Step 5: Push and open PR**

```bash
git push -u origin feat/creative-builder-url-planner
gh pr create --base main --head feat/creative-builder-url-planner --title "feat: add URL-led creative strategy workflow" --body-file /tmp/creative-builder-pr.md
```

The PR must include:

- Product flow summary.
- ClickUp concept source and research summary.
- Security and cost controls.
- Test/build evidence.
- Preview URL.
- Known limitation that video and AI image generation are not included.
- Explicit note: Dustin alone decides whether to merge/launch production.

**Step 6: Do not merge**

Stop after verified preview and PR handoff.
