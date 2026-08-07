'use client';

import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navigationLinks = [
  { href: '/white-label-ppc-management', label: 'White Label PPC' },
  { href: '/about-us', label: 'About Us' },
  { href: '/#who-we-partner-with', label: 'Who We Partner With' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#proof', label: 'Proof' },
  { href: '/case-studies', label: 'Case Studies' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/resources', label: 'Resources' },
  { href: '/faq', label: 'FAQ' },
];

export default function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/95 text-slate-950 backdrop-blur-xl" aria-label="Main navigation">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="EIC Agency home">
          <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-10 w-auto sm:h-14" />
        </Link>

        <div className="hidden items-center gap-5 text-[13px] font-semibold text-slate-600 xl:flex">
          {navigationLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="whitespace-nowrap transition-colors hover:text-brand-forest">
              {label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-brand-forest lg:inline-flex">
            Client login
          </Link>
          <Link
            href="/eic-schedule-demo"
            className="hidden items-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-forest/15 transition-transform hover:-translate-y-0.5 sm:inline-flex"
          >
            Become a partner
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-brand-forest/10 hover:text-brand-forest xl:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-brand-forest/10 bg-[#f7f4ef] px-5 pb-6 pt-4 xl:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigationLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-brand-forest/10 hover:text-brand-forest"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-2 border-t border-brand-forest/10 pt-4 sm:hidden">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-brand-forest/10 hover:text-brand-forest"
            >
              Client login
            </Link>
            <Link
              href="/eic-schedule-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white"
            >
              Become a partner
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
