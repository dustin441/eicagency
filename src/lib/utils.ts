import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtNumber(value: number) {
  return Math.round(value).toLocaleString();
}

export function fmtCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

export function fmtCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export function fmtMoneyPrecise(value: number) {
  return `$${value.toFixed(2)}`;
}

export function fmtPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100.0%' : '0.0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
