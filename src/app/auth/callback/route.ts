import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Handles the link Supabase emails for password recovery (and any other
// code-based auth flow). Exchanges the one-time `code` for a session cookie,
// then forwards the user to `next` (defaults to /reset-password).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/used link).
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
