import resources from '@/content/resources.json';
import { hiringVsWhiteLabelResource } from '@/content/hiring-vs-white-label-paid-media';
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

const googleAdsWhiteLabelResourcePost: ResourcePost = {
  title: "Google Ads Management Isn't Set It and Forget It: What a 12-Year Google Ads Expert Wants You to Know",
  seoTitle: "Google Ads Management: Why Set It and Forget It Fails",
  slug: "google-ads-management-white-label",
  description: "A 12-year Google Ads expert explains why “set it and forget it” campaigns fail, and what strategy, optimization and offline conversion tracking add.",
  publishedAt: "2026-11-17T12:00:00.000Z",
  updatedAt: "2026-11-17T12:00:00.000Z",
  imageUrl: "/resources/assets/Google_White_Label_11_12.svg",
  imageAltText: "Google Ads management is not set it and forget it",
  categories: [],
  bodyHTML: "<div class=\"blog-html\" id=\"blogPostContent\">\n<p>A Google Ads account can look like it's working. Clicks are coming in, traffic is up and the dashboard is busy. But clicks aren't the goal. Sales, revenue and a real return on ad spend are.</p>\n<p>On a recent episode of the EIC Podcast, Mike Patterson sat down with Dustin, who has spent nearly 13 years in Google Ads, including time working with and for Google. They covered what good Google Ads management really involves, why most “set it and forget it” accounts stall, and why agencies and brands are turning to white label Google Ads partners to fill the gap.</p>\n<p>Here's what they discussed.</p>\n<h2>Why “Set It and Forget It” Google Ads Campaigns Don't Deliver ROI</h2>\n<p>The most common mistake in paid search is treating it as a one-time setup. Pick a few keywords, set a budget, launch and check back next quarter.</p>\n<p>As Dustin explains, that approach will drive traffic, but it rarely drives the ROI needed to scale. Traffic is easy to buy. Profitable traffic takes context: who you're targeting, what you're selling and whether the numbers work.</p>\n<p>That's the trap many advertisers fall into. Clicks and impressions make an account look healthy while the business sees little from it.</p>\n<h2>Start With Strategy: The Right Message, to the Right Person, Where They Consume Content</h2>\n<p>Before a single campaign is built, the EIC team works from a simple principle: deliver the right message to the right person where they consume content.</p>\n<p>In practice, that means getting obsessed with the customer by answering questions like these:</p>\n<ul><li><strong>Who has the problem?</strong> Who is the person your client's product or service solves a problem for?</li><li><strong>What are they searching for?</strong> What problems do they need solved, and what boxes do they need checked while they research?</li><li><strong>Where do they spend time online?</strong> Which platforms and content types reach them?</li></ul>\n<p>Next comes clarity on the offer itself. Are you promoting the overall brand, one product, or a full line of services? Each goal calls for a different approach.</p>\n<h3>Know Your Unit Economics Before You Bid</h3>\n<p>One of the most overlooked parts of Google Ads strategy is the economics. Before choosing keywords or channels, you need to understand:</p>\n<ul><li>the revenue on what's being sold</li><li>the actual profit margin</li><li>the break-even cost to acquire a customer</li></ul>\n<p>These numbers decide which keywords and channels can realistically be profitable. Without them, you're bidding blind.</p>\n<h2>How Strategy Shapes Google Ads Campaign Structure</h2>\n<p>Once the strategy is clear, it shapes the campaign build directly.</p>\n<p><strong>Keywords follow intent.</strong> The focus is on what people are actually searching for, because search terms show where someone is in their buying journey.</p>\n<p><strong>Channels follow the audience.</strong> Depending on who you're targeting, the right mix might include Google Search, Shopping, Facebook, TikTok or LinkedIn. Knowing your audience tells you which channels to use and what to say on each one.</p>\n<p>A well-structured account isn't a guess. It's the result of the strategy work done upfront.</p>\n<h2>What Ongoing Google Ads Optimization Actually Involves</h2>\n<p>This is where most of the value, and most of the work, sits. According to Dustin, there are “a thousand different ways to look at the data,” and good account management means checking as many of them as possible, every week.</p>\n<p>Here's what that weekly Google Ads optimization covers.</p>\n<h3>Campaign, Ad Group and Keyword Performance</h3>\n<p>Which campaigns, ad groups and keywords are producing sales and leads, and which aren't? Budget should follow performance.</p>\n<h3>Bidding Strategy and Budget Control</h3>\n<p>Bidding is never one-size-fits-all. Key questions include:</p>\n<ul><li>Are we bidding to maximize clicks?</li><li>Do we have enough conversion volume to bid for conversions?</li><li>Do we have enough conversion value data to use value-based bidding?</li></ul>\n<p>The right answer changes as the account matures.</p>\n<h3>Messaging and Ad Copy</h3>\n<p>Which messages drive clicks, and more importantly, which ones drive leads? Testing ad copy is ongoing work.</p>\n<h3>Geographic Performance</h3>\n<p>Performance can vary widely by location. The EIC team looks at state, city and ZIP code data to see where money is being spent and where conversions are happening.</p>\n<h3>Landing Page Conversion Rates</h3>\n<p>Not all landing pages perform equally. Some convert better than others, and some suit people still researching better than people ready to buy. Matching the page to the visitor's intent matters.</p>\n<h3>Brand vs. Non-Brand Search</h3>\n<p>This is one of the biggest factors in Google Search, and one of the easiest to misread.</p>\n<p>Branded search campaigns often show strong conversion numbers. But people searching your brand name already know who you are. If an account leans heavily on branded terms, it can hide behind what Dustin calls vanity metrics: impressive-looking sales numbers that don't reflect new customers.</p>\n<p>The main job of most ad spend is acquiring new customers. Getting the balance between brand and non-brand spend right is essential.</p>\n<h3>Prospecting vs. Retargeting</h3>\n<p>The same thinking applies to audiences. Is there a big enough retargeting audience to reach people enough times to drive results? How should budget be split between reaching new prospects and re-engaging past visitors?</p>\n<p>That balance shifts as time passes and budgets change. The question underneath it all stays the same: are we spending this money in the most effective way possible?</p>\n<h2>Post-Click Optimization: Why Offline Conversion Tracking Will Make or Break Your Campaigns</h2>\n<p>For e-commerce, success is fairly easy to measure. A click becomes a sale, and you can calculate return on ad spend directly.</p>\n<p>Lead generation is harder. Many advertisers track clicks to leads and stop there. But a lead isn't a sale.</p>\n<p>Dustin is increasingly convinced that offline conversion tracking will make or break lead generation campaigns going forward. That means tracking past the form fill:</p>\n<ul><li>Was the lead qualified or unqualified?</li><li>Did it turn into a real sales conversation?</li><li>Did it close, and for how much revenue?</li></ul>\n<p>Then that data gets passed back to the ad platform.</p>\n<h3>Why Feeding Data Back to Google Matters</h3>\n<p>Platforms like Google rely on conversion signals to optimize. If all they see is “a lead was submitted,” they'll chase more leads, including low-quality ones. When you feed back qualified-lead and revenue data, the algorithm learns what a valuable customer looks like and finds more of them.</p>\n<p>By connecting ad data to the CRM, you can see which keywords and locations aren't just producing leads but are producing people who talk to your sales reps, have good conversations and buy.</p>\n<p>As Dustin puts it, if you can't feed that data to the ad platforms, they won't be as smart, and they won't bring in the most effective clicks and leads.</p>\n<h2>Build Time vs. Ongoing Management: Where the Real Work Happens</h2>\n<p>So how much time does good Google Ads management take?</p>\n<p>A thorough campaign build, with strategy, structure and setup dialed in, takes about 15 to 20 hours.</p>\n<p>The ongoing management never ends. Over the first year, Dustin estimates the initial build makes up only about 1% of the total effort. The other 99% is fine-tuning, analysis and being obsessed with the data.</p>\n<p>This is exactly where many advertisers go wrong. They put all their energy into the build, step away, and then wonder why the campaigns aren't working. The problem isn't effort. It's spending that effort in the wrong place.</p>\n<h2>Why Agencies and Brands Choose White Label Google Ads Management</h2>\n<p>For agencies serving clients, and brands running their own advertising, this creates a real capacity problem. Good Google Ads management needs two things that are hard to find in-house:</p>\n<ul><li><strong>Deep platform expertise:</strong> someone who knows the many levers inside Google Ads and how they affect each other.</li><li><strong>Consistent ongoing time</strong> for search term reviews, bid management, landing page and conversion checks, and analysis across channels.</li></ul>\n<p>That's why many agencies choose a <a href=\"/white-label-ppc-management\">white label Google Ads partner</a>. Agencies can offer their clients expert paid search management without hiring, training and keeping a specialist team in-house.</p>\n<h2>The Bottom Line: Google Ads Success Takes Time and Expertise</h2>\n<p>Dustin's closing advice is blunt. A one-off build, or a campaign nobody actively manages, is almost guaranteed to fail.</p>\n<p>Real results take time to build the campaigns and even more time to manage them, analyze the data and connect the dots between clicks, leads and revenue.</p>\n<p>If you want your clients, or your own business, to succeed with Google Ads over the long term, you need to put in that time or partner with someone who will.</p>\n<h2>Watch the Full Episode and Book a Discovery Call</h2>\n<p>This post covers the highlights, but there's more in the full conversation. <a href=\"https://youtu.be/8u1T_TsyxPc\" target=\"_blank\" rel=\"noopener noreferrer\">Watch the full episode of the EIC Podcast</a> to hear Dustin's insights straight from someone who has spent more than 12 years in Google Ads.</p>\n<p>Ready to talk about your account? <a href=\"/eic-schedule-demo\">Book a free 30-minute discovery call</a> with the EIC team. We'll dig into your challenges, answer your questions and help you work out whether a white label Google Ads partnership is right for you.</p>\n<h2>Listen to the EIC Podcast on Spotify</h2>\n<iframe style=\"border-radius:12px\" src=\"https://open.spotify.com/embed/episode/7ggmnV3DJf5m1yQ2cvqurA?utm_source=generator\" width=\"100%\" height=\"352\" frameborder=\"0\" allowfullscreen=\"\" allow=\"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture\" loading=\"lazy\" title=\"Google Ads management episode on Spotify\"></iframe>\n<p><a href=\"https://open.spotify.com/episode/7ggmnV3DJf5m1yQ2cvqurA?si=PAyuIZf9RT258wl_RzOuug\" target=\"_blank\" rel=\"noopener noreferrer\">Open this episode in Spotify</a>.</p>\n</div>",
  originalUrl: "https://eic.agency/resources/google-ads-management-white-label",
  youtubeId: "8u1T_TsyxPc",
  primaryQuery: "Google Ads management",
  cluster: "agency-growth-and-fulfillment",
  relatedSlugs: ["hiring-vs-white-label-paid-media", "eic-scaling-digital-advertising-budgets", "building-the-best-marketing-dashboard"],
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

export const resourcePosts: ResourcePost[] = ([
  googleAdsWhiteLabelResourcePost,
  hiringVsWhiteLabelResource,
  ...(resources as ResourcePost[]),
] as ResourcePost[]).map((post) => {
  const override = resourceSeoOverrides[post.slug] ?? {};
  return {
    ...post,
    ...override,
    bodyHTML: applyResourceBodyReplacements(
      normalizeResourceBodyHTML(override.bodyHTML ?? post.bodyHTML),
      override.bodyReplacements,
    ),
  };
});

export function getResourcePost(slug: string) {
  return resourcePosts.find((post) => post.slug === slug);
}

export function getFeaturedResources(limit = 3) {
  return resourcePosts.slice(0, limit);
}

export function getRelatedResources(slug: string, limit = 2) {
  const currentPost = getResourcePost(slug);
  if (!currentPost) return resourcePosts.slice(0, limit);

  const explicitRelated = (currentPost.relatedSlugs ?? [])
    .map(getResourcePost)
    .filter((post): post is ResourcePost => Boolean(post));
  if (explicitRelated.length >= limit) return explicitRelated.slice(0, limit);

  const clusterEntry = Object.entries(resourceClusters).find(([, slugs]) =>
    (slugs as readonly string[]).includes(slug),
  );
  const clusterRelated = clusterEntry
    ? (clusterEntry[1] as readonly string[])
        .filter((relatedSlug) => relatedSlug !== slug && !explicitRelated.some((post) => post.slug === relatedSlug))
        .map(getResourcePost)
        .filter((post): post is ResourcePost => Boolean(post))
    : [];
  const related = [...explicitRelated, ...clusterRelated];
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
