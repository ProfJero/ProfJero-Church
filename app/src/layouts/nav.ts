import {
  LayoutDashboard, Users, UsersRound, Route, CalendarCheck2, HandCoins, CalendarDays, Newspaper, HeartHandshake,
  MessageSquareText, BarChart3, ShieldCheck, Settings, ScrollText, Home, BookOpen, HandHeart, User, PlaySquare, type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  anyOf?: Permission[];
  end?: boolean;
}

export const ADMIN_NAV: { label: string; items: NavItem[] }[] = [
  { label: '', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true }] },
  {
    label: 'People',
    items: [
      { to: '/admin/people', label: 'Directory', icon: Users, permission: 'people.view' },
      { to: '/admin/groups', label: 'Groups & ministries', icon: UsersRound, permission: 'people.view' },
      { to: '/admin/follow-ups', label: 'Follow-ups', icon: Route, permission: 'followups.manage' },
    ],
  },
  {
    label: 'Ministry',
    items: [
      { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck2, permission: 'attendance.manage' },
      { to: '/admin/events', label: 'Events', icon: CalendarDays, permission: 'events.manage' },
      { to: '/admin/content', label: 'Content', icon: Newspaper, permission: 'content.manage' },
      { to: '/admin/care', label: 'Pastoral care', icon: HeartHandshake, permission: 'care.view' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { to: '/admin/giving', label: 'Giving & finance', icon: HandCoins, permission: 'giving.view' },
      { to: '/admin/messages', label: 'Messages', icon: MessageSquareText, anyOf: ['messaging.sms', 'messaging.push'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
      { to: '/admin/users', label: 'Users & roles', icon: ShieldCheck, permission: 'users.manage' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
      { to: '/admin/audit', label: 'Activity log', icon: ScrollText, permission: 'audit.view' },
    ],
  },
];

export const MEMBER_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/give', label: 'Give', icon: HandHeart },
  { to: '/care', label: 'Care', icon: HeartHandshake },
  { to: '/me', label: 'Me', icon: User },
];

export const MEMBER_EXTRA: NavItem[] = [
  { to: '/devotionals', label: 'Devotionals', icon: BookOpen },
  { to: '/sermons', label: 'Sermons', icon: PlaySquare },
];

export function visible(item: NavItem, can: (p: Permission) => boolean) {
  if (item.permission && !can(item.permission)) return false;
  if (item.anyOf && !item.anyOf.some(can)) return false;
  return true;
}
