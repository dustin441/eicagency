import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Network } from 'lucide-react';
import MarketingHeader from '@/components/MarketingHeader';
import { resourceClusterDetails, resourceClusters, type ResourceCluster } from '@/content/resource-seo';
import { formatResourceDate, getResourceClusterPosts } from '@/lib/resources';
import { SITE_URL, breadcrumbSchema, serializeJsonLd } from '@/lib/seo';

type PageProps = {
  params: Promise<{ cluster: string }>;
};

const attributionFrameworkLinks = [
  {
    href: '/resources/b2b-meta-attribution-CAPI',
    title: 'Connect browser and server conversion signals',
    description: 'Use Meta Conversion API and approved first-party events without confusing platform attribution with CRM truth.',
  },
  {
    href: '/resources/eic-marketing-channels-ad-attribution',
    title: 'Compare traffic-source attribution models',
    description: 'Understand how search, social, direct, email, and assisted touchpoints can receive different credit.',
  },
  {
    href: '/resources/the-hidden-threat-of-bot-traffic',
    title: 'Separate traffic volume from traffic quality',
    description: 'Investigate bot, spam, invalid-lead, and poor-fit signals before optimizing toward inexpensive activity.',
  },
  {
    href: '/resources/building-the-best-marketing-dashboard',
    title: 'Build a client-ready measurement view',
    description: 'Connect delivery, onsite engagement, qualified pipeline, and revenue without blending funnel stages.',
  },
  {
    href: '/resources/eic-agency-calculating-profitable-roi',
    title: 'Turn attribution into an ROI decision',
    description: 'Use business economics and complete outcomes to decide what should scale, change, or stop.',
  },
] as const;

function isResourceCluster(value: string): value is ResourceCluster {
  return Object.prototype.hasOwnProperty.call(resourceClusters, value);
}

export function generateStaticParams() {
  return (Object.keys(resourceClusters) as ResourceCluster[]).map((cluster) => ({ cluster }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cluster } = await params;
  if (!isResourceCluster(cluster)) return {};
  const details = resourceClusterDetails[cluster];
  const hubTitle = details.hubTitle ?? details.title;
  const canonical = `/resources/topics/${cluster}`;

  return {
    title: `${hubTitle} Resources`,
    description: details.description,
    alternates: { canonical },
    openGraph: {
      title: `${hubTitle} Resources | EIC Agency`,
      description: details.description,
      url: canonical,
      images: ['/og-eic-white-label-paid-media.png'],
    },
  };
}

export default async function ResourceTopicPage({ params }: PageProps) {
  const { cluster } = await params;
  if (!isResourceCluster(cluster)) notFound();

  const details = resourceClusterDetails[cluster];
  const hubTitle = details.hubTitle ?? details.title;
  const posts = getResourceClusterPosts(cluster);
  const canonicalUrl = `${SITE_URL}/resources/topics/${cluster}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `${hubTitle} Resources`,
        description: details.description,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: posts.length,
          itemListElement: posts.map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: post.title,
            url: `${SITE_URL}/resources/${post.slug}`,
          })),
        },
      },
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Resources', path: '/resources' },
        { name: hubTitle, path: `/resources/topics/${cluster}` },
      ]),
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <MarketingHeader />
      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/resources" className="inline-flex items-center gap-2 text-sm font-bold text-brand-forest">
            <ArrowLeft className="h-4 w-4" />
            Back to all resources
          </Link>
          <div className="mt-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-forest/10 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-forest">
              <Network className="h-4 w-4 text-brand-orange" />
              Resource topic
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.055em] text-brand-forest sm:text-6xl">
              {hubTitle}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{details.description}</p>
          </div>

          {cluster === 'reporting-attribution-and-traffic-quality' ? (
            <section className="mt-12 rounded-[2rem] border border-brand-forest/10 bg-white p-7 shadow-sm sm:p-10" aria-labelledby="traffic-attribution-framework">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">Agency decision framework</p>
              <h2 id="traffic-attribution-framework" className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-brand-forest">
                What is paid media traffic attribution?
              </h2>
              <p className="mt-5 max-w-4xl leading-8 text-slate-600">
                Paid media traffic attribution is the process of connecting a visit or business outcome to the advertising source and touchpoints that contributed to it. For agencies, the useful question is not which platform can claim the most conversions. It is how media delivery, website behavior, validated leads, CRM stages, and revenue reconcile over the same complete period.
              </p>
              <ol className="mt-6 grid gap-3 text-slate-700 sm:grid-cols-2">
                <li className="rounded-2xl bg-[#f7f4ef] p-5"><strong className="text-brand-forest">1. Preserve the source.</strong> Capture UTMs and approved click or campaign identifiers.</li>
                <li className="rounded-2xl bg-[#f7f4ef] p-5"><strong className="text-brand-forest">2. Define every stage.</strong> Keep visits, leads, appointments, opportunities, wins, and revenue distinct.</li>
                <li className="rounded-2xl bg-[#f7f4ef] p-5"><strong className="text-brand-forest">3. Validate quality.</strong> Exclude tests and classify spam, bots, invalid records, and poor-fit leads separately.</li>
                <li className="rounded-2xl bg-[#f7f4ef] p-5"><strong className="text-brand-forest">4. Reconcile the systems.</strong> Compare platform, analytics, CRM, and sales evidence without promising a perfect match.</li>
              </ol>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {attributionFrameworkLinks.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border border-brand-forest/10 p-5 transition-colors hover:bg-[#f7f4ef] ${index === attributionFrameworkLinks.length - 1 ? 'md:col-span-2' : ''}`}
                  >
                    <h3 className="font-bold text-brand-forest">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/resources/${post.slug}`}
                className="group rounded-[1.5rem] border border-brand-forest/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-forest/10"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">{formatResourceDate(post.publishedAt)}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-brand-forest">{post.title}</h2>
                <p className="mt-3 line-clamp-3 leading-7 text-slate-600">{post.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 font-bold text-brand-forest">
                  Read resource
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-[2rem] bg-brand-forest p-8 text-white sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">Connect the topic to delivery</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold">See how EIC turns paid media guidance into white-label execution for agencies.</h2>
            <Link href={details.commercialPath} className="mt-6 inline-flex items-center gap-2 font-bold text-white">
              Explore the next step
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
