import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, CheckCircle2, FileSearch, Layers3, Palette, Search, ShieldCheck } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';

const siteUrl = 'https://eic.agency';

const deliverables = [
  {
    icon: FileSearch,
    title: 'Account audit and media plan',
    copy: 'We review the real account, audience, creative, conversion path, and measurement before recommending a launch or rebuild.',
  },
  {
    icon: Search,
    title: 'Campaign build and management',
    copy: 'EIC handles campaign structure, targeting, budgets, testing, optimization, and the day-to-day execution behind your offer.',
  },
  {
    icon: Palette,
    title: 'Creative production and testing',
    copy: 'Approved source assets become campaign-ready concepts, variations, and next tests tied to actual account performance.',
  },
  {
    icon: BarChart3,
    title: 'Client-ready reporting',
    copy: 'Live dashboards and weekly updates explain what changed, what the data says, and what the team is doing next.',
  },
];

const questions = [
  {
    question: 'Is white label PPC only for Google Ads?',
    answer: 'No. PPC often refers to paid search, but EIC can support Google, Meta, LinkedIn, YouTube, TikTok, and other channels when they fit the audience, offer, creative, and budget. The plan should follow the client goal rather than force every account into the same channel mix.',
  },
  {
    question: 'Can our agency sell the service under its own name?',
    answer: 'Yes. EIC is designed to operate behind your agency brand. Your agency controls the client agreement, owns the relationship, and stays the strategic point of contact.',
  },
  {
    question: 'Do we need to provide finished ad creative?',
    answer: 'No. Your agency and client provide approved brand assets, claims, offers, and source material. EIC can turn those inputs into campaign-ready creative and use performance evidence to guide the next variations.',
  },
  {
    question: 'What should we bring to the first call?',
    answer: 'Bring the types of agencies services you already sell, examples of clients asking for paid media, likely first accounts, and the operational questions that have kept you from offering the service. We will use that context to identify realistic next steps.',
  },
];

export const metadata: Metadata = {
  title: 'White Label PPC Management for Marketing Agencies',
  description: 'Add white-label PPC management to your agency with paid media strategy, campaign execution, creative production, live dashboards, and weekly reporting.',
  alternates: { canonical: '/white-label-ppc-management' },
  openGraph: {
    title: 'White Label PPC Management for Marketing Agencies | EIC Agency',
    description: 'Offer paid advertising under your agency brand without hiring a full in-house media team.',
    url: '/white-label-ppc-management',
    images: ['/og-eic-white-label-paid-media.png'],
  },
};

export default function WhiteLabelPpcManagementPage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${siteUrl}/white-label-ppc-management#service`,
    name: 'White Label PPC Management for Marketing Agencies',
    description: 'Behind-the-scenes paid media strategy, campaign management, creative production, dashboards, and client-ready reporting for marketing agencies.',
    provider: { '@type': 'Organization', name: 'EIC Agency', url: siteUrl },
    areaServed: 'US',
    audience: { '@type': 'BusinessAudience', audienceType: 'Marketing agencies' },
    url: `${siteUrl}/white-label-ppc-management`,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([serviceSchema, faqSchema]).replace(/</g, '\\u003c') }} />
      <MarketingHeader />

      <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-orange/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">White label PPC management</p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl">Add paid media to your agency without building the department yourself.</h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">EIC gives marketing agencies a behind-the-scenes team for paid media strategy, campaign execution, creative production, optimization, and client-ready reporting. You sell the relationship. We help deliver the work.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/eic-schedule-demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white">
                Book a free revenue gap audit
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/case-studies" className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-forest/15 bg-white px-7 py-4 font-bold text-brand-forest">
                Review case studies
              </Link>
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-brand-forest p-8 text-white shadow-2xl shadow-brand-forest/20 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Built for agency ownership</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Your client. Your brand. Your new service line.</h2>
            <div className="mt-7 space-y-4">
              {[
                'Your agency keeps the client relationship',
                'Campaign delivery happens behind your brand',
                'Creative and reporting are part of the operating system',
                'Senior paid media operators stay close to the work',
              ].map((item) => (
                <div key={item} className="flex gap-3 text-white/80">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">What EIC fulfills</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">The delivery pieces that turn paid media into a real agency offer.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {deliverables.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-[2rem] border border-brand-forest/10 bg-[#f7f4ef] p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">How the partnership works</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">From client request to repeatable fulfillment.</h2>
            <p className="mt-6 leading-8 text-slate-600">The goal is not to bolt a freelancer onto your agency. It is to create a clear operating model your team can sell, support, and scale.</p>
          </div>
          <ol className="space-y-4">
            {[
              ['01', 'Choose the right first account', 'We evaluate fit, budget, offer, assets, sales follow-up, and measurement readiness before recommending spend.'],
              ['02', 'Audit and plan the work', 'EIC reviews the account and creates a specific media plan, rather than applying a generic campaign template.'],
              ['03', 'Build under your agency brand', 'Campaigns, creative, dashboards, and communication support your agency’s relationship with the client.'],
              ['04', 'Optimize and explain what happens next', 'Ongoing testing is paired with weekly client-ready updates so performance and priorities remain visible.'],
            ].map(([number, title, copy]) => (
              <li key={number} className="grid gap-4 rounded-[2rem] border border-brand-forest/10 bg-white p-6 shadow-sm sm:grid-cols-[70px_1fr] sm:p-8">
                <span className="text-3xl font-semibold text-brand-orange">{number}</span>
                <div><h3 className="text-2xl font-semibold text-brand-forest">{title}</h3><p className="mt-3 leading-7 text-slate-600">{copy}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-brand-forest px-5 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Layers3 className="h-10 w-10 text-brand-orange" />
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Common questions about white label PPC.</h2>
            <Link href="/faq" className="mt-7 inline-flex items-center gap-2 font-bold text-white">Read the complete FAQ <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="space-y-4">
            {questions.map((item) => (
              <details key={item.question} className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-6">
                <summary className="cursor-pointer list-none text-xl font-semibold marker:hidden">{item.question}</summary>
                <p className="mt-4 leading-8 text-white/65">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center lg:p-16">
          <div>
            <ShieldCheck className="h-9 w-9 text-brand-orange" />
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Find the first realistic paid media opportunity inside your agency.</h2>
            <p className="mt-5 max-w-2xl leading-8 text-white/65">Use a free 30-minute revenue gap audit to map likely accounts, operating requirements, and the next step.</p>
          </div>
          <Link href="/eic-schedule-demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white">
            Book the free audit
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
