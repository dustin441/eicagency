'use client';

import { useEffect } from 'react';
import { X, ShieldCheck, PhoneOff, Clock } from 'lucide-react';

interface CalculatorFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function CalculatorFormModal({ open, onClose }: CalculatorFormModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Free ROI Calculator Form"
    >
      <div className="absolute inset-0 bg-[#0B3C2D]/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#0B3C2D]/10 bg-[#f7f4ef] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-extrabold text-[#0B3C2D] sm:text-xl">Free ROI Analysis</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Personalized report by email in less than 10 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-[#0B3C2D]/10 hover:text-[#0B3C2D]"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1 border-b border-[#0B3C2D]/5 bg-white px-5 py-2.5 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0B3C2D]" /> 100% Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PhoneOff className="h-3.5 w-3.5 text-[#f6821f]" /> No phone required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#f6821f]" /> Delivered in &lt; 10 min
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <iframe
            src="https://link.eic.agency/widget/form/PywEWEn6fRZKILHCxHVy"
            style={{ width: '100%', height: '880px', border: 'none' }}
            id="inline-PywEWEn6fRZKILHCxHVy"
            title="NEW ROI Form"
          />
        </div>
      </div>
    </div>
  );
}
