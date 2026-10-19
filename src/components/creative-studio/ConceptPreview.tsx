'use client';

import { BarChart3, Check, CheckSquare2, FileText, MessageSquareText, Play, ReceiptText, Sparkles } from 'lucide-react';
import type { GeneratedConcept } from '@/lib/creative-studio/strategy';

const familyIcons = {
  receipt: ReceiptText,
  'text-thread': MessageSquareText,
  'founder-reel': Play,
  'founder-note': FileText,
  tracker: CheckSquare2,
  editorial: FileText,
  'job-post': FileText,
  'comment-thread': MessageSquareText,
  math: BarChart3,
  comparison: BarChart3,
  'communication-proof': MessageSquareText,
  'problem-solution': Sparkles,
  'proof-card': CheckSquare2,
  'product-demo': Play,
  scorecard: CheckSquare2,
  'benchmark-chart': BarChart3,
  calculator: BarChart3,
  'case-study': FileText,
  checklist: CheckSquare2,
} as const;

function shortCopy(value: string, limit = 150) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function FamilyMockup({ concept }: { concept: GeneratedConcept }) {
  if (concept.visualFamily === 'text-thread' || concept.visualFamily === 'comment-thread' || concept.visualFamily === 'communication-proof') {
    return <div className="cb-mock-phone"><div className="cb-mock-phone-head"><span>EIC</span><small>Messages</small></div><div className="cb-mock-bubble is-incoming">{shortCopy(concept.headline, 72)}</div><div className="cb-mock-bubble is-outgoing">{shortCopy(concept.primaryText, 118)}</div><div className="cb-mock-compose">Message</div></div>;
  }
  if (concept.visualFamily === 'founder-note') {
    return <div className="cb-mock-note"><small>Founder-note layout</small><strong>{concept.headline}</strong><p>{shortCopy(concept.primaryText, 180)}</p><span>{concept.cta}</span></div>;
  }
  if (concept.visualFamily === 'editorial' || concept.visualFamily === 'job-post') {
    return <div className="cb-mock-editorial"><div><span>EIC FIELD NOTES</span><small>Special report</small></div><strong>{concept.headline}</strong><p>{shortCopy(concept.primaryText, 165)}</p><span className="cb-mock-cta">{concept.cta}</span></div>;
  }
  if (concept.visualFamily === 'tracker' || concept.visualFamily === 'checklist' || concept.visualFamily === 'scorecard') {
    return <div className="cb-mock-tracker"><div><small>CHECKLIST LAYOUT</small><strong>{concept.headline}</strong></div>{[concept.title,concept.description,concept.cta].map((label,index)=><div key={`${index}-${label}`}><span><Check size={12} aria-hidden="true" /></span><p>{shortCopy(label, 54)}</p><small>{String(index+1).padStart(2,'0')}</small></div>)}</div>;
  }
  if (concept.visualFamily === 'math' || concept.visualFamily === 'calculator' || concept.visualFamily === 'benchmark-chart') {
    return <div className="cb-mock-math"><small>CALCULATION LAYOUT</small><strong>{concept.headline}</strong><div><span>{shortCopy(concept.title, 34)}</span><b>+</b><span>{shortCopy(concept.description, 34)}</span><b>→</b><span>{concept.cta}</span></div><p>{shortCopy(concept.primaryText, 120)}</p></div>;
  }
  if (concept.visualFamily === 'comparison' || concept.visualFamily === 'problem-solution') {
    return <div className="cb-mock-compare"><strong>{concept.headline}</strong><div><span><small>Direction A</small>{shortCopy(concept.title, 60)}</span><span><small>Direction B</small>{shortCopy(concept.description, 60)}</span></div><p>{shortCopy(concept.primaryText, 120)}</p></div>;
  }
  const Icon = familyIcons[concept.visualFamily];
  return <div className="cb-mock-generic"><Icon size={28} aria-hidden="true" /><strong>{concept.headline}</strong><p>{shortCopy(concept.primaryText, 170)}</p><span>{concept.cta}</span></div>;
}

export default function ConceptPreview({ concept }: { concept: GeneratedConcept }) {
  const Icon = familyIcons[concept.visualFamily];
  return (
    <div className={`cb-concept-preview cb-family-${concept.visualFamily}`} aria-label={`${concept.title} concept mockup`}>
      <div className="cb-preview-topline"><span>Illustrative concept mockup</span><Icon size={18} aria-hidden="true" /></div>
      <FamilyMockup concept={concept} />
      {!concept.staticOutput && <div className="cb-preview-overlay"><Play size={20} fill="currentColor" aria-hidden="true" /> Planning treatment</div>}
    </div>
  );
}
