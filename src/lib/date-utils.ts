export function toIsoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export function today() { 
  return toIsoDate(new Date()); 
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function subtractYear(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.abs(Math.round((db.getTime() - da.getTime()) / 86400000));
}

export function computeCompDates(
  start: string, 
  end: string, 
  mode: 'prev_period' | 'prev_year'
): { compStart: string; compEnd: string } {
  if (mode === 'prev_year') {
    return { compStart: subtractYear(start), compEnd: subtractYear(end) };
  }
  const span = daysBetween(start, end);
  const compEnd = addDays(start, -1);
  const compStart = addDays(compEnd, -span);
  return { compStart, compEnd };
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

export function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

export type PresetKey =
  | 'today' | 'yesterday'
  | 'last7' | 'last14' | 'last28' | 'last30' | 'last90'
  | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter'
  | 'thisYear' | 'trailing12'
  | 'custom';

export function getPresetDates(preset: PresetKey): { start: string; end: string } | null {
  const t = today();
  const yest = addDays(t, -1);
  const d = new Date(t + 'T12:00:00');
  switch (preset) {
    case 'today':     return { start: t, end: t };
    case 'yesterday': return { start: yest, end: yest };
    case 'last7':     return { start: addDays(yest, -6), end: yest };
    case 'last14':    return { start: addDays(yest, -13), end: yest };
    case 'last28':    return { start: addDays(yest, -27), end: yest };
    case 'last30':    return { start: addDays(yest, -29), end: yest };
    case 'last90':    return { start: addDays(yest, -89), end: yest };
    case 'thisMonth': {
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: s, end: yest };
    }
    case 'lastMonth': {
      const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const lme = new Date(d.getFullYear(), d.getMonth(), 0);
      return { start: lm.toISOString().split('T')[0], end: lme.toISOString().split('T')[0] };
    }
    case 'thisQuarter': {
      const q = Math.floor(d.getMonth() / 3);
      const qs = new Date(d.getFullYear(), q * 3, 1);
      return { start: qs.toISOString().split('T')[0], end: yest };
    }
    case 'lastQuarter': {
      const q = Math.floor(d.getMonth() / 3);
      const lqs = new Date(d.getFullYear(), (q - 1) * 3, 1);
      const lqe = new Date(d.getFullYear(), q * 3, 0);
      return { start: lqs.toISOString().split('T')[0], end: lqe.toISOString().split('T')[0] };
    }
    case 'thisYear':    return { start: `${d.getFullYear()}-01-01`, end: yest };
    case 'trailing12': {
      const s = new Date(d.getFullYear() - 1, d.getMonth() + 1, 1);
      return { start: s.toISOString().split('T')[0], end: yest };
    }
    default: return null;
  }
}

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'last7',        label: 'Last 7 days' },
  { key: 'last14',       label: 'Last 14 days' },
  { key: 'last28',       label: 'Last 28 days' },
  { key: 'last30',       label: 'Last 30 days' },
  { key: 'last90',       label: 'Last 90 days' },
  { key: 'thisMonth',    label: 'This month' },
  { key: 'lastMonth',    label: 'Last month' },
  { key: 'thisQuarter',  label: 'This quarter' },
  { key: 'lastQuarter',  label: 'Last quarter' },
  { key: 'thisYear',     label: 'This year' },
  { key: 'trailing12',  label: 'Trailing 12 months' },
  { key: 'custom',       label: 'Custom range' },
];

export function detectPreset(start: string, end: string): PresetKey {
  for (const p of PRESETS) {
    if (p.key === 'custom') continue;
    const dates = getPresetDates(p.key);
    if (dates && dates.start === start && dates.end === end) return p.key;
  }
  return 'custom';
}
