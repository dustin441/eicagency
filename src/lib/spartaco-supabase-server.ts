import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for the generalized EIC Clients data project.
 * This is intentionally isolated from the default PrePass/auth project config.
 */
export function createEicSupabaseClient() {
  return createClient(
    process.env.SPARTACO_SUPABASE_URL!,
    process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** @deprecated Prefer createEicSupabaseClient for non-Spartaco EIC data. */
export const createSpartacoSupabaseClient = createEicSupabaseClient;
