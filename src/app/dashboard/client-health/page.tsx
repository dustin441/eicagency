import { redirect } from 'next/navigation';
import { requireAgencyAccess } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export default async function LegacyClientHealthPage() {
  await requireAgencyAccess();
  redirect('/dashboard/eicagency/client-health');
}
