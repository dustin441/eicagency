import type { ResourceSeoOverride } from './resource-seo';

const updatedAt = '2026-08-18T18:00:00.000Z';

export const resourceSprint20260818Overrides: Record<string, ResourceSeoOverride> = {
  'understanding-digital-audience-targeting': {
    title: 'Digital Audience Targeting: A Practical Paid Media Guide',
    seoTitle: 'Digital Audience Targeting: Paid Media Guide',
    description:
      'Learn how digital audience targeting uses customer definitions, search and social signals, first-party data, exclusions, creative, and outcome measurement.',
    updatedAt: '2026-09-04T17:00:00.000Z',
    primaryQuery: 'digital audience targeting',
    cluster: 'b2b-paid-media-execution',
    youtubeId: 'e9mWw-85ViA',
    relatedSlugs: ['eic-b2b-audience-targeting', 'keith-delaney-primer', 'b2b-retargeting-EIC'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Digital audience targeting is the process of deciding who a paid media campaign should reach, which signals can identify that audience, and which groups should be excluded.</strong> It applies across consumer, local-service, ecommerce, and business campaigns. The platform setting is only the activation layer; effective targeting starts with a useful customer definition and ends with evidence from the site, CRM, and sales process.</p>
<p>The objective is not the smallest possible audience. It is an audience that is relevant enough to support the offer, large enough to deliver, and measurable enough to improve. Teams that specifically need account, firmographic, job-role, or cross-platform business-audience data should use the separate <a href="/resources/eic-b2b-audience-targeting">B2B audience targeting platform guide</a>.</p>
<h2>Start with the buyer and business problem</h2>
<p>Document the customer before opening an ad platform. Define the industries, locations, use cases, buying roles, needs, disqualifiers, and sales conditions that matter. Separate the person who experiences the problem from the person who approves the purchase when they are not the same.</p>
<p>A targeting brief should answer:</p>
<ul>
<li>Which problem or opportunity is the campaign addressing?</li>
<li>Who recognizes the problem, researches options, influences the decision, and approves the purchase?</li>
<li>What evidence makes an account a plausible fit?</li>
<li>Which customers, employees, locations, or poor-fit segments should be excluded?</li>
<li>What does the next useful action look like?</li>
</ul>
<h2>Choose signals that match the buying context</h2>
<p>Search terms can reveal active demand. Professional attributes can help reach defined business roles. Interests and content behavior can support broader education. CRM lists can reconnect campaigns with known customers, prospects, or excluded groups. Website audiences can sequence messages based on observed behavior.</p>
<p>Each signal has limits. A job title can be incomplete, an interest can be broad, and a lookalike can reproduce weaknesses in its source list. Agencies should explain what a signal suggests without presenting it as verified identity or purchase intent.</p>
<h2>Use exclusions as part of the strategy</h2>
<p>Exclusions protect budget and reporting quality. Depending on the campaign, exclude current customers, employees, vendors, existing opportunities, unsupported geographies, irrelevant searches, and recent converters. Review exclusions with the client because an aggressive rule can remove legitimate buyers.</p>
<h2>Match the message to audience temperature</h2>
<p>A cold audience usually needs problem recognition, education, and credible proof. A returning visitor may need implementation details, comparison information, or a clear next step. A high-intent searcher should land on the closest relevant service or solution page rather than a generic article.</p>
<p>Build several message pillars so the same audience does not see one claim repeatedly. Separate educational, proof, process, objection, and direct-response creative. This gives the agency a clearer view of what earns attention and what advances intent.</p>
<h2>Measure targeting beyond platform clicks</h2>
<p>Review delivery, qualified onsite behavior, lead validity, sales acceptance, opportunities, and revenue as separate layers. A low-cost audience that produces weak engagement or invalid leads is not efficient. A higher-cost audience may be useful when it produces stronger downstream outcomes.</p>
<p>Use complete periods and record targeting changes. Do not compare two audiences as if they were controlled tests when budgets, creative, offers, or landing pages changed at the same time.</p>
<h2>When a B2B audience targeting platform is the better next step</h2>
<p>This guide covers the general campaign discipline: customer definition, signal selection, exclusions, message fit, and outcome measurement. A dedicated B2B audience targeting platform becomes relevant when a campaign also needs company attributes, account lists, buying roles, technology data, or consistent business-audience activation across multiple ad platforms.</p>
<p>Do not treat those tools as a shortcut around the fundamentals. Review coverage, data freshness, privacy controls, match methods, minimum audience sizes, and downstream lead quality before shifting budget. See the <a href="/resources/eic-b2b-audience-targeting">B2B audience targeting platform comparison and agency QA framework</a> for that decision.</p>
<h2>A practical agency QA checklist</h2>
<ul>
<li>Customer definition and exclusions are approved.</li>
<li>Audience size and channel fit are plausible for the budget.</li>
<li>Creative addresses the audience's problem and stage.</li>
<li>Landing pages continue the same promise.</li>
<li>Consent, list use, and platform policies are respected.</li>
<li>CRM feedback can distinguish valid from poor-fit outcomes.</li>
<li>Changes are annotated before performance is compared.</li>
</ul>
<p>Continue with the <a href="/resources/eic-b2b-audience-targeting">B2B audience targeting platform guide</a>, review <a href="/resources/keith-delaney-primer">first-party audience strategy</a>, or see what EIC handles through <a href="/white-label-ppc-management">white-label paid media fulfillment</a>.</p>
</div>`,
  },
  'what-is-omnichannel-marketing': {
    title: 'What Is Omnichannel Marketing? An Agency Framework',
    seoTitle: 'What Is Omnichannel Marketing? Agency Guide',
    description:
      'Omnichannel marketing connects search, social, content, email, CRM, and sales around one buyer journey. Learn how agencies plan and measure it.',
    updatedAt,
    primaryQuery: 'what is omnichannel marketing',
    cluster: 'b2b-paid-media-execution',
    relatedSlugs: ['b2b-advertising-strategy-10x', 'eic-search-to-social-playbook', 'eic-marketing-channels-ad-attribution'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Omnichannel marketing coordinates messages, experiences, and measurement across the channels a buyer uses before, during, and after a purchase.</strong> The goal is not to place the same ad everywhere. It is to give each channel a clear role while preserving a coherent customer journey.</p>
<p>For agencies, omnichannel execution requires shared audience definitions, message planning, landing experiences, CRM stages, and reporting. Buying media on several platforms without that coordination is multichannel activity, not an omnichannel system.</p>
<h2>Omnichannel versus multichannel marketing</h2>
<p>A multichannel plan uses more than one channel. Search, social, email, and content may each run successfully but operate with separate goals and reporting. An omnichannel plan connects those activities around the same buyer, business objective, and next step.</p>
<p>The distinction matters because buyers rarely follow a straight path. Someone may first see a social ad, search the brand later, read a case study, return through email, and then speak with sales. No single platform view describes the complete journey.</p>
<h2>Assign every channel a job</h2>
<ul>
<li><strong>Paid search:</strong> capture declared problems, categories, and high-intent comparisons.</li>
<li><strong>Paid social and video:</strong> build familiarity, distribute useful ideas, and show varied proof.</li>
<li><strong>Organic content:</strong> answer durable questions and support deeper evaluation.</li>
<li><strong>Email and CRM:</strong> continue the conversation with known contacts and record lifecycle movement.</li>
<li><strong>Retargeting:</strong> sequence proof and objections based on demonstrated interest.</li>
<li><strong>Sales:</strong> validate fit, capture objections, and report opportunity outcomes.</li>
</ul>
<p>Channel roles should follow the audience, offer, and buying process. A plan does not become omnichannel merely because every available platform receives budget.</p>
<h2>Build a shared message system</h2>
<p>Create a message map that covers problem recognition, education, proof, implementation, risk, and action. Then adapt those ideas to each channel's format and audience context. The language can change while the underlying promise remains consistent.</p>
<p>Use destination pages that match the message. A broad educational ad should not force an immediate sales pitch, and a high-intent service search should not land on an unrelated podcast article.</p>
<h2>Connect identity and measurement carefully</h2>
<p>Use approved UTM parameters, platform click identifiers, CRM fields, and first-party events to preserve source context where practical. Keep platform-attributed outcomes separate from CRM-confirmed leads, opportunities, and revenue. Reconcile the systems instead of promising a perfect match.</p>
<p>Privacy choices, cross-device behavior, offline conversations, and untagged return visits mean attribution will remain incomplete. Agencies should explain confidence and alternative causes rather than assign every result to the last visible click.</p>
<h2>Use stage-specific success metrics</h2>
<ul>
<li>Qualified attention: engaged visits, useful content consumption, and repeat sessions.</li>
<li>Evaluation: case-study views, service-page visits, return behavior, and demo-page interest.</li>
<li>Conversion: completed forms or bookings that pass validation.</li>
<li>Business outcomes: sales acceptance, opportunities, customers, revenue, and margin where available.</li>
</ul>
<p>A 30-second engaged visit can be a valid stage event without being labeled a lead. Keeping stages distinct makes optimization and client reporting more credible.</p>
<h2>How agencies should launch an omnichannel test</h2>
<ol>
<li>Choose one audience, business objective, and offer.</li>
<li>Map the journey and assign each channel a role.</li>
<li>Create a bounded set of messages and proof.</li>
<li>Verify landing pages, tracking, CRM stages, and follow-up.</li>
<li>Launch with enough budget for each test cell to produce evidence.</li>
<li>Review complete periods and annotate material changes.</li>
<li>Scale only the combinations that contribute useful business signals.</li>
</ol>
<p>Explore the <a href="/resources/b2b-advertising-strategy-10x">B2B omnichannel paid media playbook</a>, continue with the <a href="/resources/eic-search-to-social-playbook">search-to-social framework</a>, or review EIC's <a href="/white-label-ppc-management">white-label delivery model</a>.</p>
</div>`,
  },
  'b2b-lead-gen-data-enrichment-ICP': {
    title: 'B2B Data Enrichment for Better ICP Definition',
    seoTitle: 'B2B Data Enrichment for a Better ICP',
    description:
      'Learn how agencies use B2B data enrichment to clarify an ICP, improve audience strategy, validate leads, and protect reporting quality.',
    updatedAt,
    primaryQuery: 'B2B data enrichment for ICP definition',
    cluster: 'ai-automation-and-agency-operations',
    youtubeId: 'BWjCL8E6i_M',
    relatedSlugs: ['eic-lead-scoring-b2b-advertising', 'b2b-lead-gen-marketing-from-your-CRM', 'eic-b2b-audience-targeting'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>B2B data enrichment adds approved company or contact attributes to an existing record so a team can understand fit, route work, and measure outcomes more consistently.</strong> It can support ICP definition, audience creation, lead validation, and sales prioritization. It cannot determine purchase intent or lead quality by itself.</p>
<p>For agencies, the safest approach is to start with a specific decision, enrich only the fields needed for that decision, and compare the output with the client's source systems.</p>
<h2>Define the ICP before enriching records</h2>
<p>An ideal customer profile describes the account characteristics that make a company more likely to benefit from the offer and become a viable customer. Useful criteria may include industry, geography, company size, business model, technology, operating need, buying process, and explicit exclusions.</p>
<p>Do not confuse the ICP with a list of every firmographic field a provider offers. Start with client evidence: current customers, profitable segments, sales objections, lost opportunities, retention patterns, and operational capacity.</p>
<h2>Choose fields tied to an action</h2>
<p>Every enriched field should support a decision. Examples include:</p>
<ul>
<li>Industry and company size for routing and segment analysis</li>
<li>Headquarters or service location for territory fit</li>
<li>Technology signals for integration relevance</li>
<li>Role and department for buying-committee context</li>
<li>Domain and company identity for deduplication</li>
<li>Customer or opportunity status for suppression and measurement</li>
</ul>
<p>Avoid collecting sensitive or unnecessary information merely because it is available. Document the source, permitted use, refresh cadence, and retention policy.</p>
<h2>Validate match quality</h2>
<p>Enrichment providers can return stale, ambiguous, or incorrectly matched records. Test a representative sample before using the data in campaigns or lead scores. Review company identity, domain, location, role, and timestamp. Keep unmatched and low-confidence records separate from verified records.</p>
<p>Do not silently overwrite client-entered or CRM-owned values. Store provenance and confidence where possible so the team can resolve conflicts.</p>
<h2>Use enrichment in paid media carefully</h2>
<p>Enriched attributes can help build account lists, segment messages, create exclusions, and analyze outcomes. The activated audience still needs sufficient size, relevant creative, a clear offer, and lawful platform use. A narrow list is not automatically a better audience.</p>
<p>Suppress customers, employees, unsupported markets, and existing opportunities when the campaign calls for it. Review each exclusion with the client before launch.</p>
<h2>Connect enrichment with lead scoring</h2>
<p>Separate fit from behavior. Firmographic fit may indicate that an account resembles the approved ICP. Behavioral signals may indicate engagement or intent. Sales validation confirms whether the inquiry is real and worth pursuing. A useful model keeps those dimensions visible instead of blending them into one unexplained score.</p>
<h2>Measure whether enrichment helps</h2>
<p>Compare match rate, manual review time, valid lead rate, sales acceptance, opportunity creation, and downstream outcomes over complete periods. Include the cost of the provider and the work needed to maintain the integration. A higher data-fill rate is not valuable if it does not improve a real workflow or decision.</p>
<h2>Agency implementation checklist</h2>
<ul>
<li>Approved ICP and exclusions are documented.</li>
<li>Each requested field has a business purpose.</li>
<li>Data source, permitted use, and refresh timing are known.</li>
<li>A representative sample has been manually validated.</li>
<li>Source values are preserved rather than silently overwritten.</li>
<li>Lead scoring separates fit, behavior, and sales validation.</li>
<li>Campaign and CRM outcomes can be reconciled.</li>
</ul>
<p>Continue with the <a href="/resources/eic-lead-scoring-b2b-advertising">B2B lead scoring framework</a>, review how to use <a href="/resources/b2b-lead-gen-marketing-from-your-CRM">CRM data in advertising</a>, or see EIC's <a href="/white-label-ppc-management">white-label paid media operating model</a>.</p>
</div>`,
  },
  '5-things-before-running-ads': {
    title: 'Paid Advertising Readiness: 5 Checks Before Launch',
    seoTitle: 'Paid Advertising Readiness Checklist for Agencies',
    description:
      'Use five paid advertising readiness checks for audience, offer, creative, conversion, and measurement before an agency launches media.',
    updatedAt,
    primaryQuery: 'paid advertising readiness checklist',
    cluster: 'agency-growth-and-fulfillment',
    relatedSlugs: ['how-much-to-spend-digial', 'eic-podcast-efficient-advertising-spend-checklist', 'eic-fix-advertising-funnel-increase-revenue'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>A paid advertising campaign is ready to launch when the audience, offer, creative, conversion path, and measurement plan are clear enough to support a fair test.</strong> Media cannot compensate indefinitely for an undefined customer, weak offer, missing follow-up, or unreliable tracking.</p>
<p>For agencies, these five checks create a practical go, revise, or pause decision before client budget enters an auction.</p>
<h2>1. Audience: know who the campaign is for</h2>
<p>Define the customer, problem, buying context, geography, and exclusions. For B2B, distinguish the user, researcher, influencer, and economic buyer. For consumer campaigns, document the need state, eligibility, service area, and purchase conditions.</p>
<p>Confirm that the selected channel can reach the audience at a usable scale. Platform targeting is not a substitute for an approved customer definition.</p>
<h2>2. Offer: give the buyer a credible next step</h2>
<p>The offer should connect the buyer's problem to a specific action. That action may be a purchase, consultation, assessment, demo, guide, or useful resource. State what the person receives and what happens afterward.</p>
<p>Review pricing, eligibility, availability, claims, and terms before launch. Remove promises the business cannot support. A vague “learn more” message can be useful for education, but it should not be treated as a direct-response offer.</p>
<h2>3. Creative: build messages, not decorations</h2>
<p>Create distinct concepts around the problem, outcome, proof, process, objection, and next step. Adapt formats to the channel while keeping the core promise consistent. Use approved source assets and claims.</p>
<p>Plan enough variations to learn without splitting the budget across too many cells. Record the hypothesis for each concept so the review can explain what the team learned.</p>
<h2>4. Conversion and follow-up: verify the complete path</h2>
<p>Test the page, form, calendar, checkout, confirmation, notification, and CRM record from start to finish. Confirm mobile usability, load behavior, field validation, routing, and ownership. Submit real test records and verify that the appropriate person receives them.</p>
<p>Define response expectations with the client. Media success is limited when valid inquiries wait without follow-up or when sales cannot distinguish campaign leads from other sources.</p>
<h2>5. Measurement: agree on stages and decisions</h2>
<p>Document platform events, analytics events, CRM stages, qualified outcomes, revenue fields, and reporting owners. Keep engaged visits, demo-page views, completed forms, qualified leads, opportunities, and customers as separate stages.</p>
<p>Choose decision rules before launch. Define what evidence would support scaling, iterating, holding, or stopping. If historical inputs are missing, label planning values as assumptions and design the first phase to replace them with observed data.</p>
<h2>Agency preflight checklist</h2>
<ul>
<li>Audience and exclusions approved</li>
<li>Offer, claims, pricing, and availability verified</li>
<li>Creative concepts mapped to funnel roles</li>
<li>Landing and follow-up path tested on desktop and mobile</li>
<li>Forms, calendars, checkout, and CRM writes verified</li>
<li>Events and stage definitions documented</li>
<li>Budget supports a bounded test</li>
<li>Client knows what the first reporting period can and cannot prove</li>
</ul>
<h2>When to delay the launch</h2>
<p>Pause when the business cannot fulfill the offer, the conversion path is broken, required claims are unapproved, tracking cannot distinguish outcomes, or the budget is divided too thinly to learn. A short readiness sprint is usually more useful than launching a campaign that cannot answer the client's question.</p>
<p>Review the <a href="/resources/how-much-to-spend-digial">digital advertising budget framework</a>, use the <a href="/resources/eic-podcast-efficient-advertising-spend-checklist">efficient spend checklist</a>, or see how EIC handles <a href="/white-label-ppc-management">paid media delivery behind an agency</a>.</p>
</div>`,
  },
  'eic-roas-vs-revenue': {
    title: 'ROAS vs. Revenue: A Paid Media Reporting Guide',
    seoTitle: 'ROAS vs. Revenue in Paid Media Reporting',
    description:
      'Understand the difference between ROAS and revenue, when each metric helps, and how agencies connect ad-platform reporting to business outcomes.',
    updatedAt,
    primaryQuery: 'ROAS vs revenue',
    cluster: 'reporting-attribution-and-traffic-quality',
    youtubeId: 'gmUyvLZH1IE',
    relatedSlugs: ['eic-agency-calculating-profitable-roi', 'eic-track-b2b-roi-utm-deal', 'b2b-advertising-metrics-that-matter'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Revenue is the money a business records from sales. Return on ad spend, or ROAS, compares attributed revenue with advertising spend.</strong> They answer different questions. Revenue describes business volume, while ROAS describes the relationship between a defined amount of media cost and the revenue assigned to it.</p>
<p>For agencies, neither metric should stand alone. A campaign can show a high platform ROAS on a small amount of spend while contributing little total revenue. A campaign can also contribute substantial revenue while missing the margin or cash-flow requirements needed for profitable growth.</p>
<h2>How ROAS is calculated</h2>
<p>ROAS is commonly calculated as attributed revenue divided by advertising spend. The result depends on the revenue source, attribution window, included campaigns, refunds, taxes, shipping, discounts, and customer type. Two dashboards can show different ROAS values for the same period because their definitions differ.</p>
<p>Document the formula and source before comparing results. Platform-attributed purchase value should not be presented as identical to finance-recorded net revenue.</p>
<h2>Why revenue alone is incomplete</h2>
<p>Revenue does not show media efficiency, gross margin, fulfillment cost, returns, sales labor, or the time required to collect cash. More revenue can still create strain when the business acquires customers above an acceptable cost or sells low-margin products.</p>
<p>Connect revenue with margin and acquisition cost when those inputs are available. For lead generation, connect media to qualified opportunities and closed revenue rather than assigning value to every form submission.</p>
<h2>Use the right revenue source</h2>
<ul>
<li><strong>Ad platform:</strong> useful for optimization, but limited by the platform's attribution model.</li>
<li><strong>Analytics:</strong> useful for site journeys, but affected by consent, identity, and channel rules.</li>
<li><strong>Ecommerce or billing system:</strong> useful for confirmed orders, refunds, and customer value.</li>
<li><strong>CRM:</strong> useful for lead status, opportunities, wins, and sales-cycle context.</li>
<li><strong>Finance system:</strong> useful for recognized revenue and margin definitions.</li>
</ul>
<p>Reconcile the systems and explain differences. Do not force them to match by silently changing dates or attribution rules.</p>
<h2>Separate new and returning customer economics</h2>
<p>When reliable identity is available, distinguish revenue from new customers and existing customers. A campaign that captures repeat purchases may look efficient without creating the same incremental value as new-customer acquisition. Keep the classification method visible and avoid claiming incrementality without a valid test.</p>
<h2>Report a complete performance story</h2>
<p>A useful agency view includes spend, delivery, engaged sessions, conversions, valid leads or orders, attributed revenue, confirmed revenue, ROAS, acquisition cost, and margin where supported. It also records what changed in budget, audience, creative, landing pages, offers, tracking, and sales operations.</p>
<h2>Decision questions for agencies</h2>
<ul>
<li>Is the revenue confirmed, attributed, or modeled?</li>
<li>Which costs are included in the efficiency metric?</li>
<li>Are refunds, cancellations, and duplicate orders removed?</li>
<li>Is the result driven by new customers, returning customers, or both?</li>
<li>Does the business have margin and capacity to scale?</li>
<li>What would happen to total revenue if spend changed materially?</li>
</ul>
<h2>Use both metrics in planning</h2>
<p>Planning should show how different spend levels could affect total revenue, efficiency, and operational capacity without presenting the scenario as a forecast guarantee. Record the assumptions for conversion rate, average order or contract value, close rate, and margin. Replace those assumptions with observed values as the account collects reliable evidence.</p>
<p>Continue with the <a href="/resources/eic-agency-calculating-profitable-roi">profitable ROI framework</a>, review <a href="/resources/eic-track-b2b-roi-utm-deal">UTM and deal attribution</a>, or explore EIC's <a href="/white-label-ppc-management">client-ready reporting and fulfillment model</a>.</p>
</div>`,
  },
  'power-of-retargeting': {
    title: 'Paid Media Retargeting: An Agency Strategy Guide',
    seoTitle: 'Paid Media Retargeting Strategy for Agencies',
    description:
      'Build a retargeting strategy around audience intent, message sequence, exclusions, frequency, privacy, and qualified business outcomes.',
    updatedAt,
    primaryQuery: 'paid media retargeting strategy',
    cluster: 'b2b-paid-media-execution',
    youtubeId: 'P7cSway_5LA',
    relatedSlugs: ['b2b-retargeting-EIC', 'eic-search-to-social-playbook', 'eic-b2b-audience-targeting'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Paid media retargeting reaches people who previously interacted with a website, content, app, video, lead form, or approved customer list.</strong> Its purpose is not to chase every visitor with the same sales ad. A useful strategy sequences information based on demonstrated interest and removes people who should no longer receive the message.</p>
<p>For agencies, retargeting works best as a middle- and lower-funnel system connected to consent, audience rules, message variety, frequency, and CRM outcomes.</p>
<h2>Build audiences around meaningful behavior</h2>
<p>Separate shallow and deep actions. A brief page visit, a multi-page session, a case-study view, a demo-page visit, an abandoned checkout, and an existing opportunity represent different contexts. Combine events only when the message and decision are still relevant.</p>
<p>Use practical windows based on the buying cycle. A short consumer purchase and a complex B2B service evaluation should not automatically use the same audience duration.</p>
<h2>Exclude before you expand</h2>
<p>Exclude completed purchasers, current customers, invalid leads, employees, unsupported locations, active opportunities, or recent converters when the campaign objective calls for it. Coordinate exclusions across platforms and refresh source lists on a reliable schedule.</p>
<p>Exclusions can also be temporary. Someone who booked a call may need a confirmation or preparation message rather than another acquisition ad.</p>
<h2>Sequence messages instead of repeating one CTA</h2>
<ul>
<li><strong>Education:</strong> explain the problem, framework, or buying criteria.</li>
<li><strong>Proof:</strong> show a relevant process, case study, testimonial, or demonstration.</li>
<li><strong>Objection:</strong> address implementation, risk, timing, ownership, or fit.</li>
<li><strong>Evaluation:</strong> show service details, reporting, pricing context, or next steps.</li>
<li><strong>Action:</strong> invite the appropriate purchase, booking, assessment, or return.</li>
</ul>
<p>Rotate concepts according to audience size and delivery. Frequency is a diagnostic, not one universal cutoff. Review response, qualified onsite behavior, and downstream outcomes alongside exposure.</p>
<h2>Respect privacy and platform rules</h2>
<p>Use only approved data and permitted audience sources. Honor consent, opt-out, customer-list, and sensitive-category requirements. Do not infer sensitive traits from ordinary browsing behavior or move personal data among systems without a defined purpose and access controls.</p>
<h2>Measure the role of retargeting honestly</h2>
<p>Retargeting often reaches people who already know the brand, so platform efficiency can look stronger than cold acquisition. Report it as a distinct funnel role. Review incremental tests when practical and avoid claiming that every returning conversion was caused by the retargeting impression.</p>
<p>Useful measures include reach, deduplicated frequency, return visits, deeper content consumption, service-page movement, completed conversions, sales acceptance, and revenue. Keep demo-page views and other intent events separate from completed leads.</p>
<h2>Agency QA checklist</h2>
<ul>
<li>Audience definitions and windows are documented.</li>
<li>Consent and source-list use are approved.</li>
<li>Purchasers, customers, and other exclusions refresh reliably.</li>
<li>Messages match audience behavior and funnel stage.</li>
<li>Frequency and creative diversity are reviewed together.</li>
<li>Destinations continue the promise made in the ad.</li>
<li>Platform outcomes reconcile with analytics and CRM stages.</li>
</ul>
<h2>Maintain the audience after launch</h2>
<p>Retargeting lists are operating assets, not one-time campaign settings. Review event definitions, audience membership, exclusions, destination URLs, and source integrations on a schedule. Archive obsolete lists and document material rule changes so a reporting shift is not mistaken for a sudden change in buyer behavior.</p>
<p>Continue with the <a href="/resources/b2b-retargeting-EIC">B2B retargeting guide</a>, review the <a href="/resources/eic-search-to-social-playbook">search-to-social playbook</a>, or see how EIC manages <a href="/white-label-ppc-management">cross-channel paid media behind an agency</a>.</p>
</div>`,
  },
  'eic-lead-scoring-b2b-advertising': {
    title: 'B2B Lead Scoring for Paid Media and Sales',
    seoTitle: 'B2B Lead Scoring for Paid Media Agencies',
    description:
      'Build a transparent B2B lead scoring model that separates account fit, buyer behavior, data confidence, and sales validation.',
    updatedAt,
    primaryQuery: 'B2B lead scoring',
    cluster: 'reporting-attribution-and-traffic-quality',
    youtubeId: 'QU8AYnktVhg',
    relatedSlugs: ['b2b-lead-gen-data-enrichment-ICP', 'eic-sales-marketing-handoff-b2b-lead-gen', 'b2b-lead-gen-marketing-from-your-CRM'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>B2B lead scoring is a documented method for prioritizing inquiries or accounts using evidence about fit, behavior, data quality, and sales validation.</strong> A score can help route work and analyze media quality. It should not replace human judgment or turn an unverified form submission into a qualified lead.</p>
<p>For agencies, the model is most useful when the client can explain every input, review false positives, and connect scores with actual opportunity outcomes.</p>
<h2>Separate fit from engagement</h2>
<p>Fit describes whether the account resembles the approved ICP. It may include industry, geography, company size, use case, technology, or other business criteria. Engagement describes what the person or account did, such as returning to the site, consuming relevant content, visiting a service page, or requesting contact.</p>
<p>A high-fit account can show little current intent. A highly engaged visitor can still be a poor fit. Keep both dimensions visible rather than hiding them inside one number.</p>
<h2>Add data confidence</h2>
<p>Record whether important fields are verified, enriched, inferred, missing, or conflicting. A precise-looking score built on stale or incorrectly matched data can misroute sales effort. Do not silently treat an enriched company attribute as customer-confirmed information.</p>
<h2>Use sales validation as a separate stage</h2>
<p>Sales acceptance should confirm that the inquiry is real, relevant, contactable, and worth pursuing. Track explicit reasons for rejection, such as spam, wrong geography, unsupported service, student research, vendor outreach, duplicate record, or no current need.</p>
<p>Those reasons improve audience exclusions, form design, creative, and targeting. A simple “bad lead” label does not.</p>
<h2>Build a transparent scoring model</h2>
<ol>
<li>Define the business decision the score will support.</li>
<li>List fit, behavior, confidence, and exclusion inputs.</li>
<li>Assign bounded weights and explain why each matters.</li>
<li>Create hard disqualifiers where the business requires them.</li>
<li>Test the model against historical accepted and rejected records.</li>
<li>Review false positives and false negatives with sales.</li>
<li>Version changes and record the effective date.</li>
</ol>
<p>A simple matrix can be more useful than a complicated model when the client has limited volume or inconsistent CRM data.</p>
<h2>Connect lead scoring with paid media</h2>
<p>Use validated stages to compare campaigns, audiences, keywords, creative, and landing pages. When platform policies, consent, identity matching, and volume support it, qualified outcomes may also inform offline conversion optimization. Do not send an unstable score back to an ad platform as if it were confirmed revenue.</p>
<h2>Report the complete funnel</h2>
<p>Show forms, valid inquiries, scored fit, sales acceptance, opportunities, wins, and revenue separately. Include the definitions and date window. A campaign with fewer forms may be stronger if it produces more accepted opportunities, but the evidence should be visible rather than asserted.</p>
<h2>Governance checklist</h2>
<ul>
<li>The ICP and rejection reasons are approved.</li>
<li>Inputs have owners and reliable sources.</li>
<li>Missing data does not silently become a negative score.</li>
<li>Sensitive data is excluded unless clearly permitted and necessary.</li>
<li>Sales can override the score with a recorded reason.</li>
<li>Model changes are versioned and compared over complete periods.</li>
<li>Downstream outcomes are reviewed regularly.</li>
</ul>
<p>Continue with <a href="/resources/b2b-lead-gen-data-enrichment-ICP">B2B data enrichment for ICP definition</a>, review the <a href="/resources/eic-sales-marketing-handoff-b2b-lead-gen">sales and marketing handoff</a>, or see EIC's <a href="/white-label-ppc-management">white-label reporting and fulfillment process</a>.</p>
</div>`,
  },
  'b2b-EIC-value-based-bidding': {
    title: 'Value-Based Bidding for B2B Paid Media',
    seoTitle: 'B2B Value-Based Bidding: Agency Guide',
    description:
      'Learn how agencies prepare CRM stages, conversion values, identity matching, and QA before using value-based bidding in B2B paid media.',
    updatedAt,
    primaryQuery: 'B2B value-based bidding',
    cluster: 'reporting-attribution-and-traffic-quality',
    youtubeId: 'gfGdwAjteoE',
    relatedSlugs: ['eic-lead-scoring-b2b-advertising', 'eic-track-b2b-roi-utm-deal', 'b2b-meta-attribution-CAPI'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Value-based bidding uses conversion values to help an advertising platform prioritize outcomes that a business considers more valuable.</strong> In B2B, the difficult work is not selecting the bidding setting. It is defining reliable stages, values, identity matching, and feedback from the CRM.</p>
<p>For agencies, value-based bidding should follow measurement maturity. Sending arbitrary values or unstable lead scores can teach the platform to optimize toward noise.</p>
<h2>Start with a trustworthy conversion hierarchy</h2>
<p>Document the stages the business can verify, such as valid inquiry, sales-accepted lead, opportunity, closed customer, and recognized revenue. Keep micro-events like engaged visits and demo-page views available for diagnostics or audience building without labeling them as sales outcomes.</p>
<p>Each stage needs a clear trigger, source system, owner, timestamp, and deduplication method.</p>
<h2>Choose values the business can explain</h2>
<p>Possible approaches include actual transaction revenue, expected value based on observed close rates, or bounded category values that represent relative importance. The choice depends on volume, data quality, sales cycle, and the reliability of the financial inputs.</p>
<p>Do not present expected value as confirmed revenue. Document the formula and refresh it when close rates, product mix, margin, or sales operations change.</p>
<h2>Preserve identity and source context</h2>
<p>Capture approved click identifiers, campaign parameters, timestamps, and stable CRM IDs where available. Deduplicate repeated imports and handle stage changes deliberately. A lead that becomes an opportunity should not accidentally appear as two separate people or two unrelated conversions.</p>
<p>Follow platform policies and applicable privacy requirements. Use only the data necessary for the defined measurement purpose.</p>
<h2>Validate the pipeline before enabling bidding</h2>
<ul>
<li>Test records reach the CRM with the correct source.</li>
<li>Spam, duplicates, employees, and internal tests are excluded.</li>
<li>Stage changes occur consistently.</li>
<li>Values and currencies are correct.</li>
<li>Imported events reconcile with source-system counts.</li>
<li>Late updates, reversals, and lost opportunities are handled.</li>
<li>The account has enough stable signal for the chosen strategy.</li>
</ul>
<h2>Launch with a controlled comparison</h2>
<p>Annotate the effective date, campaigns, bidding configuration, values, budgets, and other material changes. Avoid changing creative, landing pages, audience, and conversion definitions simultaneously when the objective is to learn about bidding.</p>
<p>Review complete periods and lagged sales outcomes. A short movement in platform-reported value is not enough to prove business improvement.</p>
<h2>Watch for failure modes</h2>
<p>Value-based bidding can overemphasize high-frequency proxy events, stale customer values, duplicate conversions, or one product category. It can also reduce delivery when the signal is too sparse or inconsistent. Monitor volume, mix, lead validity, opportunity quality, revenue, and margin rather than one automated recommendation.</p>
<h2>What agencies should report</h2>
<p>Show the conversion hierarchy, value source, match coverage, import health, spend, platform value, CRM stages, closed outcomes, and major changes. Explain which numbers are observed, expected, modeled, or attributed.</p>
<h2>Know when not to use it</h2>
<p>Stay with simpler bidding and measurement when conversion volume is sparse, stage definitions are inconsistent, values are speculative, or imports fail reconciliation. Improving the underlying CRM and conversion process can create more value than enabling an advanced bidding feature before the account is ready.</p>
<p>Continue with the <a href="/resources/eic-lead-scoring-b2b-advertising">B2B lead scoring framework</a>, review <a href="/resources/eic-track-b2b-roi-utm-deal">UTM and deal attribution</a>, or see how EIC handles <a href="/white-label-ppc-management">measurement and campaign delivery behind an agency</a>.</p>
</div>`,
  },
  'creative-that-converts': {
    title: 'Paid Media Creative That Converts by Funnel Stage',
    seoTitle: 'Paid Media Creative That Converts by Funnel Stage',
    description:
      'Plan conversion-focused paid media creative around buyer stage, message hypotheses, credible proof, clear offers, and qualified outcomes.',
    updatedAt,
    primaryQuery: 'paid media creative that converts',
    cluster: 'creative-production-and-testing',
    relatedSlugs: ['how-often-update-digital-ad-creative', 'essential-digital-advertising-creative', 'produce-effective-digital-advertising-creative'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Paid media creative converts when the message fits the audience's problem, stage, channel context, and next useful action.</strong> A polished asset cannot rescue an unclear offer or broken conversion path. A simple asset can still work when it communicates the right idea with credible proof.</p>
<p>For agencies, the goal is a learnable creative system rather than a stream of disconnected designs.</p>
<h2>Start with the buyer question</h2>
<p>Before choosing a format, define the question the buyer needs answered. Early-stage buyers may need help recognizing the problem. Evaluating buyers may need proof, implementation detail, risk reduction, pricing context, or comparison criteria. High-intent buyers need a clear next step.</p>
<p>Write one sentence describing the audience, problem, message, proof, and action for each concept.</p>
<h2>Match creative to funnel role</h2>
<ul>
<li><strong>Awareness:</strong> name the problem, teach a useful idea, or introduce a category.</li>
<li><strong>Consideration:</strong> show process, expertise, examples, objections, and differentiated value.</li>
<li><strong>Evaluation:</strong> explain fit, ownership, deliverables, proof, and what happens next.</li>
<li><strong>Action:</strong> present the offer, requirements, urgency when real, and a clear CTA.</li>
</ul>
<p>Do not judge every concept by immediate lead volume. Use metrics that fit the assigned role, then follow whether qualified users move deeper into the journey.</p>
<h2>Build around message pillars</h2>
<p>Create a portfolio that includes problem, outcome, process, proof, objection, founder or expert perspective, customer perspective, and direct offer. This reduces dependence on one ad and gives the audience varied reasons to pay attention.</p>
<p>A variation should change a meaningful dimension, such as hook, proof, format, or CTA. Record what changed so the result can inform the next brief.</p>
<h2>Use proof responsibly</h2>
<p>Use approved client outcomes, demonstrations, product evidence, process screenshots, testimonials, or attributed expert insight. Preserve the conditions and scope. Do not convert one account result into a universal promise or remove a caveat needed to understand the claim.</p>
<h2>Connect the ad with the destination</h2>
<p>The landing page should continue the same message, audience, and offer. Verify mobile layout, load behavior, forms, calendars, checkout, confirmation, and CRM routing. If the ad promises a guide, show the guide. If it promises service details, do not send the buyer to a generic homepage section without context.</p>
<h2>Measure qualified response</h2>
<p>Review delivery, click-through behavior, landing-page quality, engaged visits, repeat visits, conversion completion, lead validity, opportunities, and revenue as separate layers. Cheap clicks are not the objective when they do not produce useful onsite behavior or business outcomes.</p>
<h2>Agency creative review checklist</h2>
<ul>
<li>Audience and funnel role are explicit.</li>
<li>One message hypothesis guides the concept.</li>
<li>Claims and source assets are approved.</li>
<li>Format fits the platform and placement.</li>
<li>Destination continues the same promise.</li>
<li>CTA matches the buyer's readiness.</li>
<li>Tracking and CRM routing are verified.</li>
<li>The next scale, iterate, watch, or retire decision is documented.</li>
</ul>
<h2>Preserve the learning</h2>
<p>Keep the brief, source assets, approvals, launch date, spend, audience, placement, destination, and result connected to the concept. A searchable history prevents the team from repeating failed ideas without context and helps new variations build on what the account actually learned.</p>
<p>Review <a href="/resources/how-often-update-digital-ad-creative">when to refresh ad creative</a>, continue with the <a href="/resources/essential-digital-advertising-creative">essential creative elements</a>, or see how EIC includes <a href="/white-label-ppc-management">creative production in white-label delivery</a>.</p>
</div>`,
  },
  'b2b-marketing-Google-AI-Max': {
    title: 'Google AI Max for Search Campaigns: Agency Guide',
    seoTitle: 'Google AI Max for Search Campaigns: Agency Guide',
    description:
      'Learn what Google AI Max can change in Search campaigns and how agencies review query expansion, assets, landing pages, controls, and outcomes.',
    updatedAt,
    primaryQuery: 'Google AI Max for Search campaigns',
    cluster: 'b2b-paid-media-execution',
    youtubeId: 'S91qd0cuUYg',
    relatedSlugs: ['b2b-lead-gen-google-ai-overviews', 'eic-search-to-social-playbook', 'eic-track-b2b-roi-utm-deal'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>Google AI Max for Search campaigns adds automation that can expand query matching, adapt creative assets, and select landing pages using the account's configuration and Google's models.</strong> The exact available controls and reporting can change, so agencies should verify the current account interface and Google documentation before recommending adoption.</p>
<p>AI Max is not a substitute for conversion quality, a clear offer, useful landing pages, or account governance. It can only optimize from the signals and boundaries the advertiser provides.</p>
<h2>What agencies should evaluate first</h2>
<p>Start with the business objective, current Search campaign structure, search-term quality, landing-page inventory, conversion definitions, brand controls, and offline outcome feedback. An account with weak tracking or poor destinations should fix those inputs before adding broader automation.</p>
<h2>Query expansion needs search-term review</h2>
<p>Automation may find relevant searches outside the existing keyword set, but it may also enter ambiguous or low-value territory. Review search terms, themes, negatives, geography, audience context, and downstream quality. Use the client's sales language and CRM outcomes to identify terms that look relevant but produce poor-fit inquiries.</p>
<h2>Asset adaptation needs approved source material</h2>
<p>Provide accurate headlines, descriptions, value propositions, and approved claims. Review combinations for meaning, grammar, brand fit, and landing-page consistency. Do not assume that an automatically assembled message preserves required legal, pricing, or factual context.</p>
<h2>Landing-page expansion needs a controlled site</h2>
<p>Audit the pages automation may select. Remove or constrain destinations that are outdated, irrelevant, thin, unapproved, or unable to convert. Every eligible page should have a clear purpose, accurate metadata, one primary topic, a working conversion path, and reliable analytics.</p>
<h2>Keep brand and non-brand roles visible</h2>
<p>Separate brand defense from non-brand discovery in planning and reporting. A blended result can look efficient when branded demand carries the account. Review query categories, spend, conversions, and business outcomes so automation does not hide where growth actually came from.</p>
<h2>Use qualified conversion signals</h2>
<p>Confirm that primary conversions represent real business outcomes. Forms should pass basic validation, calls should be classified, and ecommerce values should reconcile with confirmed orders. Import offline stages only when identifiers, consent, stage definitions, and data quality are reliable.</p>
<h2>Run a controlled test</h2>
<ol>
<li>Record the baseline, configuration, budget, and conversion definitions.</li>
<li>Choose a bounded campaign or segment.</li>
<li>Avoid simultaneous changes that prevent interpretation.</li>
<li>Review query mix, asset behavior, landing pages, and exclusions.</li>
<li>Compare qualified onsite and CRM outcomes over a complete period.</li>
<li>Document whether to expand, revise, or roll back.</li>
</ol>
<h2>Agency reporting checklist</h2>
<ul>
<li>Automation features and controls enabled</li>
<li>Search-term themes and exclusions</li>
<li>Brand versus non-brand delivery</li>
<li>Asset combinations and approval issues</li>
<li>Landing pages selected</li>
<li>Conversion and lead-quality reconciliation</li>
<li>Material changes and next actions</li>
</ul>
<h2>Preserve a rollback path</h2>
<p>Before expanding automation, save the baseline configuration, exclusions, eligible destinations, conversion actions, and reporting views needed to compare behavior. If query quality, landing-page selection, or qualified outcomes deteriorate, the team should be able to narrow or disable the change without reconstructing the prior state from memory.</p>
<p>Continue with the <a href="/resources/b2b-lead-gen-google-ai-overviews">Google AI Overviews and paid search guide</a>, review the <a href="/resources/eic-search-to-social-playbook">search-to-social playbook</a>, or see how EIC handles <a href="/white-label-ppc-management">Google Ads management behind an agency</a>.</p>
</div>`,
  },
  'eic-b2b-case-study-double-acquisition': {
    title: 'Building a B2B Digital Marketing Engine: Case Study Lessons',
    seoTitle: 'B2B Digital Marketing Engine: Case Study Lessons',
    description:
      'An attributed EIC podcast retrospective on building a B2B digital marketing engine through foundations, measurement, paid media, and iteration.',
    updatedAt,
    primaryQuery: 'B2B digital marketing case study',
    cluster: 'agency-growth-and-fulfillment',
    youtubeId: 'qfk16o1bTJA',
    relatedSlugs: ['eic-media-plans-adding-500k-revenue', 'eic-fix-advertising-funnel-increase-revenue', 'jim-piazza-of-spartaco'],
    bodyHTML: `<div class="blog-html" id="blogPostContent">
<p><strong>In this EIC Agency Podcast episode, Mike Patterson and Dustin Trout describe lessons from a long-running B2B marketing engagement that began with limited digital infrastructure and developed into a broader operating system.</strong> The useful lesson is not a universal growth promise. It is the sequence of foundations, measurement, media, creative, and organizational adoption discussed in the episode.</p>
<p>The client is not identified in the published resource, so this article preserves the story as an attributed practitioner retrospective rather than adding unsupported details.</p>
<h2>Begin with the commercial objective</h2>
<p>A digital program needs a defined business problem. That may be new-customer growth, product adoption, geographic expansion, sales support, or a more reliable view of demand. Translate the objective into the funnel stages the business can verify.</p>
<p>For an agency, this requires access to the people who own sales, operations, customer data, and financial definitions. Media metrics alone cannot define success.</p>
<h2>Build the measurement foundation</h2>
<p>Document website events, campaign parameters, form and call sources, CRM stages, opportunity ownership, and revenue records. Keep media delivery, engaged visits, leads, sales acceptance, opportunities, and wins separate.</p>
<p>Historical data may be incomplete. Label assumptions and use the first operating period to improve definitions rather than present modeled values as confirmed outcomes.</p>
<h2>Choose channels by role</h2>
<p>Search can capture declared demand. Social and video can distribute education and proof. Retargeting can sequence messages for returning visitors. CRM and first-party audiences can support exclusions, customer communication, and qualified outcome feedback.</p>
<p>The channel mix should follow the buying process, audience, creative capacity, and budget. It should not be copied from another account simply because the industries look similar.</p>
<h2>Create a repeatable creative system</h2>
<p>Build message pillars around customer problems, use cases, proof, process, objections, and next steps. Produce variations with clear hypotheses and review them according to funnel role. A B2B program often needs repeated education for several buying roles rather than one direct-response ad.</p>
<h2>Connect marketing and sales feedback</h2>
<p>Sales should record why leads are accepted, rejected, delayed, or lost. Marketing should use those reasons to refine audiences, keywords, creative, forms, content, and qualification. Without that feedback loop, campaigns can optimize toward easy forms rather than viable opportunities.</p>
<h2>Scale the operating system, not one result</h2>
<p>Expand only when tracking is stable, the business can fulfill demand, creative capacity exists, and qualified outcomes support the next investment. Preserve changes, owners, and review cadence so the program does not depend on one person remembering why a decision was made.</p>
<h2>Questions agencies can use in a similar engagement</h2>
<ul>
<li>Which business outcome matters, and who owns the source data?</li>
<li>What does a valid lead and sales-accepted opportunity mean?</li>
<li>Which channel has a clear role in the buying journey?</li>
<li>What approved proof and creative inputs are available?</li>
<li>How will sales feedback reach the media team?</li>
<li>What conditions support scaling, revision, or pause?</li>
<li>Which statements are observed facts, attributed client claims, or planning assumptions?</li>
</ul>
<p>Watch the full episode above for the hosts' account, review the <a href="/resources/eic-media-plans-adding-500k-revenue">B2B media planning framework</a>, continue with the <a href="/resources/eic-fix-advertising-funnel-increase-revenue">advertising funnel guide</a>, or see EIC's <a href="/white-label-ppc-management">white-label delivery process</a>.</p>
</div>`,
  },
};
