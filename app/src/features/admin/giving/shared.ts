import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { isoDate } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'Mobile Money' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];
export const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;

export type PeriodKey = 'this_month' | 'last_month' | 'last_3' | 'this_year' | 'last_year' | 'custom';
export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom' },
];

export function periodRange(key: PeriodKey, custom?: { from: string; to: string }) {
  const now = new Date();
  switch (key) {
    case 'this_month':
      return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
    case 'last_month': {
      const d = subMonths(now, 1);
      return { from: isoDate(startOfMonth(d)), to: isoDate(endOfMonth(d)) };
    }
    case 'last_3':
      return { from: isoDate(startOfMonth(subMonths(now, 2))), to: isoDate(endOfMonth(now)) };
    case 'this_year':
      return { from: isoDate(startOfYear(now)), to: isoDate(endOfYear(now)) };
    case 'last_year': {
      const d = subYears(now, 1);
      return { from: isoDate(startOfYear(d)), to: isoDate(endOfYear(d)) };
    }
    default:
      return custom ?? { from: isoDate(startOfMonth(now)), to: isoDate(now) };
  }
}
