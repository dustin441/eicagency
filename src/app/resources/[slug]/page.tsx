import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { formatResourceDate, getResourcePost, resourcePosts } from '@/lib/resources';

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

  return {
    title: `${post.title} | EIC Agency`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}

export default async function ResourcePostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getResourcePost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <article>
        <header className="px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Link href="/resources" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-brand-forest">
              <ArrowLeft className="h-4 w-4" />
              Back to resources
            </Link>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-orange">{formatResourceDate(post.publishedAt)}</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] text-brand-forest sm:text-5xl lg:text-6xl">
              {post.title}
            </h1>
            {post.description ? (
              <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">{post.description}</p>
            ) : null}
          </div>
        </header>

        {post.imageUrl ? (
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

            <div className="mt-12 rounded-3xl bg-[#f7f4ef] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-orange">Originally published on EIC</p>
              <Link href={post.originalUrl} className="mt-3 inline-flex items-center gap-2 font-bold text-brand-forest">
                View original post
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
