import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { caseStudies, getCaseStudy } from '@/lib/case-studies';

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return caseStudies.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};

  return {
    title: `${study.client} Paid Media Case Study`,
    description: study.description,
    alternates: { canonical: `/case-studies/${study.slug}` },
    openGraph: {
      title: `${study.title} | EIC Agency`,
      description: study.description,
      url: `/case-studies/${study.slug}`,
      type: 'article',
      images: [{ url: study.image, alt: `${study.client} case study` }],
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <nav className="border-b border-white/10 bg-brand-forest text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="EIC Agency home">
            <img src="/logo-white.svg" alt="EIC Agency" className="h-11 w-auto" />
          </Link>
          <Link href="/case-studies" className="inline-flex items-center gap-2 text-sm font-bold text-white/75 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            All case studies
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-brand-forest px-5 pb-20 pt-16 text-white sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">{study.client} case study</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">{study.title}</h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-white/70">{study.description}</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-white/70">
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">{study.industry}</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">Paid media + business intelligence</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/20">
            <img src={study.image} alt={`${study.client} case study`} className="aspect-square w-full rounded-[1.5rem] object-cover" />
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-10 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[1.75rem] bg-brand-orange p-6 text-white shadow-xl shadow-brand-orange/20">
            <p className="text-4xl font-semibold tracking-[-0.05em]">{study.primaryMetric}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/85">{study.primaryMetricLabel}</p>
          </div>
          {study.metrics.map((metric) => (
            <div key={metric.label} className="rounded-[1.75rem] border border-brand-forest/10 bg-white p-6 shadow-sm">
              <p className="text-4xl font-semibold tracking-[-0.05em] text-brand-forest">{metric.value}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Initial challenge</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">What was holding growth back.</h2>
          </div>
          <div className="space-y-4">
            {study.challenges.map((challenge) => (
              <div key={challenge} className="flex gap-4 rounded-[1.5rem] border border-brand-forest/10 bg-white p-6 shadow-sm">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-sm font-bold text-brand-orange">!</span>
                <p className="leading-7 text-slate-700">{challenge}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Solutions implemented</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-brand-forest sm:text-5xl">The operating changes behind the result.</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {study.solutions.map((solution, index) => (
              <article key={solution.title} className="rounded-[2rem] border border-brand-forest/10 bg-[#f7f4ef] p-7">
                <span className="text-4xl font-semibold tracking-[-0.04em] text-brand-orange/40">0{index + 1}</span>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{solution.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{solution.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="rounded-[2rem] bg-brand-forest p-8 text-white lg:sticky lg:top-8">
            <TrendingUp className="h-9 w-9 text-brand-orange" />
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Highlighted results</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">Better visibility. Better decisions. Better outcomes.</h2>
          </div>
          <div className="space-y-5">
            {study.results.map((result) => (
              <div key={result} className="flex gap-4 rounded-[1.75rem] border border-brand-forest/10 bg-white p-7 shadow-sm">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-brand-orange" />
                <p className="text-lg leading-8 text-slate-700">{result}</p>
              </div>
            ))}
            <div className="rounded-[1.75rem] border border-brand-orange/20 bg-brand-orange/5 p-7">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">Conclusion</p>
              <p className="mt-4 text-lg leading-8 text-slate-700">{study.conclusion}</p>
            </div>
            <p className="px-2 text-xs leading-5 text-slate-500">Results are drawn from EIC’s source case study for the period described. Individual results vary and are not a guarantee of future performance.</p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:p-14">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Ready to build your next case study?</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Add paid media to your agency without adding overhead.</h2>
          </div>
          <Link href="/eic-schedule-demo" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-orange px-6 py-4 font-bold text-white">
            Schedule a call
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
