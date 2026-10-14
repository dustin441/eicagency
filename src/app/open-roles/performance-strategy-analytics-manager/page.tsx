import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, Mail, TrendingUp, WalletCards } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';
import { getOpenRole } from '@/lib/open-roles';
import { ORGANIZATION_ID, SITE_URL, SOCIAL_IMAGE, breadcrumbSchema, serializeJsonLd } from '@/lib/seo';

const role = getOpenRole('performance-strategy-analytics-manager')!;
const applyHref = 'mailto:info@eic.agency?subject=Performance%20Strategy%20%26%20Analytics%20Manager';

export const metadata: Metadata = {
  title: role.title,
  description: `${role.summary} ${role.commitment}.`,
  alternates: { canonical: `/open-roles/${role.slug}` },
  openGraph: {
    title: `${role.title} | EIC Agency`,
    description: role.summary,
    url: `/open-roles/${role.slug}`,
    images: [SOCIAL_IMAGE],
  },
};

export default function PerformanceStrategyAnalyticsManagerPage() {
  const pageUrl = `${SITE_URL}/open-roles/${role.slug}`;
  const roleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: role.title,
        description: role.summary,
        about: { '@id': ORGANIZATION_ID },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Open Roles', path: '/open-roles' },
        { name: role.title, path: `/open-roles/${role.slug}` },
      ]),
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(roleSchema) }} />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-brand-forest px-5 py-16 text-white sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <Link href="/open-roles" className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            All open roles
          </Link>
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">{role.eyebrow}</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">{role.title}</h1>
          <p className="mt-7 max-w-4xl text-xl leading-9 text-white/70">{role.summary}</p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <Clock3 className="h-5 w-5 text-brand-orange" />
              <p className="mt-3 text-sm font-semibold leading-6 text-white/80">{role.commitment}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <TrendingUp className="h-5 w-5 text-brand-orange" />
              <p className="mt-3 text-sm font-semibold leading-6 text-white/80">{role.growthPath}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <WalletCards className="h-5 w-5 text-brand-orange" />
              <p className="mt-3 text-sm font-semibold leading-6 text-white/80">{role.compensation}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <article className="space-y-14">
            {role.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-3xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-4xl">{section.title}</h2>
                {section.intro ? <p className="mt-5 text-lg leading-8 text-slate-600">{section.intro}</p> : null}
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-5 text-lg leading-8 text-slate-600">{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="mt-6 space-y-4">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-lg leading-8 text-slate-600">
                        <CheckCircle2 className="mt-1.5 h-5 w-5 shrink-0 text-brand-orange" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>

          <aside className="rounded-[2rem] bg-white p-7 shadow-xl shadow-brand-forest/10 lg:sticky lg:top-28">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-brand-forest">Ready to apply?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Include your resume and cover letter, with “Performance Strategy &amp; Analytics Manager” as the subject line.
            </p>
            <a href={applyHref} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-3.5 font-bold text-white transition-transform hover:-translate-y-0.5">
              <Mail className="h-5 w-5" />
              Email your application
            </a>
            <p className="mt-4 text-center text-sm font-semibold text-slate-500">info@eic.agency</p>
          </aside>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:flex lg:items-center lg:justify-between lg:p-14">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Join EIC Agency</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Help turn strong judgment into better client outcomes.</h2>
          </div>
          <a href={applyHref} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-4 font-bold text-white lg:mt-0">
            Apply by email
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>
    </main>
  );
}
