import { notFound } from 'next/navigation';
import { requireClientAccess } from '@/lib/auth-guard';
import UrlCreativeBuilder from '@/components/creative-studio/UrlCreativeBuilder';
import { authorizeStudioServer } from '@/services/creative-studio-server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Creative Builder | EIC Agency' };

export default async function CreativeBuilderPage() {
  if (process.env.CREATIVE_STUDIO_HOSTED_ENABLED !== 'true') notFound();
  try { await authorizeStudioServer(process.env, createClient); } catch { notFound(); }
  await requireClientAccess('eicagency');
  return <UrlCreativeBuilder />;
}
