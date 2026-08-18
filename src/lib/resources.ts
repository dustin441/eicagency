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
  "youtubeId": "SRvwPmHqo_c"
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
