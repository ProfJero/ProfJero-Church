import type { BadgeTone } from './permissions';
import type { MembershipStatus } from './types';

export const STATUS_META: Record<MembershipStatus, { label: string; tone: BadgeTone }> = {
  visitor: { label: 'Visitor', tone: 'neutral' },
  first_timer: { label: 'First-timer', tone: 'gold' },
  new_convert: { label: 'New convert', tone: 'info' },
  member: { label: 'Member', tone: 'brand' },
  worker: { label: 'Worker', tone: 'success' },
  leader: { label: 'Leader', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'warning' },
  transferred: { label: 'Transferred', tone: 'neutral' },
  deceased: { label: 'Deceased', tone: 'neutral' },
};
