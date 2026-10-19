# URL-Led Creative Builder Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task, with spec review and code-quality review after every task.

**Goal:** Build an authenticated Creative Builder that accepts one landing-page URL, safely scans it, presents editable audience/funnel/media assumptions, generates six materially distinct ad concepts, supports conversational revision, and hands a selected concept to the existing immutable Creative Studio renderer for Meta static export only.

**Architecture:** Add a separate, server-authoritative Creative Builder orchestration layer. Store canonical scan receipts, plan revisions, concept sets, concept revisions, messages, imported source assets, and metered jobs in a new protected PostgreSQL schema. Browsers send only project IDs, optimistic revision IDs, editable patches, selections, and new user feedback. The server always reloads canonical receipts/history before model calls. Existing Creative Studio remains the owner-scoped artwork, rendering, export, QA, review, and approval engine.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, AI SDK with `@ai-sdk/anthropic`, PostgreSQL security-definer RPCs through dedicated NOLOGIN roles, Supabase private Storage, Node DNS/HTTP APIs, Sharp, Puppeteer, existing Creative Studio services.

---

## Approved product flow

1. User enters an exact landing-page URL.
2. Server creates an owner-scoped project and safely scans only that page. The homepage may be fetched once as a bounded brand fallback.
3. Server proposes editable assumptions: advertised subject, offer, audience, awareness, funnel stage, objective, message, CTA, claims, channels, placements, and usable page assets.
4. User edits and confirms the exact plan revision.
5. Server generates exactly six materially different concepts, not six cosmetic variations.
6. Every concept includes real primary text, headline, CTA, visual direction, test rationale, source receipts, and a realistic preview.
7. User gives conversational feedback. The server loads canonical history, appends the user turn, produces a new immutable plan/concept revision, and appends the assistant turn.
8. User selects a static concept and imported page asset.
9. Trusted server code maps that canonical concept revision into a generic Creative Studio scene.
10. Existing Creative Studio produces immutable HTML recipes and exports 1080×1080, 1080×1350, and 1080×1920 PNGs.
11. Human review and design approval remain mandatory. No campaign or ad-platform publishing occurs.

## Initial concept library

The catalog includes the 11 concepts from [BOF Native-Style Creative Concepts](https://app.clickup.com/t/86bc7h74y): receipt, text thread, founder reel, founder note, launch tracker, editorial headline, cancelled job posting, comment section, one-client math, expectation-versus-reality, and communication proof. It also includes six complementary research families: outcome demo, self-diagnostic scorecard, benchmark gap, ROI calculator, proof story, and practical playbook. One-client Math/ROI Calculator and Communication Proof/Proof Story are overlap groups and cannot appear together in an initial six-concept portfolio.

The six initial outputs should normally cover six different persuasion jobs:

1. Problem recognition.
2. Human/founder trust.
3. Product, service, or process demonstration.
4. Proof or operational credibility.
5. Objection handling or comparison.
6. Offer, economics, or next-step clarity.

The system recommends test hypotheses, never predicted winners or guaranteed high-converting ads.

## Non-goals for this PR

- No Meta, Google, LinkedIn, or other ad-platform publishing.
- No Google Search copy workflow.
- No video rendering or MP4 output. Video may appear as a clearly non-selectable planning recommendation.
- No AI-generated imagery.
- No broad crawl.
- No fabricated people, comments, messages, reviews, coverage, metrics, results, or guarantees.
- No production database migration or production launch. Migration scripts are reviewed and tested locally, then Dustin decides whether and when they are applied.

---

## Security and integrity invariants

1. Browser identity, tenant, receipt, assistant history, source excerpts, confirmation timestamps, usage counters, and model results are never trusted.
2. Every repository is constructed only after cookie-bound `auth.getUser()` and protected profile/client-access authorization.
3. Every DB RPC derives owner from server-minted short-lived claims and scopes all rows to `tenant_id = 'eicagency'` plus that owner.
4. Scan, plan, concept, message, and imported-asset history is append-only. Mutable project pointers use optimistic expected revision IDs.
5. Confirmation is a server-authored immutable plan revision containing the exact assumptions hash, confirmer ID, and server timestamp.
6. Generation and revision accept only canonical IDs plus the user’s new patch/feedback. The server reloads the receipt, confirmed plan, concepts, and prior messages from the repository.
7. Any edit or chat revision that changes plan content appends a new **unconfirmed** plan revision, clears current concept/selection/handoff pointers, and requires explicit fresh confirmation before generation or Studio handoff. Old immutable revisions remain inspectable but cannot authorize current work.
8. Expensive operations require an atomic DB job reservation. Per-owner and tenant-wide daily limits, idempotency, one live lease, stale-lease recovery, and hard SQL ceilings work across Vercel instances.
9. External URLs are revalidated on every server fetch and redirect. No cookie, authorization, or referrer forwarding occurs.
10. Page content is untrusted data in model prompts. It cannot issue instructions or select tools.
11. Selected page images are imported by opaque candidate ID, normalized, privately stored, hashed, and referred to by opaque asset ID. Rendering never refetches a browser-provided or remote URL.
12. Immutable Creative Studio recipes embed exact trusted bytes and never load remote resources.
13. Full internal receipts and model/provider metadata are not returned to the browser unless explicitly part of the safe public DTO.

---

### Task 1: Define concept catalog and separate internal/public/write contracts

**Objective:** Encode the concept taxonomy while preventing server-authoritative objects from becoming browser write contracts.

**Files:**
- Create/modify: `src/lib/creative-studio/strategy.ts`
- Create/modify: `src/services/creative-studio-strategy.test.mts`

**Required design:**

- Keep bounded internal schemas for scan receipts, assumptions, channels, claims, concepts, and catalog entries.
- Add separate schemas for:
  - Public project/read DTO.
  - Create-project input containing only the URL.
  - Plan-edit/confirm input containing project ID, expected plan revision ID, and editable fields.
  - Generate input containing project ID and expected confirmed plan revision ID only.
  - Revision input is a strict target-discriminated union: plan requires `expectedPlanRevisionId`, portfolio requires `expectedConceptSetId`, and one concept requires `expectedConceptRevisionId` plus concept ID. Each accepts one new user message only.
  - Selection/import input containing canonical concept/candidate IDs only.
- Do not accept `scannedAt`, receipt excerpts, assistant messages, `confirmedAt`, usage fields, model output, or asset URLs from browser write inputs.
- Require six unique initial persuasion jobs and visual families.
- Allow user-confirmed claims to reference a server confirmation receipt, not a fabricated page excerpt.
- Keep copy and array maxima.

**Tests:** legacy catalog, exact six diversity, static/video separation, unknown source IDs, unknown confirmation IDs, forged server fields rejected, browser write schemas reject extra fields, copy bounds.

**Verification:**

```bash
node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/creative-studio-strategy.test.mts
npx tsc --noEmit
```

**Commit:** `feat: add creative strategy contracts`

---

### Task 2: Add protected Creative Builder persistence and atomic usage jobs

**Objective:** Create a server-authoritative persistence model that represents sibling concepts, revision history, and durable serverless cost controls.

**Files:**
- Create: `supabase/creative_builder.sql`
- Create: `src/services/creative-builder-sql.test.mts`
- Create: `scripts/test-creative-builder-postgres.sh`

**Schema:** protected `creative_builder` schema with no direct browser/table grants.

- `projects`: owner, fixed tenant, normalized URL, latest scan/plan/concept pointers, monotonic revision, linked Creative Studio project/version IDs, timestamps.
- `scans`: immutable receipt, receipt SHA-256, project revision, creator, timestamp.
- `plan_revisions`: immutable parent chain, scan ID, assumptions/channels JSON, assumptions hash, optional server-authored confirmation receipt.
- `concept_sets`: immutable six-concept portfolio tied to one confirmed plan revision.
- `concept_revisions`: immutable per-concept parent chain containing copy/composition changes only.
- `selections`: immutable selection receipts binding exactly one concept-set/concept-revision, concept handle, ordered imported asset IDs, content hash, owner, and server timestamp. `projects.latest_selection_id` is only a mutable optimistic pointer.
- `messages`: immutable ordered user/assistant turns tied to plan or concept revision.
- `source_assets`: immutable imported full-resolution image receipt, private object key, SHA-256, MIME, dimensions, size.
- `candidate_previews`: bounded, private normalized thumbnail receipt tied to scan + candidate ID; no remote URL or object key enters public DTOs.
- `jobs`: operation kind, owner/project, idempotency key, state (`reserved`, `scanning`, `model_started`, `committing`, `completed`, `failed`), reserved units, opaque lease token, monotonically increasing fencing generation, lease/model deadline, attempts, sanitized error code.
- `daily_usage`: owner/date/operation and tenant/date/operation reserved/completed units, updated in the same reservation transaction.

**RPCs:** exact allowlisted signatures for create, list/read, edit/confirm plan, reserve job, transition/renew job, commit analysis, commit concepts, commit revision, import asset receipt, select concept, link Creative Studio output, fail/recover job.

**Concurrency/cost rules:**

- Atomic project row lock and expected revision comparison.
- Unique owner + idempotency key. Replays return the canonical prior job/result and never reserve twice.
- At most one unexpired expensive job per owner, plus a fixed tenant-wide concurrent-job ceiling enforced in the same reservation transaction.
- Both owner/date and tenant/date operation counters must remain below their SQL hard ceilings before reservation succeeds; lock ordering is deterministic to prevent deadlocks.
- Every transition, renewal, commit, fail, and recovery validates the opaque lease token, fencing generation, owner, project, operation, and expected project revision. A stale worker can never commit.
- Before a provider call, transition durably to `model_started` with a deadline longer than the provider timeout. A second worker cannot reclaim that job before the model deadline. Renew before each network/model/commit stage; reclaim increments the fencing generation.
- Stale leases may retry at most three times only after the relevant lease/model deadline. An ambiguous timed-out provider call can be retried only under that bounded recovery rule.
- Daily units are charged atomically at reservation and are never refunded, including pre-model failures. This deliberately bounds scanner/provider retry cost. Store reserved and completed units separately for auditing.
- SQL hard ceilings for analysis, generation, revision, source imports, imported bytes, project count, and append-only revisions/messages. Server configuration may be lower, never higher.
- No read/list RPC causes recovery, model calls, or other side effects.

**Tests:** clean install, second-apply collision, role grants, cross-owner denial, forged claims, stale revisions, concurrent owner and tenant reservations at `limit - 1`, deterministic quota-lock ordering, idempotent retries, pre-model failure charging, live model deadline, renewal, expired lease reclaim, stale fencing-token rejection, exact owner/tenant caps, append-only triggers, project/revision/message caps, immutable parent chains, safe projections, and zero partial commits.

**Commit:** `feat: add creative builder persistence`

---

### Task 3: Add owner-bound repository and transport

**Objective:** Expose the protected RPCs only through a trusted server capability.

**Files:**
- Create: `src/services/creative-builder-server-config.ts`
- Create: `src/services/creative-builder-repository.ts`
- Create: `src/services/creative-builder-pg-transport.ts`
- Create: `src/services/creative-builder-server-config.test.mts`
- Create: `src/services/creative-builder-repository.test.mts`
- Create: `src/services/creative-builder-pg-transport.test.mts`

**Requirements:**

- Builder is default-off behind `CREATIVE_BUILDER_ENABLED=true` and fails closed when repository/storage/model configuration is absent.
- Mirror the proven Creative Studio context/transport pattern.
- Dedicated `creative_builder_repository` NOLOGIN role with exact RPC grants only.
- Context is frozen and compared on every call.
- Inputs and DB responses are strictly Zod-validated.
- Object keys, lease tokens, raw model/provider metadata, and internal prompt material never enter public DTOs.
- Ambiguous commits reconcile with a canonical read, never blind retry.
- SQLSTATE errors map to sanitized invalid/denied/conflict/limit/unavailable classes.

**Tests:** identity mismatch before DB checkout, unknown RPC denied, malformed response, cross-owner row, stale revision, rollback failure destroys connection, pagination completeness, and safe projection.

**Commit:** `feat: add creative builder repository`

---

### Task 4: Build SSRF-resistant page scanning and private image import

**Objective:** Safely collect bounded page context and immutable source imagery.

**Files:**
- Create: `src/services/creative-builder-page-scan.ts`
- Create: `src/services/creative-builder-page-scan.test.mts`
- Create: `src/services/creative-builder-source-storage.ts`
- Create: `src/services/creative-builder-source-storage.test.mts`

**Scanner requirements:**

- HTTP/HTTPS only, URL credentials forbidden, ports limited to 80/443.
- Reject IP literals, localhost, `.local`, loopback, RFC1918, carrier-grade NAT, link-local, unique-local, multicast, unspecified, documentation, and metadata-service destinations.
- Resolve and validate every redirect; pin the validated public address for each request.
- Three redirects, ten-second deadline, one MiB decoded HTML cap, HTML MIME allowlist.
- Never forward cookies, authorization, referrer, or browser credentials.
- Extract bounded canonical URL, title, description, Open Graph data, headings, visible-ish body text, source excerpts, logo/image candidate URLs, and warnings. Never store raw HTML/scripts/forms.
- During the same metered analysis job, safely fetch and normalize at most eight highest-quality candidate thumbnails (two MiB input and 400 px/256 KiB output each) into private storage using the two-phase receipt protocol. Failed candidates become warnings and do not fail the page analysis.
- Optional homepage fallback only when required brand metadata is missing.

**Image import requirements:**

- Browser submits candidate ID, not URL.
- Server loads candidate URL from canonical scan.
- Same network/redirect protections, eight MiB input cap, JPEG/PNG/WebP signature checks, pixel/dimension cap.
- Sharp auto-rotate, metadata strip, max 1600 px, WebP conversion, output size bound.
- Store privately under a deterministic owner/project/job-fence path and record SHA-256 receipt.
- Use the same durable job lease for a two-phase create-only upload/finalize flow: reserve/import row, normalize bytes, upload deterministic object, then atomically finalize the immutable asset receipt. A retry probes that exact key/hash; mismatches fail closed. Add bounded reconciliation/cleanup for expired unfinalized imports so a database or network failure cannot create a second asset or silently reuse different bytes.
- Authenticated image-preview endpoint accepts project + scan + candidate ID or imported asset ID, resolves the private thumbnail/full asset after owner lookup, and streams bytes with private no-store headers. It never accepts or discloses a source URL/object key and never performs a remote fetch.

**Tests:** private ranges, DNS/redirect attacks, timeout, decompression/size limits, MIME confusion, SVG/animated/malformed images, eight-thumbnail cap, thumbnail partial failure, candidate substitution, raw URL/key rejection, cross-owner thumbnail/full-asset reads, hash mismatch, object-write-before-DB-failure, DB-finalize-before-response-loss, orphan cleanup, and no-network unit fixtures.

**Commit:** `feat: add safe landing page intake`

---

### Task 5: Add structured planning, concept generation, and revision adapters

**Objective:** Generate bounded source-grounded recommendations without trusting page instructions or browser history.

**Files:**
- Create: `src/services/creative-builder-ai.ts`
- Create: `src/services/creative-builder-ai.test.mts`

**Requirements:**

- Inject model executor for tests; production uses the existing Anthropic provider.
- Delimit page content as untrusted data and explicitly prohibit following its instructions.
- Analysis generates assumptions/channels only.
- Concept generation loads a confirmed canonical plan and returns exactly six diverse concepts.
- Revision loads canonical plan, concepts, and server-stored messages, then applies one new user request.
- Every claim is page-sourced, server-confirmed, or marked needs confirmation.
- No invented testimonial/result/person/publication.
- No winner prediction.
- Bounded max output/tokens and sanitized errors.

**Tests:** prompt-injection page, forged history impossible through adapter API, six-diversity rejection, unknown citations, unconfirmed claims, model overrun, provider error, and deterministic fixture success.

**Commit:** `feat: add creative builder AI adapters`

---

### Task 6: Implement authenticated server-authoritative Builder operations

**Objective:** Orchestrate scan/model/persistence work without accepting canonical state from the browser.

**Files:**
- Create: `src/services/creative-builder-server.ts`
- Create: `src/app/api/creative-builder/route.ts`
- Create: `src/app/api/creative-builder/source-asset/route.ts`
- Create: `src/services/creative-builder-server.test.mts`
- Create: `src/services/creative-builder-route.test.mts`

**Operations:**

- `create-and-analyze`: URL only. Authorize, create project, reserve analysis job, scan, call model, atomically commit scan + initial plan.
- `edit-plan`: project ID + expected plan revision + editable patch. Append an unconfirmed plan revision and atomically clear current concept-set, selection, and handoff pointers.
- `confirm-plan`: project ID + expected plan revision. Server records exact assumptions hash, user ID, and timestamp in a new confirmed revision.
- `generate-concepts`: project ID + expected confirmed plan revision. Reserve generation job, load canonical scan/plan, generate, commit concept set.
- `revise`: project ID + one of: expected plan revision for target `plan`, expected concept-set ID for target `portfolio`, or expected concept revision + concept ID for target `concept`; plus one bounded user message. Reserve revision job, load canonical history, call model, and append both turns plus the correct new revision atomically. A plan-targeted revision always creates an unconfirmed plan and clears current concept/selection/handoff pointers.
- `import-source-asset`: project ID + scan ID + candidate ID only; reserve a metered import job before any remote fetch or storage write.
- `select-concept`: project ID + either expected concept-set ID or expected concept-revision ID + concept handle + ordered imported asset IDs. Atomically append an immutable selection receipt/hash and move `latest_selection_id`; never mutate the concept. Changing any asset creates a new selection ID.
- `read/list`: side-effect free.

**HTTP rules:** same-origin JSON, bounded streaming body, duplicate-field rejection through strict schemas, private no-store headers, auth before pools/scanner/model, sanitized errors, no provider internals.

**Tests:** forged receipt/history/timestamp rejected, target/expected-ID union mismatch, plan edit/chat invalidates confirmation/concept/selection/handoff, old confirmation cannot regenerate or hand off, cross-owner and stale revision denied, replay/idempotency, owner and tenant daily limits, live-job conflict, failure/retry, partial model failure, assistant turn server-authored, and exact public response shape.

**Commit:** `feat: add creative builder orchestration API`

---

### Task 7: Add generic customer-specific static scenes

**Objective:** Render selected concepts without using EIC-hardcoded offer templates.

**Files:**
- Create: `src/lib/creative-studio/generated-renderer.ts`
- Modify: `src/lib/creative-studio/model.ts`
- Modify: `src/lib/creative-studio/render.ts`
- Create: `src/services/creative-studio-generated-renderer.test.mts`
- Modify: relevant Creative Studio snapshot/compatibility tests

**Static families:** receipt, text thread, founder note, editorial headline, process tracker, comment/Q&A, math/economic case, comparison, problem/solution typography, proof card.

**Requirements:**

- Additive `generated-native-v1` scene contract.
- Customer-specific brand/copy fields, structured confirmed claims, illustrative labels, and optional trusted source-asset data URI.
- Escape all model/user text.
- No remote resource in HTML.
- 1:1, 4:5, and 9:16 safe-zone support.
- Legacy Scene/Brief parsing and rendering unchanged.
- Additive provenance mode: legacy EIC briefs retain their exact required sources; generated briefs reference Builder scan/plan/concept/asset receipts without falsely claiming EIC-specific sources.
- Generated scenes bypass legacy Action-only restrictions only through explicit validated rules.
- Confirmed price/percentage/comparison claims validate through structured receipts, not blanket browser flags.

**Tests:** each family at copy maxima in all ratios, HTML escaping, overflow/QA fixtures, untrusted data URI, remote URL absence, unsupported video, internal funnel label rejection, and legacy snapshots.

**Commit:** `feat: render generated creative concepts`

---

### Task 8: Add a trusted Builder-to-Studio handoff

**Objective:** Convert one canonical selected concept revision into immutable Creative Studio artwork.

**Files:**
- Create: `supabase/creative_studio_builder_handoff.sql`
- Create: `scripts/test-creative-studio-builder-handoff-postgres.sh`
- Create: `src/services/creative-builder-studio-handoff.ts`
- Create: `src/services/creative-builder-studio-handoff.test.mts`
- Modify: `src/services/creative-studio-repository.ts` for the owner-scoped idempotent handoff RPC
- Modify: `src/services/creative-studio-hosted.ts` only where generic scene support requires it
- Modify: `src/services/creative-studio.ts` only for local/integration parity

**Requirements:**

- Browser submits only Builder project ID + expected immutable selection ID.
- Server loads that exact selection receipt, its canonical confirmed plan, referenced concept-set/concept revision, claim receipts, and imported assets.
- Server maps to `Brief`, `Scene`, source snapshot, and three Meta recipes.
- The migration adds an owner-scoped unique handoff key derived from Builder project + immutable selection ID + selection content hash. A dedicated trusted RPC acquires that key, creates the Studio project/version, records the handoff, and links the Builder project in the same PostgreSQL transaction.
- A replay returns the existing Studio project/version. After an ambiguous network response, repository reconciliation reads by owner + handoff key instead of calling ordinary `create_artwork` again.
- The handoff wrapper invokes the existing Studio creation logic and preserves its owner checks, immutable version/recipe writes, and size validation. It does not expose generic direct table mutation.
- No direct Builder path can mark exports reviewed/approved.

**Tests:** cross-owner IDs, stale selection, unconfirmed plan/claims, missing asset, duplicate retry, forced connection loss immediately after database commit followed by owner-key reconciliation, exact source snapshot, immutable HTML/hash, selection with asset A then new selection with asset B produces a distinct Studio version, exact retry of either selection returns its original Studio version, role grants, and no publishing code.

**Commit:** `feat: hand creative concepts to studio rendering`

---

### Task 9: Build the URL-first Builder UI

**Objective:** Replace the primary abstract style chooser with the approved planning workflow while preserving access to legacy saved Studio projects.

**Files:**
- Create: `src/components/creative-studio/UrlCreativeBuilder.tsx`
- Create: `src/components/creative-studio/ConceptPreview.tsx`
- Modify: `src/app/dashboard/eicagency/creative-builder/page.tsx`
- Preserve: `src/app/dashboard/eicagency/creative-studio/page.tsx` as the legacy Studio route
- Modify: `src/components/creative-studio/CreativeStudio.tsx`
- Modify: `src/components/creative-studio/studio.css`
- Create: `src/services/creative-builder-ui.test.mts`

**UI:**

1. Prominent landing-page URL field.
2. Source-backed assumptions screen, clearly separating page observations from recommendations.
3. Editable audience, awareness, funnel stage, objective, message, CTA, claims, channels, and image selection.
4. Explicit confirmation.
5. Six complete concept cards with real copy/headline/CTA, visual preview, audience/stage, rationale, evidence, and claim warnings.
6. Concept selection and source-image import.
7. “Apply to artwork” handoff to existing export/review UI.
8. Publishing remains visibly unavailable.

**Requirements:** accessible labels/focus/live regions, retry states, conflict refresh, cost-limit messaging, and no client-side canonical history. Keep legacy IdeaBuilder available only for existing legacy projects or an explicitly labeled legacy editor.

**Commit:** `feat: add URL first creative builder UI`

---

### Task 10: Add conversational refinement and history UI

**Objective:** Let users revise plans and concepts naturally while preserving server-authored history.

**Files:**
- Modify: `src/components/creative-studio/UrlCreativeBuilder.tsx`
- Modify: `src/components/creative-studio/ConceptPreview.tsx`
- Modify: `src/components/creative-studio/studio.css`
- Modify: `src/services/creative-builder-ui.test.mts`

**Requirements:**

- User can target plan, portfolio, or one concept.
- Client sends only one new user message and expected revision ID.
- UI displays canonical messages returned by server.
- Examples: shorten headline, use imported image, combine one concept’s copy with another’s design, change audience stage.
- Prior revisions remain inspectable and restorable through a new append-only revision, never mutation.
- Disable duplicate submissions while pending; handle stale revision and usage-limit errors accessibly.

**Commit:** `feat: add conversational creative refinement`

---

### Task 11: Add owner-authorized deletion and bounded retention

**Objective:** Ensure scans, messages, receipts, thumbnails, and private source assets have an explicit lifecycle without weakening owner isolation or Studio immutability.

**Files:**
- Modify: `supabase/creative_builder.sql`
- Create: `src/services/creative-builder-cleanup.ts`
- Create: `src/services/creative-builder-cleanup.test.mts`
- Create: `src/app/api/internal/creative-builder-cleanup/route.ts`
- Modify: `src/app/api/creative-builder/route.ts`
- Modify: `src/components/creative-studio/UrlCreativeBuilder.tsx`

**Rules:**

- Active Builder projects are retained until owner deletion. Unconfirmed abandoned drafts become cleanup-eligible after 30 days. Minimal tombstones and usage/audit aggregates retain no page text, messages, URLs, image keys, or model output and expire after 30 additional days.
- `delete-project` is owner-authorized and transactional: tombstone the project, revoke all public reads/previews, cancel unstarted jobs, and enqueue every private thumbnail/source object for cleanup. Linked immutable Creative Studio artwork is not silently deleted; the UI explains that it remains under Studio’s separate lifecycle.
- Storage deletion is idempotent and retried by a secret-protected internal maintenance route. Database content is hard-deleted only after object cleanup succeeds or an explicitly recorded not-found result. Read/list RPCs never perform cleanup.
- Cleanup jobs use lease/fencing rules, bounded batches, sanitized logs, and exact owner/object receipts. No object key is accepted from a browser.

**Tests:** cross-owner deletion denied, immediate post-tombstone read/preview denial, active-job conflict, unstarted-job cancellation, object deletion retry, not-found idempotency, database failure after object deletion, exact retention boundaries, concurrent cleanup workers, linked Studio preservation, and eventual removal of page text/messages/URLs/object keys.

**Commit:** `feat: add creative builder data lifecycle`

---

### Task 12: Run full verification

**Objective:** Prove security, compatibility, rendering, and build quality.

**Commands:**

```bash
bash scripts/test-creative-builder-postgres.sh
node --conditions=react-server --no-warnings --experimental-strip-types --test src/services/creative-builder*.test.mts src/services/creative-studio*.test.mts
npx tsc --noEmit
npx eslint <every modified production TypeScript/TSX file>
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" npm run build
```

Also run full `npm run lint` and compare with the recorded `origin/main` baseline. Current main has unrelated pre-existing lint errors, so this PR must introduce zero new lint errors without broad cleanup.

**Manual/security verification:**

- Unsafe URL matrix.
- Prompt-injection page.
- Browser receipt/history/confirmation forgery attempts.
- Two owners and cross-owner IDs.
- Concurrent owner and tenant job reservations at daily/concurrency caps.
- Stale lease, live model deadline, fencing-token rejection, and idempotent retry.
- Plan edit/chat invalidates prior confirmation and concepts until reconfirmed.
- Candidate thumbnails are owner-protected and reveal no remote URL/object key.
- Owner deletion immediately revokes reads, retries storage cleanup, removes Builder content, and preserves separately linked Studio artwork.
- Three actual PNG dimensions and safe zones.
- Page image bytes are private, normalized, hashed, and embedded, with no remote URLs.
- Existing Creative Studio project reopen/export/approval path.
- Search source for secrets, remote recipe URLs, ad-platform mutations, and unsafe model/user HTML.

**Commit:** `test: verify URL creative builder workflow`

---

### Task 13: Open a protected PR and provide executable evidence

**Objective:** Deliver a reviewable artifact without production mutation or merge.

**Requirements:**

- Validate `supabase/creative_builder.sql` in a disposable local PostgreSQL instance.
- Exercise the complete flow locally against the disposable schema and test provider fixtures. If a non-production Supabase/Vercel environment is available, run the same authenticated path there.
- Do not apply the migration to production or enable the production flag.
- Record commit SHA, commands, results, screenshots, exported files/dimensions, known limitations, and whether the external preview has a non-production database.
- Push `feat/creative-builder-url-planner` and open a PR against `main`.
- PR must state that video, AI imagery, Google outputs, and ad-platform publishing are excluded.
- Dustin alone decides whether to apply the migration, merge, or launch.

**Stop condition:** verified code, local/disposable-database execution evidence, and protected PR. No production launch.
