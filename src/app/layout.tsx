import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EIC Agency',
  description: 'High-End B2B Lead Gen & Client Analytics',
  icons: {
    icon: [
      { url: '/eic-favicon.ico', sizes: 'any' },
      { url: '/eic-favicon.svg', type: 'image/svg+xml' },
      { url: '/eic-favicon-256.png', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/eic-favicon.ico',
    apple: '/eic-favicon-256.png',
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
