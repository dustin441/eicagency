import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key.
 * This bypasses RLS and must NEVER be used in client components.
 * Only call this from Server Components, Route Handlers, or Server Actions.
 */
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
