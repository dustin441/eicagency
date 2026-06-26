import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
