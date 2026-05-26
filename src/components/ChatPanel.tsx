'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Maximize2, Minimize2, Send, Loader2,
  BarChart3, Sparkles, Play, ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { CampaignRow, MetaChatCreative, GoogleChatCreative, BudgetPacingRow } from '@/services/chat-analytics';

type Mode = 'closed' | 'panel' | 'fullscreen';

// ─── Suggested prompts ────────────────────────────────────────────────────────

const PREPASS_PROMPTS = [
  { label: 'Best ABM creatives', prompt: 'Show me the best-performing ABM Meta creatives for the last 30 days, ranked by CPL.' },
  { label: 'Campaign funnel', prompt: 'Which ABM campaigns are driving the most MQLs and won deals? Show cost per MQL, SQL, and Won.' },
  { label: 'Google vs Meta', prompt: 'Compare Google vs Meta efficiency across all segments — spend, MQLs, and cost per MQL.' },
  { label: 'Budget pacing', prompt: 'How are we tracking against budget this month for each segment?' },
  { label: 'Top SMB campaigns', prompt: 'Show me the top SMB Google campaigns by Cost Per Won in the last 30 days.' },
];

// ─── CTA map ──────────────────────────────────────────────────────────────────

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Learn More', SIGN_UP: 'Sign Up', DOWNLOAD: 'Download',
  GET_QUOTE: 'Get a Quote', CONTACT_US: 'Contact Us', GET_STARTED: 'Get Started',
  APPLY_NOW: 'Apply Now', BOOK_NOW: 'Book Now', WATCH_MORE: 'Watch More',
};
function ctaLabel(raw: string) {
  return CTA_LABELS[raw] ?? (raw?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Learn More');
}

// ─── Ad gradient ──────────────────────────────────────────────────────────────

const AD_GRADIENTS: [string, string][] = [
  ['#EDE9FE', '#C4B5FD'], ['#E0F2FE', '#7DD3FC'], ['#D1FAE5', '#6EE7B7'],
  ['#FEF3C7', '#FCD34D'], ['#FFE4E6', '#FDA4AF'], ['#E0E7FF', '#A5B4FC'],
];
function adGradient(name: string): [string, string] {
  if (!name) return AD_GRADIENTS[0];
  const idx = (name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0)) % AD_GRADIENTS.length;
  return AD_GRADIENTS[idx] ?? AD_GRADIENTS[0];
}

// ─── Meta Creative Card ───────────────────────────────────────────────────────

function MetaCard({ ad, rank, size }: { ad: MetaChatCreative; rank: number; size: 'compact' | 'full' }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [from, to] = adGradient(ad.adName || ad.headline);
  const hasImage = Boolean(
    !imgError &&
    ad.finalCreativeLink &&
    !ad.finalCreativeLink.includes('null') &&
    ad.finalCreativeLink.startsWith('http'),
  );

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.finalCreativeLink} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
          )}
          {ad.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded">
              #{rank}
            </span>
            {rank === 1 && <span className="text-[10px] text-amber-600 font-semibold">Top Performer</span>}
          </div>
          <p className="text-xs font-semibold text-gray-800 truncate">{ad.headline || '(no headline)'}</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="text-[11px] font-bold text-brand-forest">
              {ad.cpl != null ? `$${ad.cpl.toFixed(2)}` : '—'} CPL
            </span>
            <span className="text-[11px] text-gray-500">{ad.leads} leads</span>
            <span className="text-[11px] text-gray-400">
              {ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—'} CTR
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full card — renders at Facebook feed dimensions (~380px wide)
  return (
    <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Rank badge row */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-50">
        <span className={cn(
          'text-xs font-bold px-2.5 py-1 rounded-full',
          rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500',
        )}>
          #{rank}{rank === 1 ? ' · Top Performer' : ''}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{ad.campaign}</span>
      </div>

      {/* Facebook-style ad header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">PRE</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">PrePass</p>
          <p className="text-[11px] text-gray-400 leading-tight">Sponsored · 🌐</p>
        </div>
      </div>

      {/* Primary text */}
      {ad.primaryText && (
        <div className="px-4 pb-2 text-[13px] text-gray-700 leading-relaxed">
          {ad.primaryText.length > 125 ? `${ad.primaryText.slice(0, 125)}…` : ad.primaryText}
        </div>
      )}

      {/* Creative — 1.91:1 aspect ratio (Facebook landscape) */}
      <div
        className="relative w-full overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, aspectRatio: '1.91' }}
        onClick={() => ad.isVideo && ad.videoUrl && setVideoOpen(true)}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.finalCreativeLink} alt={ad.headline} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        )}
        {ad.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/40 backdrop-blur-sm rounded-full w-14 h-14 flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Video modal */}
      {videoOpen && ad.videoUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-6"
          onClick={() => setVideoOpen(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
              onClick={() => setVideoOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={ad.videoUrl} controls autoPlay className="w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* Headline + CTA */}
      <div className="px-4 pt-2.5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {ad.headline || '(no headline)'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">prepass.com</p>
        </div>
        <button className="shrink-0 bg-[#1877F2] text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
          {ctaLabel(ad.ctaType)}
        </button>
      </div>

      {/* Engagement bar */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-4 border-t border-gray-100 bg-gray-50">
        {[
          { label: 'CPL', value: ad.cpl != null ? `$${ad.cpl.toFixed(2)}` : '—' },
          { label: 'Leads', value: ad.leads.toString() },
          { label: 'CTR', value: ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—' },
          { label: 'Spend', value: `$${Math.round(ad.spend).toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} className="py-3 text-center border-r border-gray-100 last:border-r-0">
            <p className="text-sm font-bold text-gray-800">{value}</p>
            <p className="text-[10px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Google Search Card ────────────────────────────────────────────────────────

function GoogleCard({ ad, rank, size }: { ad: GoogleChatCreative; rank: number; size: 'compact' | 'full' }) {
  if (size === 'compact') {
    return (
      <div className="py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{rank}</span>
          <span className="text-[10px] text-gray-400 truncate">{ad.campaign}</span>
        </div>
        <p className="text-xs font-semibold text-[#1a0dab] truncate">
          {[ad.headline1, ad.headline2].filter(Boolean).join(' | ')}
        </p>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">{ad.description}</p>
        <div className="flex items-center gap-2.5 mt-1">
          <span className="text-[11px] font-bold text-brand-forest">{ad.results} results</span>
          <span className="text-[11px] text-gray-400">
            {ad.ctr != null ? `${ad.ctr.toFixed(1)}% CTR` : ''}
          </span>
          <span className="text-[11px] text-gray-400">${Math.round(ad.cost).toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // Full card — Google SERP mockup
  return (
    <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-50 flex items-center justify-between">
        <span className={cn(
          'text-xs font-bold px-2.5 py-1 rounded-full',
          rank === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500',
        )}>
          #{rank}
        </span>
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{ad.campaign}</span>
      </div>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] border border-[#70757a] text-[#70757a] px-1 py-0.5 rounded-sm">Ad</span>
          <span className="text-[12px] text-[#202124]">prepass.com</span>
        </div>
        <p className="text-[18px] text-[#1a0dab] font-normal leading-snug mb-1.5">
          {[ad.headline1, ad.headline2].filter(Boolean).join(' | ')}
        </p>
        <p className="text-[13px] text-[#4d5156] leading-relaxed">{ad.description}</p>
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100">
          {[
            { label: 'Results', value: ad.results.toString() },
            { label: 'Clicks', value: ad.clicks.toLocaleString() },
            { label: 'CTR', value: ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : '—' },
            { label: 'Spend', value: `$${Math.round(ad.cost).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-bold text-gray-800">{value}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Performance Table ───────────────────────────────────────────────

function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Campaign</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Spend</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">MQLs</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Won</th>
            <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-brand-forest">Cost/Won</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.slice(0, 10).map((r, i) => (
            <tr key={i} className={cn(
              'border-b border-gray-50 hover:bg-gray-50 transition-colors',
              i === 0 && r.costPerWon != null && 'bg-emerald-50/40',
            )}>
              <td className="px-3 py-2.5 max-w-[200px]">
                <p className="font-medium text-gray-800 truncate">{r.campaign}</p>
                <span className="text-[10px] text-gray-400">{r.platform}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-600">
                ${Math.round(r.spend).toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.mqls}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{r.won}</td>
              <td className={cn(
                'px-3 py-2.5 text-right font-bold',
                r.costPerWon != null ? 'text-brand-forest' : 'text-gray-300',
              )}>
                {r.costPerWon != null ? `$${Math.round(r.costPerWon).toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Budget Pacing Cards ──────────────────────────────────────────────────────

function BudgetPacingCards({ rows }: { rows: BudgetPacingRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {rows.map((r) => {
        const over = r.pctUsed > 100;
        return (
          <div key={r.focus} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">{r.focus}</span>
              <span className={cn('text-sm font-bold', over ? 'text-red-600' : 'text-brand-forest')}>
                {r.pctUsed.toFixed(0)}% used
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={cn('h-full rounded-full', over ? 'bg-red-400' : 'bg-brand-forest')}
                style={{ width: `${Math.min(r.pctUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>${Math.round(r.totalSpent).toLocaleString()} spent</span>
              <span>${Math.round(r.budget).toLocaleString()} budget</span>
            </div>
            <div className="flex gap-3 text-[11px] text-gray-400">
              <span>Google ${Math.round(r.googleSpent).toLocaleString()}</span>
              <span>·</span>
              <span>Meta ${Math.round(r.metaSpent).toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tool Result Renderer ──────────────────────────────────────────────────────

function ToolResult({ toolName, result, size }: {
  toolName: string;
  result: unknown;
  size: 'compact' | 'full';
}) {
  if (toolName === 'getMetaCreativePerformance') {
    const creatives = result as MetaChatCreative[];
    if (!creatives?.length) {
      return <p className="text-xs text-gray-400 italic">No creative data found for that filter.</p>;
    }
    return (
      <div className={cn('flex gap-4', size === 'full' ? 'flex-row flex-wrap' : 'flex-col')}>
        {creatives.map((ad, i) => <MetaCard key={i} ad={ad} rank={i + 1} size={size} />)}
      </div>
    );
  }
  if (toolName === 'getGoogleCreativePerformance') {
    const creatives = result as GoogleChatCreative[];
    if (!creatives?.length) {
      return <p className="text-xs text-gray-400 italic">No Google creative data found.</p>;
    }
    return (
      <div className={cn('flex gap-4', size === 'full' ? 'flex-row flex-wrap' : 'flex-col')}>
        {creatives.map((ad, i) => <GoogleCard key={i} ad={ad} rank={i + 1} size={size} />)}
      </div>
    );
  }
  if (toolName === 'getCampaignPerformance') {
    const campaigns = result as CampaignRow[];
    if (!campaigns?.length) {
      return <p className="text-xs text-gray-400 italic">No campaign data found.</p>;
    }
    return <CampaignTable campaigns={campaigns} />;
  }
  if (toolName === 'getBudgetPacing') {
    const rows = result as BudgetPacingRow[];
    if (!rows?.length) {
      return <p className="text-xs text-gray-400 italic">No budget data found.</p>;
    }
    return <BudgetPacingCards rows={rows} />;
  }
  return null;
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm w-fit shadow-sm">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 bg-brand-forest rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Main ChatPanel ────────────────────────────────────────────────────────────

export default function ChatPanel({ clientId }: { clientId: string }) {
  const [mode, setMode] = useState<Mode>('closed');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, status } = useChat({ transport });
  const isStreaming = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (mode !== 'closed') setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'closed') setMode('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage({ parts: [{ type: 'text', text }] });
  }, [input, isStreaming, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Only render for PrePass — each client will have its own config eventually
  if (clientId !== 'prepass') return null;

  // AI SDK v6: tool parts use type='dynamic-tool' with state='output-available' and an `output` field.
  // The old 'tool-call' / 'tool-result' types only exist on the streaming wire, not on UIMessage parts.
  const lastToolResultPart = messages
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === 'dynamic-tool' && (p as unknown as { state: string }).state === 'output-available')
    .at(-1) as unknown as { toolName: string; output: unknown } | undefined;
  const lastToolResult = lastToolResultPart
    ? { toolName: lastToolResultPart.toolName, result: lastToolResultPart.output }
    : undefined;

  // ─── Chat thread (shared between panel and fullscreen left column) ──────────

  const chatThread = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand-forest" />
              <p className="text-sm font-semibold text-gray-700">Ask about PrePass performance</p>
            </div>
            {PREPASS_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => sendMessage({ parts: [{ type: 'text', text: p.prompt }] })}
                className="w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-brand-forest/30 transition-all text-xs font-medium text-gray-700 flex items-center justify-between group shadow-sm"
              >
                <span>{p.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-forest transition-colors shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex flex-col gap-2', message.role === 'user' ? 'items-end' : 'items-start')}
            >
              {(message.parts ?? []).map((part, pidx) => {
                if (part.type === 'text' && part.text) {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={pidx}
                      className={cn(
                        'max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isUser
                          ? 'bg-brand-forest text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm',
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{part.text}</p>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            h1: ({ children }) => <p className="font-bold mb-1 mt-2">{children}</p>,
                            h2: ({ children }) => <p className="font-bold mb-1 mt-2">{children}</p>,
                            h3: ({ children }) => <p className="font-semibold mb-1 mt-2">{children}</p>,
                            ul: ({ children }) => <ul className="my-1.5 space-y-1 ml-1">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1.5 space-y-1 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="flex gap-1.5"><span className="text-brand-forest/50 shrink-0 mt-0.5 select-none">•</span><span className="min-w-0">{children}</span></li>,
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="w-full text-[11px] border-collapse border border-gray-100 rounded-lg overflow-hidden">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                            th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold text-gray-500 border border-gray-100 whitespace-nowrap">{children}</th>,
                            td: ({ children }) => <td className="px-2 py-1.5 border border-gray-100 text-gray-700">{children}</td>,
                            hr: () => <hr className="my-2 border-gray-100" />,
                            code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
                            a: ({ href, children }) => <a href={href ?? '#'} className="text-brand-forest underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-brand-forest/30 pl-3 my-1.5 text-gray-600 italic">{children}</blockquote>,
                          }}
                        >
                          {part.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  );
                }
                // AI SDK v6: tool parts have type='dynamic-tool', with state and output fields
                if (part.type === 'dynamic-tool') {
                  const p = part as unknown as { toolName: string; state: string; output?: unknown };
                  if (p.state === 'input-streaming' || p.state === 'input-available') {
                    const label =
                      p.toolName === 'getMetaCreativePerformance' ? 'Meta creatives'
                      : p.toolName === 'getGoogleCreativePerformance' ? 'Google ads'
                      : p.toolName === 'getCampaignPerformance' ? 'campaign data'
                      : p.toolName === 'getBudgetPacing' ? 'budget pacing'
                      : 'data';
                    return (
                      <div key={pidx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500 border border-gray-100">
                        <Loader2 className="w-3 h-3 animate-spin text-brand-forest shrink-0" />
                        <span>Fetching {label}…</span>
                      </div>
                    );
                  }
                  if (p.state === 'output-available') {
                    return (
                      <div key={pidx} className="w-full">
                        <ToolResult toolName={p.toolName} result={p.output} size="compact" />
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {isStreaming && messages.at(-1)?.role === 'user' && <LoadingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-brand-forest/40 focus-within:ring-2 focus-within:ring-brand-forest/10 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            placeholder="Ask about campaigns, creatives, budget…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: '20px', maxHeight: '120px' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-8 h-8 rounded-xl bg-brand-forest text-white flex items-center justify-center hover:bg-brand-forest/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating launch button */}
      <AnimatePresence>
        {mode === 'closed' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => setMode('panel')}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-forest text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
            title="Open AI assistant"
            data-pdf-hidden="true"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel mode — slides in from right */}
      <AnimatePresence>
        {mode === 'panel' && (
          <motion.div
            key="panel"
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col"
            data-pdf-hidden="true"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-forest flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">PrePass AI</p>
                  <p className="text-[10px] text-gray-400">Marketing intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode('fullscreen')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Expand to full screen (Esc to close)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode('closed')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {chatThread}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen mode — covers viewport */}
      <AnimatePresence>
        {mode === 'fullscreen' && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-[#F9FAFB] flex flex-col"
            data-pdf-hidden="true"
          >
            {/* Fullscreen header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-forest flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">PrePass AI — Creative Intelligence</p>
                  <p className="text-xs text-gray-400">Powered by Claude · EIC Agency</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMode('panel')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Shrink to panel"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode('closed')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Fullscreen body — chat left, creative grid right */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: narrow chat thread */}
              <div className="w-[380px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                {chatThread}
              </div>

              {/* Right: full-size creative / results grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {lastToolResult ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
                      {lastToolResult.toolName === 'getMetaCreativePerformance'
                        ? 'Meta Creatives — Ranked by CPL'
                        : lastToolResult.toolName === 'getGoogleCreativePerformance'
                        ? 'Google Search Ads'
                        : lastToolResult.toolName === 'getCampaignPerformance'
                        ? 'Campaign Performance'
                        : 'Budget Pacing'}
                    </p>
                    <ToolResult
                      toolName={lastToolResult.toolName}
                      result={lastToolResult.result}
                      size="full"
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center select-none">
                    <BarChart3 className="w-16 h-16 text-gray-200 mb-4" />
                    <p className="text-lg font-semibold text-gray-300">Creative results appear here</p>
                    <p className="text-sm text-gray-300 mt-1 max-w-xs">
                      Ask about campaigns or creatives in the chat column →
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
