import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  children: ReactNode;
};

export default function LegalPageLayout({
  eyebrow,
  title,
  intro,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <header className="border-b border-brand-forest/10 bg-white/80 px-5 py-5 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Link href="/" aria-label="EIC Agency home" className="block w-20">
            <img src="/logo.svg" alt="EIC Agency" className="h-auto w-full" />
          </Link>
          <Link
            href="/"
            className="text-sm font-bold text-brand-forest transition-colors hover:text-brand-orange"
          >
            Back to home
          </Link>
        </div>
      </header>

      <section className="border-b border-brand-forest/10 px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-orange">{eyebrow}</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{intro}</p>
          <p className="mt-5 text-sm font-semibold text-slate-500">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <article className="px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="legal-content mx-auto max-w-4xl space-y-10 text-base leading-8 text-slate-700">
          {children}
        </div>
      </article>

      <footer className="border-t border-brand-forest/10 bg-white/60 px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} EIC Agency. Every impression counts.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="font-semibold transition-colors hover:text-brand-forest">
              Privacy Policy
            </Link>
            <Link href="/data-deletion" className="font-semibold transition-colors hover:text-brand-forest">
              Data Deletion
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
