import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSearch,
  Layers3,
  Palette,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';

const siteUrl = 'https://eic.agency';

const channelRoles = [
  {
    title: 'Google Ads and paid search',
    copy: 'Search strategy, account structure, query review, negatives, bidding, landing-page alignment, conversion QA, and brand versus non-brand reporting.',
  },
  {
    title: 'Meta Ads and paid social',
    copy: 'Audience and funnel planning, campaign builds, creative testing, frequency review, retargeting, Pixel and Conversion API coordination, and qualified-outcome analysis.',
  },
  {
    title: 'LinkedIn, YouTube, TikTok, and additional channels',
    copy: 'Channels are added when the audience, offer, creative, budget, and measurement plan give each one a defensible role.',
  },
];

const ownership = [
  {
    party: 'Your agency owns',
    items: [
      'The client agreement, pricing, and relationship',
      'Final approvals for strategy, claims, creative, and budget',
      'Client context, brand standards, offers, and source assets',
      'Sales expectations and escalation decisions',
    ],
  },
  {
    party: 'EIC owns',
    items: [
      'Account audit, media planning, builds, and optimization',
      'Creative production from approved source material',
      'Tracking and reporting QA within the agreed scope',
      'Documented updates, analysis, and recommended next actions',
    ],
  },
  {
    party: 'We decide together',
    items: [
      'Whether the first account is ready for paid media',
      'Channel roles, budgets, tests, and success definitions',
      'How client communication and approvals will work',
      'When evidence supports scaling, revision, or pause',
    ],
  },
];

const questions = [
  {
    question: 'Is white-label PPC limited to Google Ads?',
    answer:
      'No. PPC often refers to paid search, but EIC can support Google, Meta, LinkedIn, YouTube, TikTok, and other channels when they fit the audience, offer, creative, budget, and measurement plan. We assign each channel a role instead of forcing every account into the same mix.',
  },
  {
    question: 'Will EIC communicate directly with our client?',
    answer:
      'The communication model is agreed before onboarding. Your agency keeps the relationship and remains the client-facing owner. EIC can provide behind-the-scenes analysis, client-ready updates, and meeting support according to the approved scope.',
  },
  {
    question: 'Do we need finished ad creative?',
    answer:
      'No. Your agency and client provide approved brand assets, offers, claims, examples, and source material. EIC can turn those inputs into campaign-ready concepts and variations. Your agency retains final approval before launch.',
  },
  {
    question: 'How do we know whether the first account is ready?',
    answer:
      'We review the offer, audience, budget, landing experience, creative inputs, conversion path, tracking, sales follow-up, and operational capacity. If a critical input is missing, the recommendation may be a readiness sprint rather than an immediate campaign launch.',
  },
  {
    question: 'What does reporting include?',
    answer:
      'The reporting model separates media delivery, onsite behavior, conversions, qualified outcomes, and revenue where the source systems support them. Live dashboards and documented updates explain what changed, what the evidence supports, and what the team plans to do next.',
  },
];

export const metadata: Metadata = {
  title: 'White Label PPC Fulfillment and Operations for Agencies',
  description:
    'Review what EIC handles behind your agency: Google and Meta Ads management, creative production, ownership, onboarding, reporting, QA, and client-ready delivery.',
  alternates: { canonical: '/white-label-ppc-management' },
  openGraph: {
    title: 'White Label PPC Fulfillment and Operations | EIC Agency',
    description:
      'The detailed operating model behind EIC white-label paid media delivery for marketing agencies.',
    url: '/white-label-ppc-management',
    images: ['/og-eic-white-label-paid-media.png'],
  },
};

export default function WhiteLabelPpcManagementPage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${siteUrl}/white-label-ppc-management#service`,
    name: 'White Label PPC Fulfillment and Operations for Marketing Agencies',
    description:
      'Behind-the-scenes Google Ads, Meta Ads, paid media strategy, campaign management, creative production, dashboards, and client-ready reporting for marketing agencies.',
    provider: { '@type': 'Organization', name: 'EIC Agency', url: siteUrl },
    areaServed: 'US',
    audience: { '@type': 'BusinessAudience', audienceType: 'Marketing agencies' },
    serviceType: [
      'White label Google Ads management',
      'White label Meta Ads management',
      'Paid media fulfillment',
      'Paid media reporting',
    ],
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

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'White Label PPC Fulfillment',
        item: `${siteUrl}/white-label-ppc-management`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([serviceSchema, faqSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <MarketingHeader />

      <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-orange/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              White-label PPC delivery details
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl">
              See exactly what EIC handles behind your agency.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
              The homepage explains why agencies add paid media with EIC. This page documents how delivery works: channel responsibilities, onboarding, account ownership, creative approvals, reporting, communication, and the boundaries that protect your client relationship.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/eic-schedule-demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white"
              >
                Review a first account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/case-studies"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-forest/15 bg-white px-7 py-4 font-bold text-brand-forest"
              >
                Review case studies
              </Link>
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-brand-forest p-8 text-white shadow-2xl shadow-brand-forest/20 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              Operating principle
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Your agency owns the relationship. EIC makes delivery visible and repeatable.
            </h2>
            <div className="mt-7 space-y-4">
              {[
                'Your agency controls the client agreement and final approvals',
                'EIC works from approved offers, claims, budgets, and source assets',
                'Campaign changes and next actions are documented',
                'Reporting keeps media, onsite behavior, leads, and revenue distinct',
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
          <div className="max-w-4xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              Channel-specific fulfillment
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">
              Google and Meta need different playbooks, not duplicate landing pages.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Google paid search and Meta paid social use different inventory, controls, creative inputs, and measurement patterns. EIC handles those channel differences inside one substantive fulfillment model rather than creating thin pages that repeat the same promise.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {channelRoles.map((item, index) => {
              const Icon = index === 0 ? Search : index === 1 ? Palette : Layers3;
              return (
                <article key={item.title} className="rounded-[2rem] border border-brand-forest/10 bg-[#f7f4ef] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">
                    {item.title}
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Ownership matrix</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">
              Clear ownership before the first campaign build.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {ownership.map((group) => (
              <article key={group.party} className="rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm">
                <h3 className="text-2xl font-semibold text-brand-forest">{group.party}</h3>
                <ul className="mt-6 space-y-4">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3 leading-7 text-slate-600">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-forest px-5 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <FileSearch className="h-10 w-10 text-brand-orange" />
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              First-account readiness
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              We audit the operating conditions before recommending spend.
            </h2>
            <p className="mt-6 leading-8 text-white/70">
              The first recommendation may be a campaign launch, an account rebuild, or a readiness sprint. The decision follows the account evidence rather than a standard package.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              ['01', 'Offer and audience', 'Confirm who the campaign is for, what the buyer receives, what claims are approved, and which segments should be excluded.'],
              ['02', 'Budget and channel role', 'Determine whether the available investment can support a bounded test and give each selected channel a clear job.'],
              ['03', 'Creative and landing experience', 'Inventory approved assets, message pillars, proof, destinations, mobile behavior, and the complete conversion path.'],
              ['04', 'Tracking and CRM', 'Verify platform events, analytics, forms, calls, CRM stages, lead validation, and revenue fields that the business can support.'],
              ['05', 'Sales and fulfillment capacity', 'Confirm follow-up ownership, response expectations, qualification rules, delivery limits, and escalation paths.'],
            ].map(([number, title, copy]) => (
              <li
                key={number}
                className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 sm:grid-cols-[70px_1fr] sm:p-8"
              >
                <span className="text-3xl font-semibold text-brand-orange">{number}</span>
                <div>
                  <h3 className="text-2xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-7 text-white/65">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <BarChart3 className="h-10 w-10 text-brand-orange" />
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              Reporting and communication
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">
              Client-ready reporting is part of fulfillment, not an afterthought.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-slate-600">
            <p>
              Live dashboards and documented updates separate media delivery, onsite behavior, conversions, qualified outcomes, and revenue where the source systems support them. A page visit, demo-page view, form, qualified lead, opportunity, and customer remain distinct stages.
            </p>
            <p>
              Updates explain what changed, what the evidence supports, what remains uncertain, and what the team plans to do next. Platform attribution is reconciled with analytics and CRM data rather than presented as a perfect copy of business revenue.
            </p>
            <p>
              Your agency receives material it can use with the client under the approved communication model. EIC does not create an unmanaged competing relationship with the account.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <ShieldCheck className="h-10 w-10 text-brand-orange" />
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">
              Delivery boundaries
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">
              What EIC will not promise or launch blindly.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              'A universal channel mix or minimum budget without reviewing the account',
              'Unsupported performance claims, client outcomes, or guaranteed timelines',
              'Campaigns built on unapproved creative, offers, or landing pages',
              'Reporting that labels every engagement event as a lead',
              'Offline conversion imports without stable identity and stage definitions',
              'Scaling beyond the client’s sales or fulfillment capacity',
              'Silent material changes without an annotation and review trail',
              'Thin channel pages that compete with the same commercial intent',
            ].map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-brand-forest/10 bg-white p-6 leading-7 text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-forest px-5 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Users className="h-10 w-10 text-brand-orange" />
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Common operational questions.
            </h2>
            <Link href="/faq" className="mt-7 inline-flex items-center gap-2 font-bold text-white">
              Read the complete FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {questions.map((item) => (
              <details key={item.question} className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-6">
                <summary className="cursor-pointer list-none text-xl font-semibold marker:hidden">
                  {item.question}
                </summary>
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
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Review the first realistic paid media account inside your agency.
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-white/65">
              Bring the offer, likely account, budget context, source assets, conversion path, and operational questions. EIC will map readiness, ownership, and the next defensible step.
            </p>
          </div>
          <Link
            href="/eic-schedule-demo"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white"
          >
            Book the free audit
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
