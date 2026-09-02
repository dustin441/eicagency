import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { organizationSchema, serializeJsonLd, websiteSchema } from '@/lib/seo';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const gtmId = 'GTM-WK4CVLC';

const siteTitle = 'White Label Paid Media for Marketing Agencies | EIC Agency';
const siteDescription =
  'Add white-label paid media to your marketing agency with campaign execution, creative production, live dashboards, and client-ready reporting under your brand.';
const siteUrl = 'https://eic.agency';
const socialImage = '/og-eic-white-label-paid-media.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s | EIC Agency',
  },
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'EIC Agency',
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: 'EIC Agency white label paid media for marketing agencies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=eic-logo-20260626', sizes: 'any' },
      { url: '/favicon.svg?v=eic-logo-20260626', type: 'image/svg+xml' },
      { url: '/favicon-256.png?v=eic-logo-20260626', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/favicon.ico?v=eic-logo-20260626',
    apple: '/apple-icon.png?v=eic-logo-20260626',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@graph': [organizationSchema, websiteSchema],
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.dataLayer = window.dataLayer || [];',
          }}
        />
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,i){
              function loadGTM(){
                if(w.__eicGtmLoaded) return;
                w.__eicGtmLoaded = true;
                w.dataLayer = w.dataLayer || [];
                w.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
                var j = d.createElement('script');
                j.async = true;
                j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
                d.head.appendChild(j);
              }

              function scheduleGTM(){
                if(w.__eicGtmScheduled) return;
                w.__eicGtmScheduled = true;
                if('requestIdleCallback' in w){
                  w.requestIdleCallback(loadGTM, { timeout: 1500 });
                } else {
                  w.setTimeout(loadGTM, 500);
                }
              }

              if(d.readyState === 'complete'){
                scheduleGTM();
              } else {
                w.addEventListener('load', scheduleGTM, { once: true });
              }
            })(window,document,'${gtmId}');
          `}
        </Script>
      </head>
      <body className={`${inter.className} antialiased`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
