import Link from 'next/link';
import { ArrowRight, BookOpenText, Search, Sparkles } from 'lucide-react';
import { formatResourceDate, resourcePosts } from '@/lib/resources';

const socialImage = '/og-eic-white-label-paid-media.png';

export const metadata = {
  title: 'B2B Paid Media Resources',
  description:
    'White-label paid media resources, B2B lead generation frameworks, and client analytics thinking for agencies building a stronger performance offer.',
  alternates: {
    canonical: '/resources',
  },
  openGraph: {
    title: 'B2B Paid Media Resources | EIC Agency',
    description:
      'White-label paid media resources, B2B lead generation frameworks, and client analytics thinking for agencies building a stronger performance offer.',
    url: '/resources',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'B2B Paid Media Resources | EIC Agency',
    description:
      'White-label paid media resources, B2B lead generation frameworks, and client analytics thinking for agencies building a stronger performance offer.',
    images: [socialImage],
  },
};

export default function ResourcesPage() {
  const featured = resourcePosts.slice(0, 3);
  const rest = resourcePosts.slice(3);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="relative overflow-hidden px-5 py-20 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-brand-forest">
            ← Back to home
          </Link>
          <div className="max-w-4xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-forest/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-forest shadow-sm">
              <BookOpenText className="h-4 w-4 text-brand-orange" />
              Resources
            </div>
            <h1 className="text-5xl font-semibold tracking-[-0.06em] text-brand-forest sm:text-6xl lg:text-7xl">
              Practical thinking for B2B growth and White Label performance advertising.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
              Frameworks, campaign breakdowns, case-study style lessons, and measurement ideas from the same team building EIC’s performance advertising system.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">
            <Sparkles className="h-5 w-5" />
            Featured reads
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {featured.map((post) => (
              <Link
                key={post.slug}
                href={`/resources/${post.slug}`}
                className="group overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-forest/10"
              >
                {post.imageUrl ? (
                  <div className="aspect-[1.65] overflow-hidden bg-brand-forest/5">
                    <img src={post.imageUrl} alt={post.imageAltText || post.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                ) : null}
                <div className="p-7">
                  <p className="text-sm font-bold text-brand-orange">{formatResourceDate(post.publishedAt)}</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{post.title}</h2>
                  <p className="mt-4 line-clamp-3 leading-7 text-slate-600">{post.description}</p>
                  <span className="mt-7 inline-flex items-center gap-2 font-bold text-brand-forest">
                    Read article
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">
            <Search className="h-5 w-5" />
            All resources
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/resources/${post.slug}`}
                className="group rounded-[1.5rem] border border-brand-forest/10 bg-white/80 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl hover:shadow-brand-forest/10"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">{formatResourceDate(post.publishedAt)}</p>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-brand-forest">{post.title}</h2>
                <p className="mt-3 line-clamp-2 leading-7 text-slate-600">{post.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
