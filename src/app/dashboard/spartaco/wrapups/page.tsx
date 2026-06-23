import Link from 'next/link';
import { FileBarChart2, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { SPARTACO_WRAPUPS } from '@/services/spartaco-product-wrapups';

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function SpartacoProductWrapupsPage() {
  await requireClientAccess('spartaco');

  const wrapupsByBrand = SPARTACO_WRAPUPS.reduce<Record<string, typeof SPARTACO_WRAPUPS>>((acc, wrapup) => {
    acc[wrapup.brand] ??= [];
    acc[wrapup.brand].push(wrapup);
    return acc;
  }, {});

  return (
    <div className="space-y-8 pb-20">
      <header className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Spartaco Reporting</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-dark">Product Wrap-Ups</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
              Saved, presentation-ready campaign reports with locked before/during/after windows. Bob can open a wrap-up directly without changing product filters, campaign filters, or date ranges.
            </p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700">
            {SPARTACO_WRAPUPS.length} saved wrap-up{SPARTACO_WRAPUPS.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <Clock className="h-5 w-5 text-indigo-600" />
          <h2 className="mt-3 font-black text-brand-dark">Locked Windows</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Each page preloads the campaign run dates plus the 4 weeks before and after.</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <FileBarChart2 className="h-5 w-5 text-indigo-600" />
          <h2 className="mt-3 font-black text-brand-dark">Jim-Style Roll-Up</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">The report summarizes paid, GA4, Act-On email, GSC, and social signals by period.</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-indigo-600" />
          <h2 className="mt-3 font-black text-brand-dark">Bob Review Ready</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">The page includes what we can claim, what we cannot claim, and the offline sales context Bob should add.</p>
        </div>
      </section>

      <section className="space-y-6">
        {Object.entries(wrapupsByBrand).map(([brand, wrapups]) => (
          <div key={brand}>
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-gray-400">{brand}</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {wrapups.map((wrapup) => (
                <Link
                  key={wrapup.slug}
                  href={`/dashboard/spartaco/wrapups/${wrapup.slug}`}
                  className="group rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">{wrapup.status}</p>
                      <h3 className="mt-2 text-xl font-black text-brand-dark">{wrapup.campaignGroupName}</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Campaign ran {formatDate(wrapup.campaignStart)} – {formatDate(wrapup.campaignEnd)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-3 text-gray-400 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 text-xs font-bold text-gray-500 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <span className="block uppercase tracking-widest text-gray-400">Before</span>
                      {formatDate(wrapup.beforeStart)} – {formatDate(wrapup.beforeEnd)}
                    </div>
                    <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                      <span className="block uppercase tracking-widest text-indigo-400">During</span>
                      {formatDate(wrapup.campaignStart)} – {formatDate(wrapup.campaignEnd)}
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-3">
                      <span className="block uppercase tracking-widest text-gray-400">After</span>
                      {formatDate(wrapup.afterStart)} – {formatDate(wrapup.afterEnd)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
