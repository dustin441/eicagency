'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  return (
    <div className="min-h-screen bg-brand-forest text-white selection:bg-brand-orange/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-brand-forest/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center transform rotate-12">
              <span className="text-white -rotate-12 italic">E</span>
            </div>
            EIC AGENCY
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            <Link href="#services" className="hover:text-brand-orange transition-colors">Services</Link>
            <Link href="#results" className="hover:text-brand-orange transition-colors">Results</Link>
            <Link href="#about" className="hover:text-brand-orange transition-colors">About</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-brand-orange transition-colors">
              Client Login
            </Link>
            <button className="bg-brand-orange hover:bg-brand-orange/90 text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-brand-orange/20">
              Book a Call
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-40 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-orange rounded-full filter blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full filter blur-[100px]" />
          </div>

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase mb-8"
            >
              <span className="w-2 h-2 bg-brand-orange rounded-full animate-ping" />
              Next-Gen B2B Lead Generation
            </motion.div>

            <motion.h1 
              {...fadeInUp}
              className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.9]"
            >
              WE SCALE <span className="text-brand-orange italic">REVENUE</span><br />
              THROUGH DATA.
            </motion.h1>

            <motion.p
              initial="initial"
              animate="animate"
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } }
              }}
              className="text-xl md:text-2xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              Stop guessing on your marketing. Our analytics-first approach delivers predictable pipeline growth for high-growth B2B SaaS teams.
            </motion.p>

            <motion.div
              initial="initial"
              animate="animate"
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2 } }
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link href="#services" className="w-full sm:w-auto bg-brand-orange hover:bg-brand-orange/90 text-white px-10 py-5 rounded-full text-lg font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-3 group shadow-2xl shadow-brand-orange/40">
                Get Your Free Audit
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white px-10 py-5 rounded-full text-lg font-bold transition-all">
                View Client Portal
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="services" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <BarChart3 className="w-8 h-8 text-brand-orange" />,
                  title: "Precision ABM",
                  desc: "Hyper-targeted campaigns reaching the exact decision makers your sales team needs."
                },
                {
                  icon: <Zap className="w-8 h-8 text-brand-orange" />,
                  title: "Full-Funnel Analytics",
                  desc: "Complete visibility from first click to closed-won revenue in your custom portal."
                },
                {
                  icon: <Users className="w-8 h-8 text-brand-orange" />,
                  title: "SaaS Scale Mastery",
                  desc: "Proven frameworks specifically designed for high-growth software and tech services."
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/5 border border-white/10 p-10 rounded-3xl hover:bg-white/[0.07] transition-all group"
                >
                  <div className="mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-white/60 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section id="results" className="py-24 px-6 bg-brand-dark/50 border-t border-white/5">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-4xl md:text-6xl font-bold mb-12 tracking-tight">Proven Results.</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { label: "Pipeline Generated", val: "$142M+" },
                { label: "Average ROAS", val: "8.4x" },
                { label: "Ad Spend Managed", val: "$25M+" },
                { label: "Client Retention", val: "94%" }
              ].map((stat) => (
                <div key={stat.label} className="p-8 rounded-3xl bg-white/5 border border-white/10">
                  <div className="text-4xl font-bold text-brand-orange mb-2">{stat.val}</div>
                  <div className="text-sm font-semibold uppercase tracking-widest text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Prop Section */}
        <section id="about" className="py-24 px-6 bg-white text-brand-dark rounded-[4rem] mx-4 my-8">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-5xl font-bold leading-tight mb-8">
                Marketing reporting that finally <span className="text-brand-orange">makes sense.</span>
              </h2>
              <div className="space-y-6">
                {[
                  "Eliminate marketing blind spots with real-time attribution.",
                  "Custom dashboards built for executive decision making.",
                  "Integrated CRM and marketing platform reporting.",
                  "Zero fluff metrics. We focus on pipeline and revenue."
                ].map((text) => (
                  <div key={text} className="flex gap-4">
                    <CheckCircle2 className="w-6 h-6 text-brand-orange flex-shrink-0" />
                    <p className="font-medium text-lg text-brand-dark/80">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-brand-forest p-4 rounded-3xl shadow-2xl shadow-black/20">
                <div className="aspect-video bg-[#0d1117] rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                   {/* Placeholder for Dashboard interface animation */}
                   <div className="w-full h-full p-8 flex flex-col gap-4">
                      <div className="flex gap-4">
                         <div className="h-24 flex-1 bg-white/5 rounded-xl border border-white/10 p-4">
                            <div className="w-12 h-2 bg-brand-orange/50 rounded mb-4" />
                            <div className="w-20 h-4 bg-white/20 rounded" />
                         </div>
                         <div className="h-24 flex-1 bg-white/5 rounded-xl border border-white/10 p-4">
                            <div className="w-12 h-2 bg-brand-orange/50 rounded mb-4" />
                            <div className="w-16 h-4 bg-white/20 rounded" />
                         </div>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-3">
                         <div className="w-full h-2 bg-white/10 rounded" />
                         <div className="w-4/5 h-2 bg-white/10 rounded" />
                         <div className="w-full h-2 bg-white/10 rounded" />
                         <div className="mt-auto h-24 w-full border-b border-brand-orange/20 flex items-end gap-1">
                            {[40, 70, 45, 90, 65, 80, 55, 95].map((h, i) => (
                               <div key={i} className="flex-1 bg-brand-orange/30 rounded-t" style={{ height: `${h}%` }} />
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-6 -right-6 bg-brand-orange p-6 rounded-2xl text-white font-bold text-xl shadow-xl"
              >
                +142% ROAS
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 px-6 border-t border-white/5 text-center text-white/40 text-sm">
        <p>&copy; {new Date().getFullYear()} EIC Agency. All rights reserved.</p>
      </footer>
    </div>
  );
}
