import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const gtmId = 'GTM-WK4CVLC';

export const metadata: Metadata = {
  title: 'EIC Agency',
  description: 'High-End B2B Lead Gen & Client Analytics',
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
