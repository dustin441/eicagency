import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatResourceDate, getRelatedResources, getResourcePost, getResourceVideoId, resourcePosts } from '@/lib/resources';
import MarketingHeader from '@/components/MarketingHeader';

const siteUrl = 'https://eic.agency';
const fallbackSocialImage = '/og-eic-white-label-paid-media.png';

function getSocialImage(imageUrl?: string) {
  if (!imageUrl) return fallbackSocialImage;
  return /\.(png|jpe?g|webp)$/i.test(imageUrl) ? imageUrl : fallbackSocialImage;
}

function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return resourcePosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = getResourcePost(slug);
  if (!post) return {};

  const socialImage = getSocialImage(post.imageUrl);
  const canonicalUrl = `${siteUrl}/resources/${post.slug}`;

  return {
    title: post.seoTitle || post.title,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${post.seoTitle || post.title} | EIC Agency`,
      description: post.description,
      url: canonicalUrl,
      images: [absoluteUrl(socialImage)],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.seoTitle || post.title} | EIC Agency`,
      description: post.description,
      images: [absoluteUrl(socialImage)],
    },
  };
}

export default async function ResourcePostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getResourcePost(slug);

  if (!post) {
    notFound();
  }

  const canonicalUrl = `${siteUrl}/resources/${post.slug}`;
  const socialImageUrl = absoluteUrl(getSocialImage(post.imageUrl));
  const relatedResources = getRelatedResources(post.slug);
  const youtubeId = getResourceVideoId(post);
  const videoId = youtubeId ? `${canonicalUrl}#video` : undefined;
  const publishedDate = formatResourceDate(post.publishedAt);
  const updatedDate = formatResourceDate(post.updatedAt);
  const showUpdatedDate = Boolean(updatedDate && updatedDate !== publishedDate);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl}#article`,
        headline: post.title,
        description: post.description,
        image: [socialImageUrl],
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        mainEntityOfPage: canonicalUrl,
        publisher: {
          '@type': 'Organization',
          name: 'EIC Agency',
          url: siteUrl,
        },
        ...(videoId ? { video: { '@id': videoId } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Resources', item: `${siteUrl}/resources` },
          { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
        ],
      },
      ...(youtubeId
        ? [{
            '@type': 'VideoObject',
            '@id': videoId,
            name: post.title,
            description: post.description,
            thumbnailUrl: [`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`],
            uploadDate: post.publishedAt,
            embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
          }]
        : []),
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <MarketingHeader />
      <article>
        <header className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Link href="/resources" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-brand-forest">
              <ArrowLeft className="h-4 w-4" />
              Back to resources
            </Link>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">
              Published {publishedDate}{showUpdatedDate ? ` · Updated ${updatedDate}` : ''}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] text-brand-forest sm:text-5xl lg:text-6xl">
              {post.title}
            </h1>
            {post.description ? (
              <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">{post.description}</p>
            ) : null}
          </div>
        </header>

        {youtubeId ? (
          <div className="px-5 pb-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-black shadow-sm">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>
        ) : post.imageUrl ? (
          <div className="px-5 pb-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-brand-forest/10 bg-white shadow-sm">
              <img src={post.imageUrl} alt={post.imageAltText || post.title} className="h-auto w-full" />
            </div>
          </div>
        ) : null}

        <section className="px-5 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-brand-forest/10 bg-white p-6 shadow-sm sm:p-10">
            <div
              className="resource-body max-w-none text-slate-700 [&_a]:font-bold [&_a]:text-brand-orange [&_blockquote]:border-l-4 [&_blockquote]:border-brand-orange [&_blockquote]:pl-5 [&_blockquote]:text-slate-600 [&_h1]:mb-5 [&_h1]:mt-10 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h1]:text-brand-forest [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-[-0.035em] [&_h2]:text-brand-forest [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:text-slate-950 [&_img]:my-8 [&_img]:rounded-2xl [&_img]:border [&_img]:border-brand-forest/10 [&_li]:mb-2 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-5 [&_p]:leading-8 [&_strong]:font-bold [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: post.bodyHTML }}
            />

            <div className="mt-12 rounded-3xl bg-brand-forest p-7 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">White-label paid media</p>
              <h2 className="mt-3 text-2xl font-semibold">Add paid media to your agency without building an in-house team.</h2>
              <Link href="/eic-schedule-demo" className="mt-5 inline-flex items-center gap-2 font-bold text-white">
                Talk with EIC
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="mx-3 text-white/30">|</span>
              <Link href="/white-label-ppc-management" className="inline-flex items-center gap-2 font-bold text-white">
                See how fulfillment works
              </Link>
            </div>

            <aside className="mt-10 border-t border-brand-forest/10 pt-8" aria-labelledby="related-resources">
              <h2 id="related-resources" className="text-2xl font-semibold text-brand-forest">Related resources</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {relatedResources.map((relatedPost) => (
                  <Link
                    key={relatedPost.slug}
                    href={`/resources/${relatedPost.slug}`}
                    className="rounded-2xl border border-brand-forest/10 p-5 font-bold text-brand-forest transition-colors hover:bg-[#f7f4ef]"
                  >
                    {relatedPost.title}
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </article>
    </main>
  );
}
