import 'server-only';

import { createClient } from '@supabase/supabase-js';

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the server Supabase client`);
  return value;
}

/**
 * Server-only Supabase client using the service role key.
 * This bypasses RLS and must NEVER be used in client components.
 * Only call this from Server Components, Route Handlers, or Server Actions.
 */
export function createServerSupabaseClient() {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('invalid protocol');
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL');
  }
  return createClient(url, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
}
