'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-brand-forest text-white flex flex-col items-center justify-center p-6 selection:bg-brand-orange/30">
      <Link 
        href="/" 
        className="absolute top-10 left-10 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to marketing site
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <img src="/logo-white.svg" alt="EIC Agency" className="h-10 w-auto mx-auto mb-8" />
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Client Portal</h1>
          <p className="text-white/50">Access your custom marketing analytics dashboard</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-100 text-sm">
                 <AlertCircle className="w-5 h-5 flex-shrink-0" />
                 {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Work Email</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all placeholder:text-white/20"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all placeholder:text-white/20"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Secure Login
                  <ShieldCheck className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-sm text-white/40">
              New client? <Link href="/" className="text-brand-orange font-bold hover:underline">Get an Audit</Link>
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/30 uppercase tracking-widest font-semibold flex items-center justify-center gap-4">
          <span className="h-px bg-white/10 flex-1" />
          EIC Agency Analytics
          <span className="h-px bg-white/10 flex-1" />
        </p>
      </motion.div>
    </div>
  );
}
