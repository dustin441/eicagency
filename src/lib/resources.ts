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

export const resourcePosts: ResourcePost[] = (resources as ResourcePost[]).map((post) => {
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
