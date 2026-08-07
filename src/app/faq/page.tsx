import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';

const siteUrl = 'https://eic.agency';

const faqs = [
  {
    question: 'What is white label paid media management?',
    answer: 'White label paid media management lets your agency offer paid advertising under its own brand while a specialist partner handles campaign strategy, builds, optimization, creative production, and reporting behind the scenes. Your agency keeps the client relationship and remains the primary point of contact.',
  },
  {
    question: 'Who is EIC built to support?',
    answer: 'EIC is built for marketing agencies that want to add or strengthen paid media without building a full in-house department. That includes social media, SEO, web design, creative, PR, content, CRM, and consulting firms whose clients are asking for Google Ads, Meta Ads, or broader paid media support.',
  },
  {
    question: 'Will our clients see the EIC Agency brand?',
    answer: 'No. EIC operates as a behind-the-scenes fulfillment partner. Your agency owns the client relationship, presents the work, and controls the commercial agreement. Our delivery, dashboards, and client-ready updates are designed to support your brand rather than compete with it.',
  },
  {
    question: 'Which advertising channels can EIC manage?',
    answer: 'EIC supports paid media across Google, Meta, LinkedIn, YouTube, TikTok, and other channels when the strategy and audience justify them. The recommended channel mix starts with the client goal, available creative, measurement readiness, and realistic budget.',
  },
  {
    question: 'Does EIC provide ad creative?',
    answer: 'Yes. EIC can turn approved photos, video, messaging, and brand assets into campaign-ready creative. Creative production and testing are integrated with campaign management so the next concept is informed by what the account is actually showing.',
  },
  {
    question: 'How does reporting work?',
    answer: 'Partners receive live dashboards and client-ready weekly updates that explain what changed, what the data says, and what happens next. Reporting can connect media delivery with qualified leads, sales stages, and revenue when the required CRM and tracking data are available.',
  },
  {
    question: 'Who owns the advertising accounts and data?',
    answer: 'The agency and its client should retain ownership of their advertising accounts, first-party data, and client relationship. EIC works within approved access and does not require the client relationship to move under EIC.',
  },
  {
    question: 'How involved does our agency need to be?',
    answer: 'Your team provides client context, approved claims and assets, offer decisions, and timely feedback. EIC handles the day-to-day paid media execution. The goal is to reduce production and reporting work without disconnecting your agency from strategy or the client.',
  },
  {
    question: 'How do we know if a client is ready for paid ads?',
    answer: 'A strong candidate has a clear audience, a credible offer, useful creative or source assets, a workable sales follow-up process, enough budget for the chosen channel, and measurement that can distinguish traffic from qualified outcomes. The initial audit identifies gaps before campaign spend begins.',
  },
  {
    question: 'How does an EIC partnership begin?',
    answer: 'Start with a 30-minute paid media revenue gap audit. We review your service mix, the client demand you are seeing, likely first accounts, delivery requirements, and the white label operating model. If there is a fit, the next step is an account audit and specific media plan.',
  },
];

export const metadata: Metadata = {
  title: 'White Label Paid Media FAQ for Agencies',
  description: 'Answers about EIC Agency white-label PPC management, client ownership, reporting, creative, channels, onboarding, and paid media fulfillment.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'White Label Paid Media FAQ for Agencies | EIC Agency',
    description: 'How EIC helps marketing agencies add paid media while keeping their brand and client relationship.',
    url: '/faq',
  },
};

export default function FaqPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${siteUrl}/faq` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, breadcrumbSchema]).replace(/</g, '\\u003c') }} />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-brand-forest px-5 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">White label paid media FAQ</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-7xl">What agencies need to know before adding paid media.</h1>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-white/70 sm:text-xl">Clear answers about fulfillment, ownership, reporting, creative, onboarding, and how EIC works behind your agency brand.</p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">Quick fit check</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-brand-forest">EIC may fit if your agency:</h2>
            <div className="mt-6 space-y-4">
              {[
                'Has clients asking for paid advertising',
                'Wants to add revenue without a full internal hire',
                'Needs execution, creative, and reporting in one system',
                'Wants to keep ownership of every client relationship',
              ].map((item) => (
                <div key={item} className="flex gap-3 font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  {item}
                </div>
              ))}
            </div>
            <Link href="/white-label-ppc-management" className="mt-8 inline-flex items-center gap-2 font-bold text-brand-forest">
              Explore white label PPC management
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-[1.75rem] border border-brand-forest/10 bg-white p-6 shadow-sm open:shadow-lg sm:p-7">
                <summary className="cursor-pointer list-none pr-8 text-xl font-semibold tracking-[-0.025em] text-brand-forest marker:hidden">
                  {faq.question}
                </summary>
                <p className="mt-5 leading-8 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center lg:p-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Still deciding?</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Map the paid media opportunity inside your agency.</h2>
            <p className="mt-5 max-w-2xl leading-8 text-white/65">Use a focused 30-minute audit to identify realistic first accounts, delivery gaps, and the next step for your offer.</p>
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
