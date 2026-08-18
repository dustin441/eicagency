# EIC Agency Findability Acceleration Phase 2

**Baseline:** ClickUp task `86b716jx6`, the August 18, 2026 release annotations, and live `https://eic.agency` before phase 2 changes.
**Production branch:** `marketing-production` at `0e11c2257796bf850a2ff52db6138ef15a235211`.
**Phase 2 branch:** `seo/findability-acceleration-phase-2-20260818`.

## Guardrail

The August 18 released page copy was treated as frozen. The implementation does not rewrite released article or commercial-page copy. Rendered `.resource-body` hashes are unchanged for 64 of 67 resources. The only three body differences are objective link corrections documented below.

## Live crawl baseline

The crawl combined the canonical sitemap with every internal URL discoverable from the public homepage.

- Sitemap: HTTP 200, `application/xml`, 79 canonical URLs.
- Public crawl: 84 internally discoverable URLs reached a final HTTP 200 response.
- Sitemap pages: 79 of 79 HTTP 200, exact self-canonical, exactly one H1, and parseable JSON-LD.
- Sitemap reachability: all 79 URLs reachable from the homepage; 12 at depth 1 and 66 at depth 2.
- No true sitemap orphan pages.
- No sitemap page had `noindex`, an incorrect canonical, missing schema, or an H1-count error.
- Robots: HTTP 200 `text/plain`, with the canonical sitemap directive and private application-route exclusions.

### Internal-link distribution

Before phase 2:

- 30 sitemap pages had only one internal inlink.
- 33 sitemap pages had no more than two internal inlinks.
- Several resources received 12–15 inlinks while 30 received only the archive link.
- The concentration came from the related-resource fallback repeatedly selecting the first entries in each topic cluster.
- All 67 resources were present in the complete Resources archive, but each visible topic section exposed only its first three resources and had no dedicated crawlable topic destination.

The repeated global anchors are intentional navigation and conversion anchors. Resource-specific anchors are descriptive article titles. Image/logo links account for most crawler-observed empty text anchors and have accessible image alternative text or an `aria-label`; they are not treated as 84 independent missing-anchor defects.

### Objective internal-link errors

Three live body links were objectively incorrect:

1. `/resources/produce-effective-digital-advertising-creative` linked to `/content-funnel-download`, which fell through `/login` to the analytics login experience.
2. `/resources/eic-agency-calculating-profitable-roi` linked to `/roi-calculator`, which fell through `/login` to the analytics login experience.
3. `/resources/why-run-digital-ads` linked to the legacy `/schedule-demo`, adding an unnecessary redirect before `/eic-schedule-demo`.

Other redirects discovered from global/application links were expected: public Client Login and Forgot Password links move to `analytics.eic.agency`. They were not changed.

## Commercial query cannibalization

The latest complete Search Console query/page export exposed eight queries with impressions on more than one canonicalized URL. The meaningful groups were overwhelmingly legacy consolidation rather than competing current commercial pages:

- `eic agency`: 266 impressions across the homepage plus historical `/home`, About, Contact, FAQ, schedule, resource, and legacy post URLs.
- `eic.agency`: 57 impressions across the same legacy/current brand set.
- `eic marketing`: 22 impressions, led by the homepage.
- `eic.agency owner`: 16 impressions split evenly between current and legacy About URLs.
- `bot advertising`: 7 impressions split between the legacy `/post/` URL and its current `/resources/` equivalent.

No current query/page group demonstrated multiple live commercial service pages competing for the same qualified white-label paid-media intent. The August 18 decision to keep one substantive `/white-label-ppc-management` page rather than create thin Google, Meta, or reporting doorway pages remains supported.

The residual brand and old/current splits should be monitored as Google recrawls the already-correct redirect map. They are not a reason to rewrite the newly released pages.

## Implemented improvements

1. Added five crawlable, canonical topic hubs under `/resources/topics/*`:
   - Agency Growth and Paid Media Fulfillment
   - Reporting, Attribution, and Traffic Quality
   - Creative Production and Testing
   - B2B Paid Media Execution
   - AI, Automation, and Agency Operations
2. Added all five hubs to the sitemap.
3. Added descriptive “Browse all … resources” links from the Resources index to each topic hub.
4. Added a visible topic link and a topic level in BreadcrumbList schema on all 67 resources.
5. Increased related resources from two to three and reserved one slot for a balanced neighboring resource, preventing the same early cluster entries from accumulating nearly all template-generated links.
6. Added CollectionPage, ItemList, and BreadcrumbList schema to each topic hub.
7. Corrected the three objective internal-link errors without changing article claims or substantive copy.

## Post-change QA

- Production build passed; 147 static pages generated, including five topic hubs.
- TypeScript passed.
- Changed-file ESLint: 0 errors; three existing `<img>` optimization warnings.
- Full-repository ESLint was run: 11 errors and 79 warnings remain in unrelated pre-existing files; changed files add no errors.
- Local sitemap: 84 URLs, including all five new topic hubs.
- 84 of 84 sitemap URLs: HTTP 200, one H1, exact canonical, and parseable JSON-LD.
- All sitemap pages remain reachable within two clicks of the homepage.
- All 67 resources now have at least three internal inlinks.
- Resource inlink median increased from 3 before phase 2 to 6 after phase 2.
- Maximum resource inlinks decreased from 15 to 14 as distribution became less concentrated.
- Internal target checks: 0 broken.
- Objective broken/redirecting source links: all three corrected.
- Rendered resource body hashes: 64 of 67 unchanged; only the three documented link corrections differ.
- Desktop and 390px mobile visual QA: no horizontal overflow, clipping, overlap, or broken card/topic navigation.

## Reproducible artifacts

- Live crawl: `/opt/data/reports/eicagency-findability-phase2-live-crawl-2026-08-18.json`
- Cannibalization analysis: `/opt/data/reports/eicagency-findability-phase2-cannibalization-2026-08-18.json`
- Local 84-route QA: `/opt/data/reports/eicagency-findability-phase2-local-qa-2026-08-18.json`
- Body-hash guardrail QA: `/opt/data/reports/eicagency-findability-phase2-body-hash-qa-2026-08-18.json`
- Visual QA: `/opt/data/reports/eicagency-findability-phase2-visual-qa-2026-08-18.json`

## Authority, citation, and backlink opportunities

These are separate from the on-site implementation because they require account ownership, eligibility confirmation, editorial acceptance, partner/client consent, or approved outreach.

### Priority 1: correct and consolidate existing entity citations

1. **Google Business Profile, conditional:** Google requires in-person customer contact and excludes online-only businesses. Claim or update a profile only if EIC has a staffed client-facing location or travels to clients. Never propagate a mailbox, virtual office, or unverified historical Tempe address. If eligible, align the official name, website, phone, address or service area, category, description, and social links. Sources: [Google eligibility guidance](https://support.google.com/business/answer/13763036?hl=en) and [Business Profile editing guidance](https://support.google.com/business/answer/3039617?hl=en).
2. **LinkedIn company page:** the indexed profile still describes EIC as a generic full-service agency focused on brand identity, content production, distribution, and measurement. Update it to the current white-label paid media positioning and verify the website URL, company size, location, and founding details. Existing page: [EIC Agency on LinkedIn](https://www.linkedin.com/company/every-impression-counts).
3. **Alignable:** the existing result uses the older “full service digital agency” description. Claim and update rather than create a duplicate. Existing page: [Every Impression Counts LLC on Alignable](https://www.alignable.com/tempe-az/every-impression-counts-llc).
4. **Yelp:** an indexed EIC Agency listing exists with Tempe address, phone, and broad Marketing/Web Design/Video categories. Verify current NAP and categories before editing. Existing page: [EIC Agency on Yelp](https://m.yelp.com/biz/eic-agency-tempe).
5. **VoyagePhoenix:** the existing founder feature is a legitimate earned mention, but its description reflects the former direct full-service model. Preserve the mention and request a factual positioning/site-link update only if the publisher accepts corrections. Existing feature: [Meet Dustin Trout of EIC Agency](https://voyagephoenix.com/interview/meet-dustin-trout-eic-agency-tempe).
6. **Apple Business:** Apple explicitly supports virtual, online, and service businesses without a physical location, making this the safest additional entity profile if EIC is remote or service-area based. Source: [Apple Business Connect expansion](https://www.apple.com/newsroom/2024/10/apple-expands-tools-to-help-businesses-connect-with-customers/).

Use one approved entity record before touching any profile: legal name, public brand name, canonical URL, primary category, one-sentence description, long description, phone, address/service-area decision, logo, and approved social URLs. Do not create duplicate profiles to work around inaccessible old ones.

### Priority 2: high-fit directories and platform credentials

| Opportunity | Evidence and fit | Recommended asset/action |
| --- | --- | --- |
| [Clutch](https://clutch.co/get-listed) | Clutch states that B2B advertising and marketing service providers can create a free profile, which is manually reviewed, and then collect client reviews. | Create or claim one profile under the current white-label paid media positioning. Lead with verified agency-partner reviews and the three published case studies, not generic claims. |
| [HubSpot Solutions Directory](https://knowledge.hubspot.com/partner-tools/create-and-add-your-partner-profile-to-the-solutions-directory) | HubSpot allows Solutions Partners or Inbound Certified agencies to publish profiles. This is a strong fit for EIC's CRM-to-paid-media reporting and closed-loop measurement story. | Confirm certification eligibility, then position EIC as paid-media execution and reporting support for HubSpot agencies. Use an approved B2B workflow case, not an unsupported platform-partner claim. |
| [Agency Spotter](https://www.agencyspotter.com/about) | Agency Spotter covers advertising, digital marketing, media buying, paid search, and paid social. It says agencies with at least two dedicated full-time employees can claim or request a profile. | Confirm employee eligibility, then add or claim EIC and use paid search, paid social, media buying, analytics, and white-label delivery as the service taxonomy. |
| [Tempe Chamber member directory](https://business.tempechamber.org/member-directory) | The live directory has Advertising & Media and Marketing categories and gives members a local business citation with website details. | Confirm membership economics and current public address policy before joining. If approved, use the same entity record as Google Business Profile. |
| [DesignRush agency directory](https://www.designrush.com/agency/ad-agencies) | DesignRush maintains verified advertising/PPC agency profiles and already publishes a Tempe digital-marketing category. Visibility can include paid placements, so it should not outrank free/verified sources. | Check whether EIC already has an unclaimed profile. Claim or submit only one profile, disclose sponsorship if paid, and measure referral quality before renewing. |
| [Google Partners directory](https://support.google.com/google-ads/answer/11410677?hl=en) | Google states that Partner or Premier Partner status plus public opt-in produces a directory page with company name, website, region, and certification areas. | Check EIC’s manager account for current Performance, Spend, and Certifications eligibility. Opt in only if status is active; never imply Partner status before verification. |
| [Microsoft Advertising Partner Program](https://about.ads.microsoft.com/en/resources/partners-agencies/agency-center) | Microsoft operates an official agency program tied to manager-account history and eligibility. It can strengthen EIC's authority beyond Google-only execution. | Verify current account history, spend, and eligibility before using any partner designation. Build a Microsoft Ads case only from approved evidence. |
| [Meta Business Partners](https://www.facebook.com/business/marketing-partners) | Meta offers member and badged partner tiers. Its official page distinguishes members from badged official partners. | Check the existing Meta business account for program eligibility. Use the correct tier language and badge only after Meta grants it. |

### Priority 3: earned editorial and podcast authority

1. **Databox contributor research:** Databox explicitly accepts guest authorship, research contributions, and expert sessions, with data-backed articles and contextual source links. Pitch the reporting benchmark or participate first in a relevant research survey. Source: [Databox contribution guidance](https://help.databox.com/contribute-a-guest-post-link-placement-or-research-quote-to-the-databox-blog).
2. **PPC Hero authorship:** PPC Hero has an explicit author application covering paid search, paid social, programmatic, and CRO. Pitch a practitioner article on using sales feedback as Google and Meta optimization signals, including failure cases and sanitized examples. Source: [Become a PPC Hero author](https://ppchero.com/become-a-ppc-hero-author).
3. **Build a Better Agency podcast:** its audience is explicitly agency owners, and the show says prospective guests can email the host. Pitch a teaching-first episode such as “How agencies add paid media without giving away the client relationship” using EIC’s ownership matrix, readiness review, and reporting model. Source: [Build a Better Agency](https://agencymanagementinstitute.com/agency-owner-podcast).
4. **Smart Agency Masterclass:** the show covers scaling agencies and explicitly invites guest applications. Pitch a narrowly evidenced operating lesson, not a company overview. Source: [Smart Agency Masterclass](https://www.agencymastery360.com/podcast).
5. **Original benchmark asset:** publish a transparent, anonymized Agency Paid Media Operations and Reporting Benchmark from consenting EIC accounts or agency-partner surveys. Compare offline-conversion adoption, qualified-lead lag, reporting cadence, tracking gaps, sales-feedback loops, and creative constraints. Publish methodology, sample size, exclusions, median versus mean, and uncertainty. This gives journalists, podcasts, clients, and partner agencies something citable rather than another opinion article.
6. **Co-published agency-partner case studies:** with written consent, create a partner-facing version of an existing case study that documents ownership boundaries, delivery workflow, reporting, and measured outcome. Give the partner a neutral summary they can publish on its own site with a canonical link to the complete study. Do not manufacture reciprocal links or require exact-match anchors.
7. **Expert contribution path:** Search Engine Land states that contributors are invited and selected for expertise. Treat it as a relationship target after publishing original data and earning smaller agency-trade appearances, not as a cold guest-post target. Source: [Search Engine Land contributor disclosure](https://searchengineland.com/the-search-everywhere-optimization-pyramid-how-to-build-visibility-before-search-478253).

### Evidence and outreach rules

- Prefer verified profiles, primary-source directories, editorial interviews, and partner/client evidence over bulk directory submissions.
- Use branded or natural anchors. Do not buy followed links, exchange links at scale, or submit spun guest posts.
- Make every statistic traceable to a source or documented EIC methodology.
- Obtain client and agency-partner approval before naming them, publishing results, or asking for a co-published story.
- Track each opportunity by owner, URL, submission date, approval state, live URL, referral sessions, qualified conversations, and assisted conversions.
