import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, CheckCircle2, Handshake, LineChart, ShieldCheck } from 'lucide-react';

const leaders = [
  {
    name: 'Dustin Trout',
    role: 'Strategy & Partner Growth',
    experience: '15+ years in digital',
    copy: "Dustin leads EIC's strategy, partner growth, and the systems behind our white-label performance engine.",
    image: '/team/dustin-trout.svg',
    href: 'https://www.linkedin.com/in/dustin-trout-32039486/',
  },
  {
    name: 'Mike Patterson',
    role: 'Paid Media Leadership',
    experience: '12+ years in digital',
    copy: 'Mike leads paid media execution, optimization, and hands-on campaign strategy across channels and budget tiers.',
    image: '/team/mike-patterson.svg',
    href: 'https://www.linkedin.com/in/mpattyfly/',
  },
];

const team = [
  { name: 'Adolfo', image: '/team/adolfo_profile.png' },
  { name: 'Adriel', image: '/team/adriel_profile.png' },
  { name: 'Gabriela', image: '/team/gabriela-profile_2.jpg' },
];

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Meet the senior paid media operators and learn the philosophy behind EIC Agency’s white-label performance advertising partnership.',
  alternates: { canonical: '/about-us' },
  openGraph: {
    title: 'About EIC Agency',
    description: 'We built EIC to give agencies the team, systems, and clarity to act with confidence.',
    url: '/about-us',
  },
};

export default function AboutUsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <nav className="border-b border-brand-forest/10 bg-[#f7f4ef]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="EIC Agency home">
            <img src="/EIC-Logo-Black-Jade.svg" alt="EIC Agency" className="h-11 w-auto sm:h-14" />
          </Link>
          <div className="flex items-center gap-5 text-sm font-bold text-slate-600">
            <Link href="/case-studies" className="hidden hover:text-brand-forest sm:inline">Case studies</Link>
            <Link href="/resources" className="hidden hover:text-brand-forest md:inline">Resources</Link>
            <Link href="/eic-schedule-demo" className="rounded-full bg-brand-forest px-5 py-3 text-white">Become a partner</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-orange/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">About EIC</p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl">
              We built EIC to give agencies more agency.
            </h1>
            <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-600">
              The ability to act. The clarity to choose. The confidence to grow. EIC gives marketing agencies a senior paid media team, a proven operating system, and reporting their clients can understand.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/eic-schedule-demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white">
                Talk to our team
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/case-studies" className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-forest/15 bg-white px-7 py-4 font-bold text-brand-forest">
                See the work
              </Link>
            </div>
          </div>

          <div className="relative rounded-[2.5rem] bg-brand-forest p-8 text-white shadow-2xl shadow-brand-forest/20 sm:p-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/25 blur-3xl" />
            <p className="relative text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Agency, defined</p>
            <blockquote className="relative mt-6 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
              “The capacity, condition, or state of acting or exerting power.”
            </blockquote>
            <p className="relative mt-6 text-lg leading-8 text-white/65">
              Giving someone agency means empowering them to make informed choices and take independent action. That idea shaped the original EIC About page, and it still shapes how we work today.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Putting the power in your hands</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">We are here to empower you.</h2>
          </div>
          <div className="space-y-6 text-lg leading-8 text-slate-600">
            <p>
              Every agency deserves the clarity, confidence, and control to make better decisions and accelerate growth. Through data-driven advertising, omnichannel execution, and real-time insights, we help partners move from reaction to direction.
            </p>
            <p>
              We turn paid media from a service gap into a new revenue engine, one that drives measurable impact, supports lasting client relationships, and builds confidence in every decision.
            </p>
            <p className="font-semibold text-brand-forest">
              We do not just generate leads or manage campaigns. We give your agency the power to act, to choose, and to grow while you keep the client relationship.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">How empowerment shows up</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-brand-forest sm:text-5xl">A partnership designed around control and clarity.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Handshake, title: 'You own the relationship', copy: 'Your agency remains the trusted client partner. EIC operates behind your brand.' },
              { icon: LineChart, title: 'Decisions use real data', copy: 'Campaign execution is tied to qualified leads, sales, revenue, and the metrics that matter.' },
              { icon: BarChart3, title: 'Clients see the work', copy: 'Live dashboards and weekly updates replace opaque reports and status chasing.' },
              { icon: ShieldCheck, title: 'Senior operators stay close', copy: 'Experienced strategists and ad managers review, document, and optimize throughout the week.' },
            ].map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest text-white"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-forest px-5 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">The people behind the system</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Senior operators, not a faceless ad shop.</h2>
            <p className="mt-5 text-lg leading-8 text-white/65">Your agency’s name is on the client relationship. The team behind it should be experienced, accountable, and visible to you.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {leaders.map((leader) => (
              <article key={leader.name} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06]">
                <div className="grid sm:grid-cols-[210px_1fr]">
                  <div className="flex min-h-64 items-end justify-center overflow-hidden bg-white/5 px-5 pt-5">
                    <img src={leader.image} alt={leader.name} className="max-h-64 w-full object-contain object-bottom" />
                  </div>
                  <div className="p-7 sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">{leader.role}</p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{leader.name}</h3>
                    <p className="mt-2 text-sm font-semibold text-white/45">{leader.experience}</p>
                    <p className="mt-5 leading-7 text-white/65">{leader.copy}</p>
                    <a href={leader.href} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 font-bold text-white">LinkedIn profile <ArrowRight className="h-4 w-4" /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {team.map((member) => (
              <div key={member.name} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-3">
                <img src={member.image} alt={member.name} className="aspect-[4/3] w-full rounded-[1.25rem] object-cover object-top" />
                <p className="px-3 pb-2 pt-4 text-lg font-semibold">{member.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 rounded-[2.5rem] bg-slate-950 p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center lg:p-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-orange">Let us help you</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Give your agency the power to say yes to paid media.</h2>
            <div className="mt-7 space-y-3">
              {['White-label execution under your brand', 'Creative production and campaign optimization', 'Live reporting and client-ready weekly updates'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-white/75"><CheckCircle2 className="h-5 w-5 text-brand-orange" />{item}</div>
              ))}
            </div>
          </div>
          <Link href="/eic-schedule-demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-bold text-white">
            Book a discovery call
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
