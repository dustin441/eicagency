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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';

const sidebarLinks = [
  { name: 'Overall Performance', href: '/dashboard', icon: LayoutDashboard },
  { name: 'SMB Segments', href: '/dashboard/smb', icon: Users },
  { name: 'ABM Focus', href: '/dashboard/abm', icon: Target },
  { name: 'FD360 Campaigns', href: '/dashboard/fd360', icon: Layers },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

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

  useEffect(() => {
    async function checkUser() {
      // The middleware handles the redirect to /login if no user exists.
      // We still check here to update the local loading state and potentially
      // fetch user-specific data.
      const { data: { user } } = await supabase.auth.getUser();
      setLoading(false);
    }
    checkUser();
  }, [router, supabase]);

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

        <nav className="flex-1 py-10 px-4 space-y-2 overflow-y-auto">
          {sidebarLinks.map((link) => (
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
