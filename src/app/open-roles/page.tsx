import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Clock3, TrendingUp } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';
import { openRoles } from '@/lib/open-roles';
import { SITE_URL, SOCIAL_IMAGE, breadcrumbSchema, serializeJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Open Roles',
  description: 'Explore open roles at EIC Agency and help build better paid media strategy, execution, measurement, and client outcomes.',
  alternates: { canonical: '/open-roles' },
  openGraph: {
    title: 'Open Roles | EIC Agency',
    description: 'Explore current opportunities to join EIC Agency.',
    url: '/open-roles',
    images: [SOCIAL_IMAGE],
  },
};

export default function OpenRolesPage() {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/open-roles#webpage`,
        url: `${SITE_URL}/open-roles`,
        name: 'Open Roles at EIC Agency',
        description: metadata.description,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: openRoles.map((role, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: role.title,
            url: `${SITE_URL}/open-roles/${role.slug}`,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Open Roles', path: '/open-roles' },
      ]),
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionSchema) }} />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-brand-forest px-5 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-brand-orange">
            <BriefcaseBusiness className="h-7 w-7" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Open roles</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">Do work that moves the work forward.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
            Join a hands-on team that connects paid media strategy, execution, measurement, and client outcomes.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-9">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Current opportunities</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">Find your next role at EIC.</h2>
          </div>

          <div className="space-y-6">
            {openRoles.map((role) => (
              <article key={role.slug} className="group rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">{role.eyebrow}</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-4xl">{role.title}</h3>
                <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-600">{role.summary}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f4ef] px-4 py-2 text-sm font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4 text-brand-orange" />
                    {role.commitment}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f4ef] px-4 py-2 text-sm font-semibold text-slate-700">
                    <TrendingUp className="h-4 w-4 text-brand-orange" />
                    {role.growthPath}
                  </span>
                </div>
                <Link href={`/open-roles/${role.slug}`} className="mt-8 inline-flex items-center gap-2 font-bold text-brand-forest">
                  View role details
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
