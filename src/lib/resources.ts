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

export const resourcePosts: ResourcePost[] = (resources as ResourcePost[]).map((post) => {
  const override = resourceSeoOverrides[post.slug] ?? {};
  return {
    ...post,
    ...override,
    bodyHTML: normalizeResourceBodyHTML(override.bodyHTML ?? post.bodyHTML),
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
