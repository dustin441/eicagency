import Link from 'next/link';
import { AlertTriangle, ArrowLeft, LockKeyhole, Settings2 } from 'lucide-react';
import { requireAgencyAccess } from '@/lib/auth-guard';
import { createEicSupabaseClient } from '@/lib/spartaco-supabase-server';
import { normalizeActiveConfigRevision } from '@/services/client-health/config-revision';
import ClientEconomicsSettingsForm from './ClientEconomicsSettingsForm';

export const dynamic = 'force-dynamic';

export default async function ClientHealthSettingsPage() {
  await requireAgencyAccess();
  const response = await createEicSupabaseClient().rpc('client_health_get_active_config_revision');
  if (response.error) {
    return (
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <Link href="/dashboard/eicagency/client-health" className="inline-flex items-center gap-2 text-sm font-bold text-brand-forest"><ArrowLeft className="h-4 w-4" />Client Health</Link>
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900"><h1 className="text-xl font-black">Settings unavailable</h1><p className="mt-2">The active configuration could not be read. No changes were made.</p></div>
      </main>
    );
  }
  const active = normalizeActiveConfigRevision(response.data);
  const activatedAt = new Date(active.activation.activatedAt).toLocaleString('en-US', { timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short' });

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
      <Link href="/dashboard/eicagency/client-health" className="inline-flex items-center gap-2 text-sm font-bold text-brand-forest"><ArrowLeft className="h-4 w-4" />Client Health</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-forest"><Settings2 className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.18em]">Agency settings</span></div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Client economics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage effective-month retainers and delivery models. Hourly fulfillment cost is fixed at $46 for custom work and $26 for platform work. Allotted hours are derived from retainer, target margin, and hourly cost.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <p><b>Active revision:</b> <span className="font-mono">{active.revision.id.slice(0, 12)}</span></p>
          <p className="mt-1"><b>Activated:</b> {activatedAt} AZ</p>
        </div>
      </div>

      {active.revision.content.schemaVersion !== 3 ? (
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" /><h2 className="text-lg font-black">Initial v3 activation required</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6">Incremental economics editing is locked until the reviewed 15-client v3 baseline is active. This prevents a partial form submission from inventing source or North Star configuration.</p>
        </section>
      ) : (
        <>
          <div className="mt-8 space-y-5">
            {active.revision.content.clients.filter(({ configStatus }) => configStatus === 'approved').map((client) => (
              <ClientEconomicsSettingsForm key={client.clientId} client={{
                clientId: client.clientId,
                displayName: client.displayName,
                effectiveMonth: client.economics.effectiveMonth,
                monthlyRetainer: client.economics.monthlyRetainer ?? 0,
                deliveryModel: client.economics.deliveryModel,
                fulfillmentHourlyCost: client.economics.fulfillmentHourlyCost,
                targetMarginPercent: client.economics.targetMarginPercent,
              }} />
            ))}
          </div>
          {active.revision.content.clients.some(({ configStatus }) => configStatus === 'configuration_required') ? (
            <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /><h2 className="font-black">Source configuration still required</h2></div>
              <p className="mt-2 text-sm">Clients without approved metrics and source contracts are intentionally not editable here. Approve their complete configuration before setting a nonzero retainer.</p>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
