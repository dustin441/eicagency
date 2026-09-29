import { authorizeStudioServer } from '@/services/creative-studio-server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Navigation hint only. Page and every operation independently authorize again. */
export async function GET() {
  let enabled = false;
  try {
    await authorizeStudioServer(process.env, createClient);
    enabled = true;
  } catch {
    // Do not disclose owner identities, configuration or authorization failures.
  }
  return Response.json({ enabled }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
