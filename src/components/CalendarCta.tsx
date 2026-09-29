'use client';

import { ArrowDown, CalendarDays } from 'lucide-react';

type CalendarCtaProps = {
  label?: string;
  inverse?: boolean;
};

export default function CalendarCta({
  label = 'Book your free audit',
  inverse = false,
}: CalendarCtaProps) {
  const scrollToCalendar = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const calendar = document.getElementById('calendar');

    if (!calendar) return;

    event.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    calendar.focus({ preventScroll: true });
    calendar.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', '#calendar');
  };

  return (
    <a
      href="#calendar"
      onClick={scrollToCalendar}
      data-cta="calendar"
      className={
        inverse
          ? 'inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-black text-brand-forest shadow-lg transition hover:-translate-y-0.5 hover:bg-[#f7f4ef] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
          : 'inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-brand-orange/20 transition hover:-translate-y-0.5 hover:bg-[#d94712] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange'
      }
    >
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowDown className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
