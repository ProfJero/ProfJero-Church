import { useDocument } from './db';
import { CHURCH_DEFAULTS } from '@/config';
import type { ChurchSettings } from './types';

export const DEFAULT_SETTINGS: ChurchSettings = {
  name: CHURCH_DEFAULTS.name,
  shortName: CHURCH_DEFAULTS.shortName,
  tagline: CHURCH_DEFAULTS.tagline,
  serviceTimes: 'Sundays 8:00 AM & 10:30 AM • Wednesdays 6:30 PM',
  serviceTypes: ['Sunday First Service', 'Sunday Second Service', 'Midweek Service', 'Prayer Meeting', 'Youth Service', 'Special Service'],
  givingCategories: ['Tithe', 'Offering', 'Thanksgiving', 'Seed', 'Building Fund', 'Welfare', 'Missions', 'Pledge Redemption', 'Harvest', 'Other'],
  expenseCategories: ['Utilities', 'Rent', 'Salaries & Allowances', 'Maintenance', 'Outreach & Missions', 'Welfare Support', 'Equipment', 'Transport', 'Hospitality', 'Office & Admin', 'Other'],
  eventCategories: ['Service', 'Conference', 'Crusade', 'Youth', 'Women', 'Men', 'Children', 'Prayer', 'Outreach', 'Fellowship', 'Other'],
  paymentAccounts: [],
  smsSenderId: '',
  smsSignature: '- CWC',
  welcomeSms: 'Dear {first_name|Beloved}, thank you for worshipping with us at Christian Worship Centre. We are glad you came and look forward to seeing you again. God bless you!',
  birthdaySms: 'Happy birthday {first_name|Beloved}! Christian Worship Centre celebrates you today. May the Lord bless you and keep you. Num 6:24',
  autoBirthdaySms: false,
  autoWelcomeSms: false,
};

export function useChurch(): ChurchSettings & { loading: boolean } {
  const { data, loading } = useDocument<ChurchSettings>('settings/church');
  return { ...DEFAULT_SETTINGS, ...(data ?? {}), loading };
}
