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

const pricingWhiteLabelPaidMediaResource: ResourcePost = {
  title: "How to Price White Label PPC Services Without Killing Your Agency's Margin",
  seoTitle: 'How to Price White Label PPC for Profit | EIC',
  slug: 'pricing-white-label-paid-media',
  description:
    'Learn how to price white label PPC services the right way. Account for hidden agency costs, set a margin goal, and use a simple formula to protect profit.',
  publishedAt: '2026-10-22T12:00:00.000Z',
  updatedAt: '2026-10-22T12:00:00.000Z',
  imageUrl: '/resources/assets/pricing-white-label-paid-media.svg',
  imageAltText: 'How to price white label PPC services for a healthy agency margin',
  categories: [],
  bodyHTML: `<div class="blog-html" id="blogPostContent">
<p>Adding paid media to your agency's offerings is one of the fastest ways to grow recurring revenue. White labeling makes it even easier: you don't have to hire, train or manage a dedicated ad manager, and you can start selling PPC to your clients almost immediately.</p>
<p>But there's a trap many agency owners fall into. They take the white label partner's monthly fee, add a markup, and call it a day. On paper, it looks like easy money. In practice, the hours spent selling, communicating, reviewing reports and troubleshooting quietly eat away at the profit until the service barely pays for itself.</p>
<p>In this episode of the EIC Podcast, Mike Patterson and Dustin break down exactly how to price white label PPC so it adds both revenue and profit. Here's what agency owners need to know.</p>
<h2>Why “Just Mark It Up” Is the Wrong Way to Price White Label PPC</h2>
<p>As an agency owner, you already know your time is money. You run a service-based business, and every hour you or your team spend on an account has a cost.</p>
<p>When you white label paid media, your partner handles the heavy lifting: building campaigns, managing ads and producing reporting. But you still own the client relationship, and that relationship takes time. If you don't factor that time into your price, you're essentially giving it away for free.</p>
<p>The goal isn't simply to add a new line item to your invoices. It's to make sure every white label PPC client is genuinely profitable for your agency.</p>
<h2>The Hidden Cost Buckets Agency Owners Overlook</h2>
<p>Before you set a price, map out every place your agency's time will go. These are the buckets that most often get underestimated:</p>
<ul>
<li><strong>Selling time.</strong> Winning a new PPC client takes discovery calls, proposals, follow-ups and negotiation. That time is a real cost of acquiring the account.</li>
<li><strong>Client communication.</strong> Once the client signs, there's an ongoing stream of emails, Slack messages and check-ins. Someone at your agency has to manage it.</li>
<li><strong>Reviewing and presenting results.</strong> Your white label partner may supply the reporting, but unless they have a client-facing person working directly with your client, you'll need to review those results, interpret them and present them yourself.</li>
<li><strong>Meetings.</strong> Joining or running monthly and quarterly client meetings adds up quickly across multiple accounts.</li>
<li><strong>Creative coordination.</strong> Many white label PPC partners, including EIC, build and launch ads but don't create raw creative assets. Sourcing images, video and copy from the client (or producing them) and getting them to your partner is time your agency absorbs.</li>
<li><strong>Approvals.</strong> Ad copy, budgets, landing pages and campaign changes often need client sign-off, and you're usually the one chasing it.</li>
<li><strong>Answering questions and troubleshooting.</strong> This is often the biggest and least predictable bucket. Clients have questions, issues come up, and someone has to sort them out. Budget generously here.</li>
<li><strong>Tools and technology.</strong> Don't forget the software you use to deliver the service, such as Slack, project management tools or reporting platforms.</li>
</ul>
<h2>Start With a Margin Goal, Not a Markup</h2>
<p>The smartest way to price white label PPC is to work backward from the margin you want to achieve.</p>
<p>At EIC, the team sets a target margin on delivered work. This isn't the overall profit margin of the agency. It's the margin on each service being delivered, which tells you whether that work is running healthy.</p>
<p>To get there, you need three numbers:</p>
<ul>
<li><strong>Your white label partner's fee:</strong> what you pay each month for the service.</li>
<li><strong>Your tool costs:</strong> any technology needed to fulfill the work.</li>
<li><strong>Your labor cost:</strong> the hours your team spends per month on the buckets above, multiplied by your loaded hourly rate.</li>
</ul>
<p>Add those together, and you have your total delivery cost.</p>
<h2>The White Label PPC Pricing Formula</h2>
<p>Once you know your total delivery cost and your margin goal, the pricing formula is simple:</p>
<blockquote><p><strong>Client price = Total delivery cost ÷ (1 − margin goal)</strong></p></blockquote>
<p>So if you want a 50% margin, you divide your delivery cost by 0.5. If you want a 40% margin, you divide by 0.6.</p>
<h2>A Real-World Example: Why $2,000 Might Not Be Enough</h2>
<p>Here's how the math works in practice.</p>
<ul>
<li><strong>White label PPC partner fee:</strong> $1,000 per month</li>
<li><strong>Your agency's time:</strong> 4 hours per month at $75/hour = $300</li>
<li><strong>Total delivery cost:</strong> $1,300 per month</li>
</ul>
<p>Say you charge the client $2,000 per month. That feels like a healthy markup, almost double the partner fee.</p>
<p>But your gross profit is $2,000 − $1,300 = $700, and your gross margin is $700 ÷ $2,000 = 35%.</p>
<p>If your margin goal is 50%, the price should be $1,300 ÷ (1 − 0.50) = $2,600 per month.</p>
<p>That $600 gap is the difference between a service that looks profitable and one that actually is. Here's how the required price changes at different margin goals, using the same $1,300 delivery cost:</p>
<ul>
<li><strong>40% margin goal:</strong> $2,167 per month</li>
<li><strong>50% margin goal:</strong> $2,600 per month</li>
<li><strong>60% margin goal:</strong> $3,250 per month</li>
</ul>
<p>Knowing your target margin directly determines what you should be charging.</p>
<h2>Use a Setup Fee to Protect Your Margin Early</h2>
<p>Most agencies lose margin in the first few months of a new engagement. Onboarding, account setup, kickoff calls, gathering creative and coordinating with your white label partner all take far more time up front than they will once the account is running smoothly.</p>
<p>A setup fee is one of the best ways to offset this. Instead of absorbing those early hours into the monthly fee, you can recover the cost of winning the client, getting them across the finish line and handling the initial coordination. That keeps your monthly pricing clean and protects your margin from day one.</p>
<h2>Don't Forget Scope and Add-Ons</h2>
<p>Scope creep is a margin killer. Before you sign a PPC client, define exactly what the recurring scope includes, whether that's the number of campaigns, platforms, reporting cadence or meetings per month.</p>
<p>Anything outside that scope should be treated as an add-on with its own price. New platforms, additional creative, landing page work or extra strategy sessions all take time, and your pricing should reflect that.</p>
<h2>Your Pre-Pricing Checklist for White Label PPC</h2>
<p>Before you accept your next PPC client, make sure you can answer each of these:</p>
<ul>
<li>What is my margin goal on this service?</li>
<li>What does my white label partner charge to fulfill it?</li>
<li>How many hours will my team spend each month, and what is our loaded hourly cost?</li>
<li>What exactly is the recurring scope of the engagement?</li>
<li>Should I charge a setup fee to cover selling and onboarding time?</li>
<li>Have I accounted for troubleshooting and back-end support?</li>
<li>How will I price add-ons and out-of-scope requests?</li>
</ul>
<p>If you can answer all seven, you're ready to price the service with confidence.</p>
<h2>The Bottom Line: Grow Revenue and Profit</h2>
<p>White labeling paid media can be a powerful growth lever for your agency. It adds recurring revenue, deepens client relationships and expands what you can offer without the overhead of building an in-house PPC team.</p>
<p>But revenue alone isn't the goal. By accounting for your hidden time costs, pricing from a margin goal and using setup fees to protect your early-stage margin, you can make sure every white label PPC client is a profitable one.</p>
<h2>Watch the Full Episode and Talk to EIC</h2>
<p>Want to hear Mike and Dustin walk through this in more detail? <a href="https://youtu.be/iT3F-LboHro" target="_blank" rel="noopener noreferrer">Watch the full episode of the EIC Podcast on YouTube</a>.</p>
<p>For more strategies on white labeling paid media, visit the <a href="/resources">EIC resources library</a>, where we've covered topics like <a href="/resources/hiring-vs-white-label-paid-media">hiring a dedicated media buyer versus white labeling</a>.</p>
<p>Ready to explore adding white label PPC to your agency? <a href="/eic-schedule-demo">Book a discovery call with the EIC team</a>. We'll dig into what you're looking to offer, the exact scope of service and how to price it for healthy margins.</p>
<h2>Listen to the Episode on Spotify</h2>
<iframe style="border-radius:12px" src="https://open.spotify.com/embed/episode/5akyqFo19t33hyw1fE5OoL?utm_source=generator" width="100%" height="232" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="How to Price White Label PPC Services on Spotify"></iframe>
<p><a href="https://open.spotify.com/episode/5akyqFo19t33hyw1fE5OoL?si=IZDwJUtRRg2VOjIvYegIgw" target="_blank" rel="noopener noreferrer">Open this episode in Spotify</a>.</p>
</div>`,
  originalUrl: 'https://eic.agency/resources/pricing-white-label-paid-media',
  youtubeId: 'iT3F-LboHro',
  primaryQuery: 'white label PPC pricing',
  cluster: 'agency-growth-and-fulfillment',
  relatedSlugs: [
    'hiring-vs-white-label-paid-media',
    'eic-media-plans-adding-500k-revenue',
    'eic-agency-creating-an-effective-marketing-offer',
  ],
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
  pricingWhiteLabelPaidMediaResource,
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
