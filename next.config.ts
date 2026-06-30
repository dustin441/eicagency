import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
