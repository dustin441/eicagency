import { redirect } from 'next/navigation';
import { requireClientAccess } from '@/lib/auth-guard';

export default async function MarketoMirrorCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireClientAccess('prepass');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  redirect(`/dashboard/reporting-v2/reconciliation${query ? `?${query}` : ''}`);
}
