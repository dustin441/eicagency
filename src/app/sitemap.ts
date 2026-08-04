import type { MetadataRoute } from 'next';
import { caseStudies } from '@/lib/case-studies';
import { resourcePosts } from '@/lib/resources';

const siteUrl = 'https://eic.agency';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/about-us`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/case-studies`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/resources`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/eic-schedule-demo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/data-deletion`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const caseStudyRoutes: MetadataRoute.Sitemap = caseStudies.map((study) => ({
    url: `${siteUrl}/case-studies/${study.slug}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const resourceRoutes: MetadataRoute.Sitemap = resourcePosts.map((post) => ({
    url: `${siteUrl}/resources/${post.slug}`,
    lastModified: post.updatedAt || post.publishedAt || undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...caseStudyRoutes, ...resourceRoutes];
}
