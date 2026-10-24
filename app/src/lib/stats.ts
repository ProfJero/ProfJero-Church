import { addDays, format, startOfMonth, subMonths, parseISO, differenceInCalendarDays } from 'date-fns';
import type { Expense, Gift, Member, Service } from './types';
import { sum } from './utils';

export function serviceTotal(s: Service) {
  const h = s.headcount ?? { men: 0, women: 0, children: 0, visitors: 0 };
  const head = (h.men || 0) + (h.women || 0) + (h.children || 0) + (h.visitors || 0);
  return Math.max(head, s.checkins || 0);
}

/** Sunday-by-Sunday totals (all services on the same date summed). */
export function attendanceByDate(services: Service[], weeks = 10) {
  const byDate = new Map<string, number>();
  for (const s of services) byDate.set(s.date, (byDate.get(s.date) ?? 0) + serviceTotal(s));
  return [...byDate.entries()]
    .filter(([d]) => parseISO(d).getDay() === 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-weeks)
    .map(([date, total]) => ({ date, label: format(parseISO(date), 'd MMM'), total }));
}

export function monthKeys(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => format(subMonths(startOfMonth(now), n - 1 - i), 'yyyy-MM'));
}

export function monthlyFinance(gifts: Gift[], expenses: Expense[], months = 6) {
  const keys = monthKeys(months);
  return keys.map((k) => ({
    month: k,
    label: format(parseISO(k + '-01'), 'MMM'),
    income: sum(gifts.filter((g) => g.date.startsWith(k)), (g) => g.amount),
    expenses: sum(expenses.filter((e) => e.date.startsWith(k)), (e) => e.amount),
  }));
}

export function upcomingBirthdays(members: Member[], days = 7, from = new Date()) {
  const out: { member: Member; date: Date; inDays: number; turning: number | null }[] = [];
  for (const m of members) {
    if (!m.dob || ['deceased', 'transferred'].includes(m.membershipStatus)) continue;
    const dob = parseISO(m.dob);
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      if (d.getMonth() === dob.getMonth() && d.getDate() === dob.getDate()) {
        out.push({ member: m, date: d, inDays: i, turning: dob.getFullYear() > 1900 ? d.getFullYear() - dob.getFullYear() : null });
        break;
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

export function change(current: number, previous: number) {
  if (!previous) return null;
  return (current - previous) / previous;
}

export function daysSince(date?: string) {
  return date ? differenceInCalendarDays(new Date(), parseISO(date)) : Infinity;
}

export const ACTIVE_STATUSES = ['member', 'worker', 'leader', 'new_convert', 'first_timer'];
