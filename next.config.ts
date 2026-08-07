import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
