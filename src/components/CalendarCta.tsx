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
    const calendarHeading = document.getElementById('calendar-heading');

    if (!calendar || !calendarHeading) return;

    event.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    calendarHeading.focus({ preventScroll: true });
    calendar.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (window.location.hash !== '#calendar') {
      window.history.pushState(null, '', '#calendar');
    }
  };

  return (
    <a
      href="#calendar"
      onClick={scrollToCalendar}
      data-cta="calendar"
      className={
        inverse
          ? 'inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-black text-brand-forest shadow-lg transition hover:-translate-y-0.5 hover:bg-[#f7f4ef] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
          : 'inline-flex items-center justify-center gap-2 rounded-full bg-[#c2410c] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-brand-orange/20 transition hover:-translate-y-0.5 hover:bg-[#9a3412] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-forest'
      }
    >
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowDown className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
