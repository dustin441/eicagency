import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// Email links Supabase sends land here, in one of two shapes:
// - `code` (PKCE): password recovery requested from this browser.
// - `token_hash` + `type`: invites sent by the Team page (and any template that
//   links with {{ .TokenHash }}); works in any browser, no PKCE verifier needed.
// Either way the session cookie is set, then the user goes to `next`.
const EMAIL_OTP_TYPES = new Set<EmailOtpType>(['invite', 'recovery', 'signup', 'magiclink', 'email_change', 'email']);
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next') ?? '/dashboard';
  // Only same-site relative paths; never `//host` or absolute URLs.
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard';

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/used link).
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
