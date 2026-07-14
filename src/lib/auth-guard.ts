import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

type Profile = {
  role: 'super_admin' | 'agency' | 'client';
  client_access: string[] | null;
};

const CLIENT_DEFAULTS: Record<string, string> = {
  spartaco: '/dashboard/spartaco/leads',
  nsi: '/dashboard/nsi',
  prepass: '/dashboard',
  turfli: '/dashboard/turfli',
  durodyne: '/dashboard/durodyne',
  goodgame: '/dashboard/goodgame',
  bridgeway: '/dashboard/bridgeway',
  arabella: '/dashboard/arabella',
  kinsey: '/dashboard/kinsey',
  state48: '/dashboard/state-forty-eight',
  cba: '/dashboard/cba',
  liferep: '/dashboard/liferep',
  bloom: '/dashboard/bloom',
  eicagency: '/dashboard/eicagency',
  champagne: '/dashboard/champagne',
};

/**
 * Server-side access guard. Call at the top of any dashboard page that belongs
 * to a specific client. Redirects unauthorized users to their allowed default.
 * super_admin and agency roles bypass all client restrictions.
 */
export async function requireClientAccess(clientId: string): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('role, client_access')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (!profile || profile.role === 'super_admin' || profile.role === 'agency') {
    return;
  }

  const allowed = profile.client_access ?? [];
  if (allowed.includes(clientId)) return;

  // Redirect to the user's first allowed client, or login if none configured
  for (const id of allowed) {
    const href = CLIENT_DEFAULTS[id];
    if (href) redirect(href);
  }
  redirect('/login');
}
