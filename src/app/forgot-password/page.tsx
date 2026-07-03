'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-forest text-white flex flex-col items-center justify-center p-6 selection:bg-brand-orange/30">
      <Link
        href="/login"
        className="absolute top-10 left-10 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <img src="/logo-white.svg" alt="EIC Agency" className="h-10 w-auto mx-auto mb-8" />
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Reset Password</h1>
          <p className="text-white/50">We&apos;ll email you a secure link to set a new password</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-sm">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-300" />
              </div>
              <h2 className="text-xl font-bold">Check your inbox</h2>
              <p className="text-white/50 text-sm">
                If an account exists for <span className="text-white/80 font-medium">{email}</span>, a password reset link is on its way. The link expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 text-brand-orange font-bold hover:underline"
              >
                Return to login
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Send Reset Link
                    <Mail className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-sm text-white/40">
              Remembered it? <Link href="/login" className="text-brand-orange font-bold hover:underline">Sign in</Link>
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
