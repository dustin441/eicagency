import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for the Spartaco project.
 * This is intentionally isolated from the default client project config.
 */
export function createSpartacoSupabaseClient() {
  return createClient(
    process.env.SPARTACO_SUPABASE_URL!,
    process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY!
  );
}
