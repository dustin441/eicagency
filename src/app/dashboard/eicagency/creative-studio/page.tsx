import { notFound } from 'next/navigation';
import { requireClientAccess } from '@/lib/auth-guard';
import CreativeStudio from '@/components/creative-studio/CreativeStudio';
import { authorizeStudioServer } from '@/services/creative-studio-server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CreativeStudioPage() {
  if (process.env.CREATIVE_STUDIO_HOSTED_ENABLED === 'true') {
    try { await authorizeStudioServer(process.env, createClient); } catch { notFound(); }
    await requireClientAccess('eicagency');
    return <CreativeStudio mode="hosted-private-beta" />;
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL !== undefined || process.env.CREATIVE_STUDIO_LOCAL_REVIEW !== '1') notFound();
  await requireClientAccess('eicagency');

  return <CreativeStudio />;
}
