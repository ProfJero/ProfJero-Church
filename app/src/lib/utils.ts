import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Lower-cased prefixes used for Firestore array-contains search. */
export function searchKeywords(...values: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    for (const word of v.toLowerCase().split(/[\s,.-]+/).filter(Boolean)) {
      for (let i = 2; i <= Math.min(word.length, 12); i++) out.add(word.slice(0, i));
    }
  }
  return [...out].slice(0, 120);
}

export function uid(prefix = '') {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  return prefix + Array.from(rnd, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

/** Short, human-friendly receipt numbers, e.g. CWC-2610-7KQ4M. */
export function receiptNumber(prefix = 'CWC', date = new Date()) {
  const yymm = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const rnd = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${yymm}-${Array.from(rnd, (b) => alphabet[b % alphabet.length]).join('')}`;
}

export function sum<T>(items: T[], pick: (t: T) => number) {
  return items.reduce((n, t) => n + (Number(pick(t)) || 0), 0);
}

export function groupBy<T>(items: T[], key: (t: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function titleCase(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function plural(n: number, word: string, pluralWord = word + 's') {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function excerpt(s: string | undefined, n = 140) {
  if (!s) return '';
  const t = stripHtml(s);
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}

export function youtubeId(url?: string) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
