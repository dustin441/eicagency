import React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart2, Settings } from 'lucide-react';
import { requirePartnerUser } from '@/lib/auth-guard';
import { TEAM_PATH, clientSettingsPath, getDeploymentTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Partner-tenant Home: one card per dashboard the user may open. Settings (all
// users, all dashboards) is shown to Master Admins only; the page it opens checks again.
export default async function HomePage() {
  const ctx = await requirePartnerUser();
  const tenant = getDeploymentTenant();
  const dashboards = (tenant.allowedClients ?? [])
    .filter(id => ctx.levels.has(id))
    .map(id => ({ id, name: tenant.clientLabels[id] ?? id, level: ctx.levels.get(id)! }));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Home</h1>
          <p className="text-gray-500 mt-1">Choose a dashboard.</p>
        </div>
        {ctx.isMaster && (
          <Link
            href={TEAM_PATH}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-brand-dark shadow-sm transition hover:border-brand-forest/30"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        )}
      </div>

      {dashboards.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          You don&apos;t have access to any dashboard yet. Ask your administrator for access.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map(d => (
            <div key={d.id} className="group relative bg-white rounded-3xl border border-gray-100 shadow-sm p-6 transition hover:border-brand-orange/40 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2 rounded-xl bg-brand-forest/5 text-brand-forest w-fit">
                  <BarChart2 className="w-5 h-5" />
                </div>
                {!ctx.isMaster && (
                  <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                    {d.level === 'admin' ? 'Client Admin' : 'Viewer'}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-lg font-bold text-brand-dark">
                <Link href={`/dashboard/${d.id}`} className="after:absolute after:inset-0">
                  {d.name}
                </Link>
              </h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1 font-medium text-brand-orange">
                  Open dashboard <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                {d.level === 'admin' && (
                  <Link href={clientSettingsPath(d.id)} className="relative z-10 text-gray-400 hover:text-brand-dark" aria-label={`${d.name} settings`}>
                    <Settings className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
