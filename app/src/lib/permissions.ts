import type { Role } from './types';

/**
 * Role → permission matrix. Keep in sync with /firestore.rules, which enforces
 * the same rules server-side; the UI only hides what a role cannot do.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'people.view',
  'people.manage',
  'people.delete',
  'groups.manage',
  'followups.manage',
  'attendance.manage',
  'giving.view',
  'giving.manage',
  'expenses.manage',
  'events.manage',
  'content.manage',
  'care.view',
  'care.manage',
  'care.confidential',
  'messaging.sms',
  'messaging.push',
  'reports.view',
  'users.manage',
  'settings.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: ALL,
  admin: ALL,
  pastor: [
    'dashboard.view', 'people.view', 'people.manage', 'groups.manage', 'followups.manage',
    'attendance.manage', 'giving.view', 'events.manage', 'content.manage', 'care.view',
    'care.manage', 'care.confidential', 'messaging.sms', 'messaging.push', 'reports.view',
  ],
  treasurer: ['dashboard.view', 'people.view', 'giving.view', 'giving.manage', 'expenses.manage', 'reports.view'],
  secretary: [
    'dashboard.view', 'people.view', 'people.manage', 'groups.manage', 'followups.manage',
    'attendance.manage', 'events.manage', 'content.manage', 'messaging.sms', 'messaging.push',
    'reports.view',
  ],
  staff: ['dashboard.view', 'people.view', 'attendance.manage', 'followups.manage'],
  viewer: ['dashboard.view', 'people.view', 'reports.view'],
  member: [],
};

export const ROLE_META: Record<Role, { label: string; description: string; tone: BadgeTone }> = {
  super_admin: { label: 'Super Admin', description: 'Full access, including roles and settings', tone: 'danger' },
  admin: { label: 'Administrator', description: 'Runs day-to-day church operations', tone: 'brand' },
  pastor: { label: 'Pastor', description: 'People, care, content and messaging', tone: 'info' },
  treasurer: { label: 'Treasurer', description: 'Giving, pledges and expenses', tone: 'success' },
  secretary: { label: 'Secretary', description: 'People, attendance, events and messaging', tone: 'warning' },
  staff: { label: 'Ministry Staff', description: 'Attendance and follow-ups', tone: 'neutral' },
  viewer: { label: 'Viewer', description: 'Read-only dashboards and reports', tone: 'neutral' },
  member: { label: 'Member', description: 'Member app only', tone: 'neutral' },
};

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

export const STAFF_ROLES: Role[] = ['super_admin', 'admin', 'pastor', 'treasurer', 'secretary', 'staff', 'viewer'];

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isStaff(role: Role | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Roles a given admin may assign. Only super admins can create other super admins. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'super_admin') return ['super_admin', 'admin', 'pastor', 'treasurer', 'secretary', 'staff', 'viewer', 'member'];
  if (actor === 'admin') return ['admin', 'pastor', 'treasurer', 'secretary', 'staff', 'viewer', 'member'];
  return [];
}
