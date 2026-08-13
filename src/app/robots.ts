import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api', '/auth', '/login', '/forgot-password', '/reset-password'],
    },
    sitemap: 'https://eic.agency/sitemap.xml',
  };
}
