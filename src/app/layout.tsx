import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const gtmId = 'GTM-WK4CVLC';

const siteTitle = 'White Label Paid Media for B2B Agencies | EIC Agency';
const siteDescription =
  'EIC Agency helps agencies add high-end B2B lead generation, paid media execution, and client-ready analytics without hiring an in-house media team.';
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
        alt: 'EIC Agency white label paid media for B2B agencies',
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
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
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
