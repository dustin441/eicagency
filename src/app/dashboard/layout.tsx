'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart2,
  Users,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  Target,
  Layers,
  ShoppingBag,
  BriefcaseBusiness,
  Zap,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';

const CLIENTS = [
  {
    id: 'prepass',
    name: 'PrePass',
    defaultHref: '/dashboard',
    links: [
      { name: 'Overall Performance', href: '/dashboard', icon: LayoutDashboard },
      { name: 'SMB Segments', href: '/dashboard/smb', icon: Users },
      { name: 'ABM Focus', href: '/dashboard/abm', icon: Target },
      { name: 'FD360 Campaigns', href: '/dashboard/fd360', icon: Layers },
    ],
  },
  {
    id: 'spartaco',
    name: 'Spartaco',
    defaultHref: '/dashboard/spartaco/leads',
    links: [
      { name: 'Leads', href: '/dashboard/spartaco/leads', icon: BriefcaseBusiness },
      { name: 'eCommerce', href: '/dashboard/spartaco/ecommerce', icon: ShoppingBag },
      { name: 'Product Performance', href: '/dashboard/spartaco/products', icon: BarChart2 },
    ],
  },
  {
    id: 'nsi',
    name: 'NSI',
    defaultHref: '/dashboard/nsi',
    links: [
      { name: 'Performance', href: '/dashboard/nsi', icon: Zap },
      { name: 'Revenue Impact', href: '/dashboard/nsi/revenue', icon: TrendingUp },
    ],
  },
  {
    id: 'turfli',
    name: 'Turfli',
    defaultHref: '/dashboard/turfli',
    links: [
      { name: 'Performance', href: '/dashboard/turfli', icon: BarChart2 },
    ],
  },
  {
    id: 'goodgame',
    name: 'Good Game',
    defaultHref: '/dashboard/goodgame',
    links: [
      { name: 'Paid Media Performance', href: '/dashboard/goodgame', icon: BarChart2 },
    ],
  },
  {
    id: 'bridgeway',
    name: 'Bridgeway',
    defaultHref: '/dashboard/bridgeway',
    links: [
      { name: 'Performance', href: '/dashboard/bridgeway', icon: BarChart2 },
    ],
  },
  {
    id: 'arabella',
    name: 'Arabella Hotels',
    defaultHref: '/dashboard/arabella',
    links: [
      { name: 'Performance', href: '/dashboard/arabella', icon: BarChart2 },
    ],
  },
  {
    id: 'kinsey',
    name: 'Kinsey Design',
    defaultHref: '/dashboard/kinsey',
    links: [
      { name: 'Performance', href: '/dashboard/kinsey', icon: BarChart2 },
    ],
  },
] as const;

type ClientId = (typeof CLIENTS)[number]['id'];

function detectClientFromPath(pathname: string): ClientId | null {
  if (pathname.startsWith('/dashboard/spartaco')) return 'spartaco';
  if (pathname.startsWith('/dashboard/nsi')) return 'nsi';
  if (pathname.startsWith('/dashboard/turfli')) return 'turfli';
  if (pathname.startsWith('/dashboard/goodgame')) return 'goodgame';
  if (pathname.startsWith('/dashboard/bridgeway')) return 'bridgeway';
  if (pathname.startsWith('/dashboard/arabella')) return 'arabella';
  if (pathname.startsWith('/dashboard/kinsey')) return 'kinsey';
  if (pathname === '/dashboard/settings') return null; // don't switch context for shared pages
  return 'prepass';
}

type Profile = {
  role: 'super_admin' | 'agency' | 'client';
  client_access: string[] | null; // null = all clients
  full_name: string | null;
};

function getAllowedClients(profile: Profile | null): typeof CLIENTS[number][] {
  if (!profile || profile.role === 'super_admin' || profile.role === 'agency') {
    return [...CLIENTS];
  }
  // client role: restrict to client_access list
  const allowed = profile.client_access ?? [];
  return CLIENTS.filter((c) => allowed.includes(c.id));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeClient, setActiveClient] = useState<ClientId>(() =>
    detectClientFromPath(pathname) ?? 'prepass'
  );

  // Sync active client when navigating — null means shared page (settings), keep current context
  useEffect(() => {
    const clientId = detectClientFromPath(pathname);
    if (clientId !== null) setActiveClient(clientId);
  }, [pathname]);

  useEffect(() => {
    async function checkUser() {
      try {
        // getSession() reads from the cookie — no network call.
        // The middleware already validated the session before this page loaded.
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from('profiles')
          .select('role, client_access, full_name')
          .eq('id', user.id)
          .single();

        const fetchedProfile = data as Profile | null;
        setProfile(fetchedProfile);

        const allowed = getAllowedClients(fetchedProfile);
        const currentClientId = detectClientFromPath(pathname);
        if (currentClientId !== null && !allowed.find((c) => c.id === currentClientId)) {
          // Full reload so the layout re-mounts at the correct URL.
          // router.replace() keeps the layout alive and setLoading(false) never fires.
          window.location.href = allowed[0]?.defaultHref ?? '/login';
          return;
        }

        if (currentClientId !== null) setActiveClient(currentClientId);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }
    checkUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClientSwitch(clientId: ClientId) {
    if (clientId === activeClient) return;
    setActiveClient(clientId);
    const client = CLIENTS.find((c) => c.id === clientId)!;
    router.push(client.defaultHref);
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="h-screen w-screen bg-brand-forest flex items-center justify-center">
       <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans">
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        animate={{ width: sidebarOpen ? 280 : 0 }}
        className={cn(
          "bg-brand-forest text-white h-screen sticky top-0 z-50 overflow-hidden flex flex-col transition-all duration-300 shadow-2xl",
          !sidebarOpen && "lg:w-0"
        )}
      >
        <div className="h-20 flex items-center px-8 border-b border-white/10 shrink-0">
          {sidebarOpen ? (
            <img src="/logo-white.svg" alt="EIC Agency" className="h-8 w-auto" />
          ) : (
            <img src="/favicon.svg" alt="EIC" className="h-8 w-8" />
          )}
        </div>

        {/* Client switcher — only shown when user has access to 2+ clients */}
        {(() => {
          const allowedClients = getAllowedClients(profile);
          return allowedClients.length > 1 ? (
            <div className="px-4 pt-6 pb-2 shrink-0">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-2 mb-2">Client</p>
              <div className="relative">
                <select
                  value={activeClient}
                  onChange={(e) => handleClientSwitch(e.target.value as ClientId)}
                  className="w-full appearance-none bg-white/10 text-white font-semibold text-sm rounded-xl px-4 py-2.5 pr-9 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
                >
                  {allowedClients.map((client) => (
                    <option key={client.id} value={client.id} className="bg-[#0B4A31] text-white">
                      {client.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
              </div>
            </div>
          ) : null;
        })()}

        <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
          {(CLIENTS.find((c) => c.id === activeClient) ?? CLIENTS[0]).links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group font-medium",
                pathname === link.href
                  ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <link.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", pathname === link.href ? "text-white" : "text-white/40")} />
              <span className="whitespace-nowrap">{link.name}</span>
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10 mt-2">
            <Link
              href="/dashboard/settings"
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group font-medium",
                pathname === '/dashboard/settings'
                  ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Settings className={cn("w-5 h-5 transition-transform group-hover:scale-110", pathname === '/dashboard/settings' ? "text-white" : "text-white/40")} />
              <span className="whitespace-nowrap">Settings</span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search analytics..." 
                className="bg-gray-50 border border-gray-100 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-50 rounded-full transition-colors relative text-gray-500">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-orange rounded-full border-2 border-white" />
            </button>
            <div className="h-10 w-10 rounded-full bg-brand-forest flex items-center justify-center text-white font-bold border-2 border-white shadow-md">
              JD
            </div>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
