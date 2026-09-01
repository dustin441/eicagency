import resources from '@/content/resources.json';
import { resourceClusters, resourceSeoOverrides, type ResourceCluster } from '@/content/resource-seo';

export type ResourcePost = {
  title: string;
  seoTitle?: string;
  slug: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  imageUrl: string;
  imageAltText: string;
  categories: unknown[];
  bodyHTML: string;
  originalUrl: string;
  youtubeId?: string;
  primaryQuery?: string;
  cluster?: ResourceCluster;
  relatedSlugs?: string[];
};

const botAiFraudResourcePost: ResourcePost = {
  "title": "Bot and AI Fraud in Lead Generation: How to Protect Your Ad Spend and Sales Pipeline",
  "seoTitle": "Bot and AI Lead Fraud: Protect Ad Spend and Pipeline",
  "slug": "bot-ai-fraud",
  "description": "Bot and AI-driven lead fraud can make cost per lead look better while wasting ad spend and clogging sales pipelines. Learn how CRM feedback loops, offline conversions, and CAPI help platforms optimize for real prospects.",
  "publishedAt": "2026-08-27T12:00:00.000Z",
  "updatedAt": "2026-08-27T12:00:00.000Z",
  "imageUrl": "/resources/assets/AI_VBB_08_27.svg",
  "imageAltText": "Bot and AI fraud in lead generation — protect your ad spend and sales pipeline",
  "categories": [],
  "bodyHTML": "<div class=\"blog-html\" id=\"blogPostContent\">\n<p>If you've noticed your cost per lead dropping while your sales team's frustration is rising, you're not imagining things. There's a growing problem in digital advertising that's quietly draining marketing budgets and clogging sales pipelines across nearly every industry: bot and AI-driven lead fraud.</p>\n<p>In a recent episode of the EIC Podcast, hosts Mike Patterson and Dustin broke down exactly what's happening, why it's getting worse, and — most importantly — what businesses can do about it. Here's everything you need to know.</p>\n<h2>The Bot Problem Is Bigger Than Ever</h2>\n<p>A couple of years ago, industry data suggested that roughly half of all website traffic was made up of bots, not real humans. Since then, artificial intelligence has advanced dramatically, and bot activity has scaled right along with it. AI tools can now scrape websites, mimic human browsing behavior, and — critically — fill out lead generation forms with increasing sophistication.</p>\n<p>That last part is the real problem for marketers. Bots don't just visit your site anymore; they convert. They fill out your contact forms, request quotes, and book demos. On the surface, this looks like success. Your cost per lead drops, your lead volume climbs, and your dashboards look great.</p>\n<p>But there's a catch: bots don't buy anything. They don't need your product or service. They're not real prospects. And every one of them that slips into your funnel dilutes your data, wastes your ad spend, and burns out your sales team, who are left chasing leads that were never real to begin with.</p>\n<h2>Why This Matters for Your Bottom Line</h2>\n<p>It's tempting to focus on cost per lead as the ultimate marketing metric, but that number can be dangerously misleading. Consider the math: generating a thousand leads at ten dollars each feels efficient on paper — until you realize none of them convert into paying customers. That's ten thousand dollars spent for zero return.</p>\n<p>Compare that to spending five hundred dollars to generate a single high-quality lead that actually closes into a six-thousand-dollar customer. The second scenario, despite looking \"less efficient\" on a lead-volume basis, delivers real business results.</p>\n<p>The takeaway is simple: in today's advertising landscape, quality is what gets rewarded — but only if your systems are built to recognize and communicate quality in the first place.</p>\n<h2>Step One: Build a Feedback Loop Between Your CRM and Ad Platforms</h2>\n<p>So how do you actually fight back against bot traffic? It starts with your CRM and the way you track leads through your sales funnel.</p>\n<p>Ad platforms like Google and Meta are only as smart as the data you feed them. If you're not telling them which leads are genuinely good and which ones are junk, they have no way of learning what a \"good\" prospect looks like — and they'll keep sending you more of whatever is easiest to acquire, bots included.</p>\n<p>The fix is a structured pipeline inside your CRM that clearly labels lead quality at each stage:</p>\n<ul>\n<li>Lead – the initial contact or form submission</li>\n<li>Marketing Qualified Lead (MQL) – a lead that shows real signs of interest or fit</li>\n<li>Sales Qualified Lead (SQL) – a lead your sales team has vetted as a legitimate opportunity</li>\n<li>Closed Won – an actual customer</li>\n</ul>\n<p>By consistently marking leads as they move (or fail to move) through these stages, you create a data trail. When your team identifies a submission as junk, bot-generated, or simply unresponsive, marking it accordingly sends a signal back to the ad platform. Over time, this signal teaches the algorithm to stop targeting that type of profile and start finding more people who resemble your actual, qualified customers.</p>\n<p>This does require some technical setup on the back end, but the payoff is a self-improving system: the more consistently you feed quality signals in, the more quality leads you get out.</p>\n<h2>Step Two: Connect Offline Conversions and Conversion APIs</h2>\n<p>Labeling leads in your CRM is only half the equation. The next — and arguably most powerful — step is connecting that CRM data directly back to the ad platforms using two key tools: Google's Offline Conversion Import and Meta's Conversions API (CAPI).</p>\n<p>Here's how it works in practice. When someone fills out a form on your website, their submission carries a unique identifier — a Google Click ID (GCLID) or a Facebook Click ID (FBCLID). This identifier is tied to that exact ad click: the timestamp, the ad they saw, the device they used, all of it.</p>\n<p>If your website and CRM are set up to capture and store that click ID alongside the contact record, you can then pass it back to Google or Meta automatically as the lead progresses through your funnel — for example, the moment a lead becomes an MQL or an SQL. Once the platform receives that signal, it uses its own machine learning to identify patterns and go find more people who match that same high-quality profile.</p>\n<p>This process involves multiple teams — website developers, CRM administrators, and marketing — working together, and it's genuinely technical. But it's also one of the most effective ways to systematically filter out bot and low-quality traffic while training your ad platforms to prioritize real prospects.</p>\n<h2>A Real-World Example: From $650 to $24 Per Appointment</h2>\n<p>Numbers tell the story better than theory. One recent client came in with the wrong conversion signals set up entirely — the platform was optimizing toward \"purchase\" events that weren't actually tracking real purchases, feeding it inaccurate value data.</p>\n<p>After two weeks of correcting the conversion tracking and layering in proper quality signals, the results were dramatic: cost per appointment dropped from $650 to just $24. Offline data also showed that cash collected increased by 75% since the changes were implemented.</p>\n<p>It's worth noting this wasn't an overnight fix — it took three to four weeks of coordinated effort across teams to fully implement. But the return on that effort was substantial and measurable.</p>\n<h2>The Checklist: What You Need to Fight Bot and AI Lead Fraud</h2>\n<p>If you're dealing with high lead volume but low actual quality, here's where to start:</p>\n<ul>\n<li>Audit your current tracking. Are you optimizing toward the right conversion events, or toward vanity metrics like raw form fills?</li>\n<li>Build out a proper CRM pipeline with clear stages (Lead → MQL → SQL → Closed Won).</li>\n<li>Get your sales team bought in on consistently marking lead quality — this is often the hardest part, since it depends on process discipline, not just technology.</li>\n<li>Implement Google Offline Conversion Import to feed real sales outcomes back into Google Ads.</li>\n<li>Set up Meta's Conversions API (CAPI) to do the same for Meta platforms.</li>\n<li>Capture click IDs (GCLID/FBCLID) at the point of form submission and store them with the contact record.</li>\n<li>Automate the signal-passing so click IDs and quality data move to the ad platforms as leads progress, without manual work.</li>\n<li>Monitor and iterate. Expect several weeks of adjustment before you see the full impact.</li>\n</ul>\n<h2>Final Thoughts</h2>\n<p>Bot and AI fraud in lead generation isn't a hypothetical risk — it's an active, growing tax on ad budgets across every platform. But it's also a solvable problem. The businesses that will win in this environment are the ones that stop chasing raw lead volume and instead build the infrastructure to identify, signal, and optimize for genuine quality.</p>\n<p>That means a disciplined CRM process, buy-in from your sales team, and the technical connective tissue — offline conversions and CAPI — that lets ad platforms actually learn what a real customer looks like.</p>\n<h3>Ready to Clean Up Your Lead Pipeline?</h3>\n<p>If you're generating plenty of leads but struggling with quality, you don't have to solve this alone. Watch the full episode of the EIC Podcast for the complete conversation, or book a discovery call to talk through your specific setup and find out where the gaps are in your tracking and CRM process.</p>\n<p><strong><a href=\"https://youtu.be/cvoUxKXBjS8\" target=\"_blank\" rel=\"noopener noreferrer\">Watch the full episode on YouTube</a></strong> | <strong><a href=\"/eic-schedule-demo\">Book a discovery call</a></strong> | <strong><a href=\"https://open.spotify.com/episode/57n4PWRwI9LgoAPjYLDN55?si=zwgr30asTHm7yVKvqJ6CDA\" target=\"_blank\" rel=\"noopener noreferrer\">Listen on Spotify</a></strong></p>\n</div>",
  "originalUrl": "https://eic.agency/resources/bot-ai-fraud",
  "youtubeId": "cvoUxKXBjS8",
  "primaryQuery": "bot and AI fraud in lead generation",
  "cluster": "reporting-attribution-and-traffic-quality",
  "relatedSlugs": [
    "eic-b2b-how-to-avoid-bot-traffic",
    "the-hidden-threat-of-bot-traffic",
    "b2b-meta-attribution-CAPI"
  ]
};

const northStarResourcePost: ResourcePost = {
  "title": "What Is a North Star Metric? Why Most Businesses Are Tracking the Wrong KPI",
  "seoTitle": "What Is a North Star Metric? How to Choose the Right KPI",
  "slug": "north-star-metric",
  "description": "Learn what a North Star metric is, why cost per lead and short-window ROAS can mislead your team, and how to choose the KPI that reflects real business growth.",
  "publishedAt": "2026-08-18T12:00:00.000Z",
  "updatedAt": "2026-08-18T12:00:00.000Z",
  "imageUrl": "/resources/assets/North_Star_v2.svg",
  "imageAltText": "What Is a North Star Metric? Why Most Businesses Are Tracking the Wrong KPI",
  "categories": [
    {
      "_id": "69cc4fef1532010282fc5f97",
      "deleted": false,
      "label": "B2B Marketing",
      "urlSlug": "b2b",
      "locationId": "sOw2MrwbI7K90fm7jZVZ",
      "metaData": {
        "updatedBy": "vuPn1bFpMCVyDg7w5BiK"
      },
      "createdAt": "2026-03-31T22:51:27.464Z",
      "updatedAt": "2026-03-31T22:51:27.464Z",
      "__v": 0
    }
  ],
  "bodyHTML": "<div class=\"blog-html\" id=\"blogPostContent\">\n<p>If you had to name the single number that determines whether your marketing is working, could you do it? For most business owners, the honest answer is no. They’re staring at a dashboard full of numbers, but they haven’t identified the one metric that actually reflects whether the business is moving in the right direction.</p>\n<p>That number has a name: your North Star metric. And if you don’t know what yours is, you’re not alone. But you also might be burning through ad spend chasing the wrong goal.</p>\n<p>In this post, we’ll break down what a North Star metric actually is, why “obvious” metrics like cost per lead and ROAS can quietly sabotage your growth, and how to identify the right KPI for your business — whether you’re in lead generation or e-commerce.</p>\n<h2>What Is a North Star Metric, Exactly?</h2>\n<p>A North Star metric isn’t just another KPI sitting in your analytics dashboard. It’s <em>the</em> metric — the singular, most important number that your entire business strategy should revolve around.</p>\n<p>The key word is singular. A North Star metric isn’t a dashboard full of numbers you glance at. It’s the one number that, when it improves, means your business is genuinely healthier — and every other decision, from ad spend to sales follow-up, should be built around moving that number in the right direction.</p>\n<p>Every business is different, which means every North Star metric is different too. The metric that makes sense for a SaaS company won’t be the same one that makes sense for an e-commerce brand or a professional services firm generating leads. The goal is to define the right metric for your specific business model and customer behavior — not to copy whatever metric your competitor or industry blog is talking about.</p>\n<h2>Why “Good Enough” Metrics Can Quietly Wreck Your Growth</h2>\n<p>Here’s the trap: plenty of commonly used metrics feel like they should be your North Star, but they can actually point you in the wrong direction.</p>\n<p>Think about it like navigation. If you start a journey just two degrees off course, you might think you’re headed to Europe — but you’ll end up somewhere in Africa instead. Small misalignments in what you’re measuring compound over time, and by the time you notice, you’ve drifted a long way from where you actually wanted to go.</p>\n<p>Some of the most common — and most commonly misused — metrics include:</p>\n<ul>\n<li><strong>Cost Per Lead (CPL)</strong> — feels efficient, but says nothing about lead quality</li>\n<li><strong>Industry benchmarks</strong> — useful for context, but not a strategy in themselves</li>\n<li><strong>ROAS (Return on Ad Spend)</strong> — critical in e-commerce, but frequently measured over too short a time window</li>\n</ul>\n<p>None of these are bad metrics. The problem is treating them as the finish line instead of one input into a bigger picture.</p>\n<h2>The Right North Star Metric for Lead Generation: Cost Per SQL</h2>\n<p>For businesses focused on lead generation, the temptation is to obsess over cost per lead — get the cheapest leads possible, or the highest volume. But that mindset creates a hidden problem: quality.</p>\n<p>Here’s a scenario that plays out constantly. A business is generating leads at $10 each through form fills, and they’re getting 100 of them a month. On the surface, that looks like a win. But when the sales team actually reviews those leads, they find that 90% are “tire kickers” — people who aren’t a real fit, aren’t ready to buy, or don’t even understand what the company offers.</p>\n<p>That means only 10 of those 100 leads are actually sales-qualified. Suddenly, the real cost per qualified lead is ten times higher than the number on the dashboard suggested. If you’re optimizing purely for cost per lead, you’re not saving money — you’re burning it while feeling productive.</p>\n<p>That’s why the better North Star metric for most lead-gen businesses is cost per Sales Qualified Lead (SQL), not cost per lead. Optimizing for cost per SQL forces your team to have essential conversations that cheap-lead chasing skips entirely:</p>\n<ul>\n<li>What actually defines a “sales qualified” lead for your business?</li>\n<li>What’s the real path a prospect takes from first contact to becoming sales-ready?</li>\n<li>How do we filter out unqualified traffic before it hits your sales team’s calendar?</li>\n</ul>\n<p>When you shift your focus to cost per SQL, you’re no longer just measuring volume. You’re measuring the thing that actually matters: are you generating leads your sales team can actually close?</p>\n<h2>The Right North Star Metric for E-Commerce: Lifetime Value–Adjusted ROAS</h2>\n<p>E-commerce businesses fall into a different but equally costly trap: chasing a flat 3x ROAS as if it’s some universal law of profitable advertising.</p>\n<p>Here’s the problem with that thinking. Paid ads are typically the tool you use to acquire a customer — and in most e-commerce categories, you lose money on that first purchase. If your average order value and margins mean you’re spending $20 to acquire a customer who only spends $40 on their first order, that’s a 2x ROAS. By the “3x or bust” standard, that campaign looks like a failure.</p>\n<p>But that snapshot is misleading, because it ignores what happens next.</p>\n<p>If that same customer comes back and purchases three more times over the following months — bringing their total spend to $160 — your real ROAS on that original $20 acquisition cost jumps to roughly 8x. The campaign wasn’t underperforming. It was just being measured over the wrong time horizon.</p>\n<p>This is why the smarter North Star metric for e-commerce brands isn’t ROAS in isolation — it’s ROAS evaluated against customer lifetime value (LTV). Paid ads exist to acquire the customer. Email, SMS, and lifecycle nurturing exist to drive that second, third, and fourth purchase. When you evaluate ROAS over a 6- or 12-month window instead of a single transaction, you get a far more accurate — and far more forgiving — picture of what’s actually working.</p>\n<p>To land on a realistic, achievable ROAS target, you need to understand:</p>\n<ul>\n<li>Your average order value</li>\n<li>Your actual repeat purchase rate and buying cadence</li>\n<li>Your true cost per purchase across the full customer journey</li>\n</ul>\n<p>Once you have those numbers, you can define a ROAS goal that’s grounded in your actual business — not an arbitrary industry rule of thumb.</p>\n<h2>How Your North Star Metric Shapes Everything Downstream</h2>\n<p>Once you’ve identified the correct North Star metric, something powerful happens: it becomes the filter through which every other decision gets made.</p>\n<p>Suddenly, questions like “how is our Meta ad spend performing?” or “how are things doing on LinkedIn?” get evaluated against the metric that actually matters — not vanity numbers that look good in isolation but don’t reflect real business health.</p>\n<p>This also means you need visibility into your full funnel — from impressions to clicks to conversions — so you can benchmark each stage of the customer journey. Once you know your benchmarks, diagnosing problems becomes far more precise. When performance dips, you can pinpoint exactly where the issue lives:</p>\n<ul>\n<li>Is it the ad creative or targeting?</li>\n<li>Is it the audience you’re reaching?</li>\n<li>Is it the on-page offer or landing experience?</li>\n<li>Is it how your team is communicating with prospects after the click?</li>\n</ul>\n<p>Without a clear North Star metric and clean benchmarks at each stage, you’re left guessing. With them, you’re troubleshooting with precision.</p>\n<h2>Measuring Correctly Matters as Much as Measuring the Right Thing</h2>\n<p>There’s one more piece that often gets overlooked: even if you’ve identified the right North Star metric, it only helps you if you’re actually measuring it correctly.</p>\n<p>That means asking some uncomfortable but necessary questions:</p>\n<ul>\n<li>Is your tracking set up properly across every channel and touchpoint?</li>\n<li>Are you capturing data that’s genuinely actionable, or just numbers that look impressive in a report?</li>\n<li>Do you have a clear line of sight from ad spend all the way through to your North Star metric?</li>\n</ul>\n<p>Getting this infrastructure right is just as important as picking the right metric in the first place. A perfect North Star metric built on broken or incomplete data will still lead you astray.</p>\n<h2>Find Your North Star Before You Spend Another Dollar</h2>\n<p>Operating without a clear North Star metric is a lot like living without a sense of purpose — you end up scattered, reacting to whatever number looks good that week instead of moving deliberately toward real growth. And every dollar you spend without that clarity is a dollar that might be pointed in the wrong direction.</p>\n<p>If you’re not confident you’ve identified the right North Star metric for your business — or you have one but aren’t sure your tracking is set up to measure it accurately — that’s exactly the kind of question worth working through with someone who does this daily.</p>\n<p>Want to go deeper on this topic? Watch the full episode of the EIC Podcast above, or listen on Spotify below. If you’re ready to identify your North Star metric and build a measurement plan around it, book a discovery call — we’d love to help you find your focus.</p>\n<h2>Listen to the Episode on Spotify</h2>\n<div style=\"border-radius: 12px; overflow: hidden; margin: 1.5rem 0;\"><iframe style=\"border-radius: 12px;\" src=\"https://open.spotify.com/embed/episode/6MrmtpKigU5fxW5p4QWNcZ?utm_source=generator\" width=\"100%\" height=\"152\" frameborder=\"0\" allowfullscreen=\"\" allow=\"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture\" loading=\"lazy\" title=\"Listen to What Is a North Star Metric? on Spotify\"></iframe></div>\n<p><a href=\"https://open.spotify.com/episode/6MrmtpKigU5fxW5p4QWNcZ?si=MXU2t5ewRjKpllCjx0WAwQ\" target=\"_blank\" rel=\"noopener noreferrer\">Open this episode in Spotify</a></p>\n</div>",
  "originalUrl": "https://eic.agency/resources/north-star-metric",
  "youtubeId": "SRvwPmHqo_c",
  "primaryQuery": "North Star metric",
  "cluster": "reporting-attribution-and-traffic-quality",
  "relatedSlugs": [
    "b2b-advertising-metrics-that-matter",
    "eic-roas-vs-revenue",
    "building-the-best-marketing-dashboard"
  ]
};

export function normalizeResourceBodyHTML(value: string) {
  return value
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>');
}

function applyResourceBodyReplacements(
  value: string,
  replacements: Array<{ search: string; replace: string }> = [],
) {
  return replacements.reduce((html, replacement) => html.replace(replacement.search, replacement.replace), value);
}

export const resourcePosts: ResourcePost[] = [
  botAiFraudResourcePost,
  northStarResourcePost,
  ...(resources as ResourcePost[]).map((post) => {
  const override = resourceSeoOverrides[post.slug] ?? {};
  return {
    ...post,
    ...override,
    bodyHTML: applyResourceBodyReplacements(
      normalizeResourceBodyHTML(override.bodyHTML ?? post.bodyHTML),
      override.bodyReplacements,
    ),
  };
  }),
];

export function getResourcePost(slug: string) {
  return resourcePosts.find((post) => post.slug === slug);
}

export function getFeaturedResources(limit = 3) {
  return resourcePosts.slice(0, limit);
}

export function getResourceCluster(slug: string): ResourceCluster | undefined {
  const explicitCluster = getResourcePost(slug)?.cluster;
  if (explicitCluster) return explicitCluster;

  return (Object.keys(resourceClusters) as ResourceCluster[]).find((cluster) =>
    (resourceClusters[cluster] as readonly string[]).includes(slug),
  );
}

export function getResourceClusterPosts(cluster: ResourceCluster) {
  return (resourceClusters[cluster] as readonly string[])
    .map(getResourcePost)
    .filter((post): post is ResourcePost => Boolean(post));
}

export function getRelatedResources(slug: string, limit = 3) {
  const currentPost = getResourcePost(slug);
  if (!currentPost) return resourcePosts.slice(0, limit);

  const explicitRelated = (currentPost.relatedSlugs ?? [])
    .map(getResourcePost)
    .filter((post): post is ResourcePost => Boolean(post));

  const cluster = getResourceCluster(slug);
  const clusterSlugs: string[] = cluster ? [...resourceClusters[cluster]] : [];
  const currentIndex = clusterSlugs.indexOf(slug);
  const balancedClusterSlugs: string[] = [];

  for (let distance = 1; distance < clusterSlugs.length; distance += 1) {
    for (const direction of [1, -1]) {
      const relatedSlug = clusterSlugs[(currentIndex + direction * distance + clusterSlugs.length) % clusterSlugs.length];
      if (
        relatedSlug
        && relatedSlug !== slug
        && !balancedClusterSlugs.includes(relatedSlug)
        && !explicitRelated.some((post) => post.slug === relatedSlug)
      ) balancedClusterSlugs.push(relatedSlug);
    }
  }

  const clusterRelated = balancedClusterSlugs
    .map(getResourcePost)
    .filter((post): post is ResourcePost => Boolean(post));
  // Preserve curated relevance while reserving one slot for a balanced cluster
  // neighbor. The reserved slot prevents the same first few cluster pages from
  // receiving nearly all template-generated internal links.
  const related = [...explicitRelated.slice(0, Math.max(0, limit - 1)), ...clusterRelated];
  if (related.length >= limit) return related.slice(0, limit);

  const fallback = resourcePosts.filter(
    (post) => post.slug !== slug && !related.some((relatedPost) => relatedPost.slug === post.slug),
  );
  return [...related, ...fallback].slice(0, limit);
}

export function getResourceVideoId(post: ResourcePost) {
  if (post.youtubeId) return post.youtubeId;

  const match = post.bodyHTML.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return match?.[1];
}

export function formatResourceDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
