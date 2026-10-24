import type { Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO, differenceInYears } from 'date-fns';

export const LOCALE = 'en-GH';

const money = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

/** GH₵ 1,250.00 — the cedi symbol is fine on screen (it's only SMS where it costs more). */
export function cedis(n: number | undefined | null, opts: { compact?: boolean } = {}) {
  const v = Number(n) || 0;
  if (opts.compact) return Math.abs(v) >= 10000 ? `GH₵ ${compact.format(v)}` : `GH₵ ${Math.round(v).toLocaleString(LOCALE)}`;
  return `GH₵ ${money.format(v)}`;
}

export function num(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString(LOCALE);
}

export function pct(n: number, digits = 0) {
  if (!isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function toDate(v: Timestamp | Date | string | number | null | undefined): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') return v.length <= 10 ? parseISO(v) : new Date(v);
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  return null;
}

export function fmtDate(v: Parameters<typeof toDate>[0], pattern = 'd MMM yyyy') {
  const d = toDate(v);
  return d ? format(d, pattern) : '—';
}

export function fmtDateTime(v: Parameters<typeof toDate>[0]) {
  return fmtDate(v, 'd MMM yyyy, h:mm a');
}

export function fmtTime(v: Parameters<typeof toDate>[0]) {
  return fmtDate(v, 'h:mm a');
}

export function relative(v: Parameters<typeof toDate>[0]) {
  const d = toDate(v);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  if (Math.abs(diff) < 45_000) return 'just now';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function friendlyDay(v: Parameters<typeof toDate>[0]) {
  const d = toDate(v);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM');
}

export function isoDate(d = new Date()) {
  return format(d, 'yyyy-MM-dd');
}

export function age(dob?: string) {
  const d = toDate(dob);
  return d ? differenceInYears(new Date(), d) : null;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function monthDay(dob?: string) {
  return dob && dob.length >= 10 ? dob.slice(5, 10) : undefined;
}
