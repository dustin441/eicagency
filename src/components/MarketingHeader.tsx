'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type NavigationLink = {
  href: string;
  label: string;
  description?: string;
};

type NavigationItem =
  | NavigationLink
  | {
      label: string;
      links: NavigationLink[];
    };

const navigationItems: NavigationItem[] = [
  {
    label: 'Services',
    links: [
      {
        href: '/white-label-ppc-management',
        label: 'White Label PPC Management',
        description: 'Strategy, creative, campaign execution, and reporting under your agency brand.',
      },
      {
        href: '/#who-we-partner-with',
        label: 'Who We Partner With',
        description: 'See which agency models and client situations EIC is built to support.',
      },
      {
        href: '/#pricing',
        label: 'Pricing',
        description: 'Compare the available white-label paid media fulfillment tiers.',
      },
    ],
  },
  { href: '/#how-it-works', label: 'How It Works' },
  {
    label: 'Results',
    links: [
      {
        href: '/case-studies',
        label: 'Case Studies',
        description: 'Documented strategies, operating changes, and measured client outcomes.',
      },
      {
        href: '/#proof',
        label: 'Proof and Testimonials',
        description: 'See dashboards, client feedback, and the evidence behind the work.',
      },
    ],
  },
  {
    label: 'Resources',
    links: [
      {
        href: '/resources',
        label: 'Resource Library',
        description: 'Paid media guides, agency frameworks, interviews, and topic collections.',
      },
      {
        href: '/faq',
        label: 'Frequently Asked Questions',
        description: 'Answers about ownership, channels, creative, reporting, and onboarding.',
      },
    ],
  },
  { href: '/about-us', label: 'About' },
];

function isNavigationGroup(item: NavigationItem): item is Extract<NavigationItem, { links: NavigationLink[] }> {
  return 'links' in item;
}

function pathIsActive(pathname: string, href: string) {
  const path = href.split('#')[0] || '/';
  return path === '/' ? pathname === '/' && !href.includes('#') : pathname === path;
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openDesktopGroup) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) setOpenDesktopGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDesktopGroup(null);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openDesktopGroup]);

  const closeNavigation = () => {
    setMobileMenuOpen(false);
    setOpenDesktopGroup(null);
    setOpenMobileGroup(null);
  };

  return (
    <nav ref={navigationRef} className="sticky top-0 z-50 border-b border-brand-forest/10 bg-[#f7f4ef]/95 text-slate-950 backdrop-blur-xl" aria-label="Main navigation">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="EIC Agency home">
          <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-10 w-auto sm:h-14" />
        </Link>

        <div className="hidden items-center gap-1 text-sm font-semibold text-slate-600 xl:flex">
          {navigationItems.map((item) => {
            if (!isNavigationGroup(item)) {
              const active = pathIsActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-2 transition-colors hover:bg-white hover:text-brand-forest ${active ? 'bg-white text-brand-forest shadow-sm' : ''}`}
                >
                  {item.label}
                </Link>
              );
            }

            const open = openDesktopGroup === item.label;
            const active = item.links.some((link) => pathIsActive(pathname, link.href));
            return (
              <div
                key={item.label}
                className="relative"
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setOpenDesktopGroup(item.label);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setOpenDesktopGroup(null);
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setOpenDesktopGroup(null);
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenDesktopGroup(open ? null : item.label)}
                  aria-haspopup="true"
                  aria-expanded={open}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-2 transition-colors hover:bg-white hover:text-brand-forest ${active ? 'bg-white text-brand-forest shadow-sm' : ''}`}
                >
                  {item.label}
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open ? (
                  <div className="absolute left-1/2 top-full w-[23rem] -translate-x-1/2 pt-3">
                    <div className="rounded-[1.5rem] border border-brand-forest/10 bg-white p-2 shadow-2xl shadow-brand-forest/15">
                      {item.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={closeNavigation}
                          className="block rounded-[1.1rem] px-4 py-3 transition-colors hover:bg-[#f7f4ef] focus:bg-[#f7f4ef] focus:outline-none"
                        >
                          <span className="block font-bold text-brand-forest">{link.label}</span>
                          {link.description ? <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{link.description}</span> : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
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
            onClick={() => {
              setMobileMenuOpen((open) => !open);
              setOpenMobileGroup(null);
            }}
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
            {navigationItems.map((item) => {
              if (!isNavigationGroup(item)) {
                const active = pathIsActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeNavigation}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-xl px-4 py-3 text-base font-semibold transition-colors hover:bg-brand-forest/10 hover:text-brand-forest ${active ? 'bg-brand-forest/10 text-brand-forest' : 'text-slate-700'}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              const open = openMobileGroup === item.label;
              return (
                <li key={item.label} className="rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOpenMobileGroup(open ? null : item.label)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold text-slate-700 transition-colors hover:bg-brand-forest/10 hover:text-brand-forest"
                  >
                    {item.label}
                    <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <ul className="mb-2 ml-4 border-l border-brand-forest/15 pl-3">
                      {item.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={closeNavigation}
                            className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-brand-forest"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-2 border-t border-brand-forest/10 pt-4 lg:hidden">
            <Link
              href="/login"
              onClick={closeNavigation}
              className="rounded-xl px-4 py-3 text-base font-semibold text-slate-600 transition-colors hover:bg-brand-forest/10 hover:text-brand-forest"
            >
              Client login
            </Link>
            <Link
              href="/eic-schedule-demo"
              onClick={closeNavigation}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-5 py-3 text-sm font-bold text-white sm:hidden"
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
