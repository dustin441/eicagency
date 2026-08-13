import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, CheckCircle2 } from 'lucide-react';
import { caseStudies } from '@/lib/case-studies';
import MarketingHeader from '@/components/MarketingHeader';
import { SITE_URL, SOCIAL_IMAGE, breadcrumbSchema, serializeJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Paid Media Case Studies',
  description:
    'See how EIC Agency uses business intelligence, campaign restructuring, tracking, and ongoing optimization to improve paid media performance.',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    title: 'Paid Media Case Studies | EIC Agency',
    description: 'Real paid media work, documented strategies, and measurable outcomes from EIC Agency.',
    url: '/case-studies',
    images: [SOCIAL_IMAGE],
  },
};

export default function CaseStudiesPage() {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/case-studies#webpage`,
        url: `${SITE_URL}/case-studies`,
        name: 'Paid Media Case Studies',
        description: metadata.description,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: caseStudies.map((study, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: study.title,
            url: `${SITE_URL}/case-studies/${study.slug}`,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Case Studies', path: '/case-studies' },
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
            <BarChart3 className="h-7 w-7" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Case studies</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">Believe the work.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
            Each story shows the challenge, the operating changes, and the measured results behind the headline.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {caseStudies.map((study) => (
            <article key={study.slug} className="group flex flex-col overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10">
              <img src={study.image} alt={`${study.client} case study`} className="aspect-[4/3] w-full object-cover" />
              <div className="flex flex-1 flex-col p-7">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">{study.client} · {study.industry}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-brand-forest">{study.title}</h2>
                <p className="mt-4 flex-1 leading-7 text-slate-600">{study.description}</p>
                <div className="mt-5 rounded-2xl border border-brand-forest/10 bg-white p-4 text-sm leading-6 text-slate-600">
                  <strong className="text-brand-forest">EIC’s role:</strong>{' '}
                  {study.solutions.slice(0, 3).map((solution) => solution.title).join(', ')}
                </div>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f7f4ef] p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-orange" />
                  <p className="text-sm font-semibold text-slate-700"><strong className="text-brand-forest">{study.primaryMetric}</strong> {study.primaryMetricLabel}</p>
                </div>
                <Link href={`/case-studies/${study.slug}`} className="mt-7 inline-flex items-center gap-2 font-bold text-brand-forest">
                  Read the case study
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:flex lg:items-center lg:justify-between lg:p-14">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Your clients, your brand</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Put this operating system behind your agency.</h2>
          </div>
          <Link href="/eic-schedule-demo" className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-4 font-bold text-white lg:mt-0">
            Start the conversation
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
