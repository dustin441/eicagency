import resources from '@/content/resources.json';

export type ResourcePost = {
  title: string;
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
};

export const resourcePosts = resources as ResourcePost[];

export function getResourcePost(slug: string) {
  return resourcePosts.find((post) => post.slug === slug);
}

export function getFeaturedResources(limit = 3) {
  return resourcePosts.slice(0, limit);
}

export function formatResourceDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
