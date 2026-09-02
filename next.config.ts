import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Static assets in /public (logos, team photos, proof/dashboard screenshots, etc.)
        // are served with no cache-control by default, forcing a re-fetch on every visit.
        // These are fingerprint-free but rarely change, so a long max-age + must-revalidate
        // (browser will still check freshness before serving stale) covers the "efficient
        // cache lifetimes" Lighthouse flag without risking a stuck-stale asset.
        source: '/:path*.(jpg|jpeg|png|webp|avif|svg|gif|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, must-revalidate' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      {
        source: '/about-us-8540',
        destination: '/about-us',
        permanent: true,
      },
      { source: '/contact', destination: '/eic-schedule-demo', permanent: true },
      { source: '/contact-7506', destination: '/eic-schedule-demo', permanent: true },
      { source: '/schedule-demo', destination: '/eic-schedule-demo', permanent: true },
      { source: '/schedule-demo-5528', destination: '/eic-schedule-demo', permanent: true },
      { source: '/faq-4038', destination: '/faq', permanent: true },
      { source: '/post/:slug', destination: '/resources/:slug', permanent: true },
      {
        source: '/metrics-to-track-download',
        destination: '/resources/b2b-advertising-metrics-that-matter',
        permanent: true,
      },
      {
        source: '/roi-calculator-9280',
        destination: '/resources/eic-agency-calculating-profitable-roi',
        permanent: true,
      },
      { source: '/thankyou', destination: '/thankyou-schedule', permanent: true },
      {
        source: '/resources/author/6733ded6545474bf7bec4cdc',
        destination: '/resources',
        permanent: true,
      },
      { source: '/resources/category/click-and-mortar', destination: '/resources', permanent: true },
      { source: '/resources/category/b2b', destination: '/resources', permanent: true },
    ];
  },
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    '/api/dashboard/spartaco/pdf': ['node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
