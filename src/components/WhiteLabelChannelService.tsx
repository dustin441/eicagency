import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';
import { breadcrumbSchema, serializeJsonLd, SITE_URL } from '@/lib/seo';

export type ChannelService = {
  slug: string;
  name: string;
  eyebrow: string;
  introduction: string;
  principle: string;
  deliverables: string[];
  readiness: string;
  inputs: string[];
  steps: Array<{ title: string; copy: string; output: string }>;
  measurement: string[];
  scope: string[];
  evidence: { title: string; copy: string; href: string };
  resources: Array<{ title: string; href: string }>;
  questions: Array<{ question: string; answer: string }>;
  other: { name: string; href: string };
};

export default function WhiteLabelChannelService({ service }: { service: ChannelService }) {
  const path = `/${service.slug}`;
  const schemas = [
    {
      '@context': 'https://schema.org', '@type': 'Service', '@id': `${SITE_URL}${path}#service`,
      name: service.name, description: service.introduction, url: `${SITE_URL}${path}`,
      provider: { '@type': 'Organization', name: 'EIC Agency', url: SITE_URL },
      audience: { '@type': 'BusinessAudience', audienceType: 'Marketing agencies' },
      areaServed: 'US', serviceType: service.name,
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: service.questions.map(({ question, answer }) => ({
      '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
    })) },
    { '@context': 'https://schema.org', ...breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'White Label PPC Management', path: '/white-label-ppc-management' },
      { name: service.name, path },
    ]) },
  ];
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schemas) }} />
      <MarketingHeader />
      <section className="px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-600">
            <Link className="underline" href="/">Home</Link><span aria-hidden="true">/</span>
            <Link className="underline" href="/white-label-ppc-management">White Label PPC Management</Link><span aria-hidden="true">/</span>
            <span aria-current="page">{service.name}</span>
          </nav>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#a73510]">{service.eyebrow}</p>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-6xl">{service.name} for Agencies</h1>
              <p className="mt-7 text-lg leading-8 text-slate-600">{service.introduction}</p>
              <Link href="/eic-schedule-demo" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-forest px-7 py-4 font-bold text-white">Review a first account <ArrowRight aria-hidden="true" className="h-5 w-5" /></Link>
            </div>
            <aside className="rounded-[2rem] bg-brand-forest p-7 text-white sm:p-10">
              <h2 className="text-2xl font-semibold">{service.principle}</h2>
              <ul className="mt-7 space-y-5">{service.deliverables.map(item => <li key={item} className="flex gap-3 leading-7"><CheckCircle2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-[#ffad85]" /><span>{item}</span></li>)}</ul>
            </aside>
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div><p className="text-sm font-bold uppercase tracking-widest text-[#a73510]">Before we build</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-brand-forest sm:text-4xl">Readiness before media spend.</h2><p className="mt-6 leading-8 text-slate-600">{service.readiness}</p></div>
          <div><h3 className="text-2xl font-semibold text-brand-forest">Bring these inputs to the account review</h3><ul className="mt-6 space-y-4">{service.inputs.map(item => <li key={item} className="border-l-2 border-brand-orange pl-4 leading-7 text-slate-600">{item}</li>)}</ul></div>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-widest text-[#a73510]">Channel delivery workflow</p><h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-brand-forest sm:text-4xl">From the account diagnosis to the next documented decision.</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-2">{service.steps.map((step, index) => <li key={step.title} className="rounded-[2rem] border border-brand-forest/10 bg-white p-7 sm:p-8"><p className="font-bold text-[#a73510]">Step {index + 1}</p><h3 className="mt-3 text-2xl font-semibold text-brand-forest">{step.title}</h3><p className="mt-4 leading-8 text-slate-600">{step.copy}</p><p className="mt-5 border-t border-brand-forest/10 pt-5 text-sm leading-7 text-slate-700"><strong>Decision record:</strong> {step.output}</p></li>)}</ol>
        </div>
      </section>
      <section className="bg-brand-forest px-5 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-sm font-bold uppercase tracking-widest text-[#ffad85]">Reporting and approvals</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Give your agency the evidence, not just a platform export.</h2></div><div className="space-y-5">{service.measurement.map(item => <p className="leading-8 text-white/80" key={item}>{item}</p>)}</div></div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2"><div><p className="text-sm font-bold uppercase tracking-widest text-[#a73510]">Scope boundaries</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-brand-forest sm:text-4xl">Management is not an unlimited implementation package.</h2><p className="mt-6 leading-8 text-slate-600">Account review, approved campaign builds, optimization, conversion QA, and client-ready updates form the management workflow. Confirm channels, creative deliverables, access, approval owners, and reporting cadence before launch. The following depend on the account and a separately agreed scope:</p><ul className="mt-6 list-disc space-y-4 pl-5 text-slate-600">{service.scope.map(item => <li key={item} className="leading-7">{item}</li>)}</ul></div>
          <aside className="self-start rounded-[2rem] bg-[#f7f4ef] p-7 sm:p-9"><p className="text-sm font-bold uppercase tracking-widest text-[#a73510]">Published process evidence</p><h3 className="mt-4 text-2xl font-semibold text-brand-forest">{service.evidence.title}</h3><p className="mt-5 leading-8 text-slate-600">{service.evidence.copy}</p><Link href={service.evidence.href} className="mt-6 inline-flex items-center gap-2 font-bold text-brand-forest underline">Read the case study <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><p className="mt-5 text-sm leading-7 text-slate-600">This is an account-specific example, not a forecast or a claim that every engagement includes the same implementation.</p></aside>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]"><h2 className="text-3xl font-semibold tracking-tight text-brand-forest sm:text-4xl">Questions before you add this service.</h2><div className="space-y-4">{service.questions.map(item => <details key={item.question} className="rounded-2xl border border-brand-forest/15 bg-white p-6"><summary className="cursor-pointer text-xl font-semibold text-brand-forest">{item.question}</summary><p className="mt-4 leading-8 text-slate-600">{item.answer}</p></details>)}</div></div></section>
      <section className="bg-white px-5 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-semibold text-brand-forest">Evaluate the delivery model.</h2><div className="mt-8 grid gap-4 md:grid-cols-2">{[...service.resources, { title: 'Ownership, onboarding, and cross-channel PPC fulfillment', href: '/white-label-ppc-management' }, { title: service.other.name, href: service.other.href }].map(item => <Link key={item.href} href={item.href} className="flex items-center justify-between gap-4 rounded-2xl border border-brand-forest/15 p-6 font-semibold text-brand-forest hover:bg-[#f7f4ef]">{item.title}<ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" /></Link>)}</div></div></section>
      <section className="px-5 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl rounded-[2rem] bg-brand-forest p-8 text-white sm:p-12"><h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Bring one real client account. Map the next defensible step.</h2><p className="mt-5 max-w-3xl leading-8 text-white/80">Share the offer, account history, budget, approved assets, conversion path, and sales constraints. We can assess whether the right starting point is a launch, a rebuild, or a readiness sprint. Your agency retains the client relationship and final approvals.</p><Link href="/eic-schedule-demo" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#a73510] px-7 py-4 font-bold text-white">Book an account review <ArrowRight aria-hidden="true" className="h-5 w-5" /></Link></div></section>
    </main>
  );
}
