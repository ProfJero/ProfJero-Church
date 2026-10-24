import type { BadgeTone } from './permissions';
import type { CareStatus, CareType } from './types';

export const CARE_TYPE: Record<CareType, { label: string; tone: BadgeTone }> = {
  prayer: { label: 'Prayer', tone: 'brand' },
  counselling: { label: 'Counselling', tone: 'info' },
  visit: { label: 'Visitation', tone: 'gold' },
  urgent: { label: 'Urgent', tone: 'danger' },
  thanksgiving: { label: 'Thanksgiving', tone: 'success' },
};
export const CARE_STATUS: Record<CareStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'brand' },
  in_progress: { label: 'In progress', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};
