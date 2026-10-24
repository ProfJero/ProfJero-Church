import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { db, useCollection, useDocument } from './db';
import type {
  Announcement,
  AppNotification,
  AuditLog,
  Campaign,
  CareLog,
  CareRequest,
  ChurchEvent,
  Devotional,
  Expense,
  FollowUp,
  Gift,
  Group,
  Household,
  Member,
  Pledge,
  Rsvp,
  Sermon,
  Service,
  AttendanceRecord,
  SmsMessage,
  SmsTemplate,
  Testimony,
  UserProfile,
} from './types';

const col = (name: string) => collection(db, name);

/* People ------------------------------------------------------------ */
export const useMembers = (enabled = true) =>
  useCollection<Member>(enabled ? 'members:all' : null, () => query(col('members'), orderBy('fullName')));
export const useMember = (id?: string | null) => useDocument<Member>(id ? `members/${id}` : null);
export const useHouseholdMembers = (householdId?: string | null) =>
  useCollection<Member>(householdId ? `members:hh:${householdId}` : null, () => query(col('members'), where('householdId', '==', householdId)));
export const useHousehold = (id?: string | null) => useDocument<Household>(id ? `households/${id}` : null);
export const useGroups = (enabled = true) => useCollection<Group>(enabled ? 'groups:all' : null, () => query(col('groups'), orderBy('name')));
export const useGroup = (id?: string) => useDocument<Group>(id ? `groups/${id}` : null);
export const useFollowUps = (enabled = true) =>
  useCollection<FollowUp>(enabled ? 'followups:all' : null, () => query(col('followups'), orderBy('createdAt', 'desc'), limit(500)));
export const useUsers = (enabled = true) => useCollection<UserProfile>(enabled ? 'users:all' : null, () => query(col('users'), orderBy('fullName')));

/* Attendance -------------------------------------------------------- */
export const useServices = (enabled = true, max = 120) =>
  useCollection<Service>(enabled ? `services:${max}` : null, () => query(col('services'), orderBy('date', 'desc'), limit(max)));
export const useService = (id?: string) => useDocument<Service>(id ? `services/${id}` : null);
export const useServiceAttendance = (serviceId?: string) =>
  useCollection<AttendanceRecord>(serviceId ? `attendance:svc:${serviceId}` : null, () =>
    query(col('attendance'), where('serviceId', '==', serviceId)),
  );
export const useMemberAttendance = (memberId?: string | null) =>
  useCollection<AttendanceRecord>(memberId ? `attendance:m:${memberId}` : null, () =>
    query(col('attendance'), where('memberId', '==', memberId), orderBy('date', 'desc'), limit(60)),
  );

/* Giving ------------------------------------------------------------ */
export const useGiftsSince = (since: string, enabled = true) =>
  useCollection<Gift>(enabled ? `gifts:since:${since}` : null, () => query(col('gifts'), where('date', '>=', since), orderBy('date', 'desc')));
export const useMemberGifts = (memberId?: string | null) =>
  useCollection<Gift>(memberId ? `gifts:m:${memberId}` : null, () => query(col('gifts'), where('memberId', '==', memberId), orderBy('date', 'desc'), limit(200)));
export const useExpensesSince = (since: string, enabled = true) =>
  useCollection<Expense>(enabled ? `expenses:since:${since}` : null, () => query(col('expenses'), where('date', '>=', since), orderBy('date', 'desc')));
export const useCampaigns = (enabled = true) =>
  useCollection<Campaign>(enabled ? 'campaigns:all' : null, () => query(col('campaigns'), orderBy('createdAt', 'desc')));
export const usePledges = (enabled = true) => useCollection<Pledge>(enabled ? 'pledges:all' : null, () => query(col('pledges'), orderBy('createdAt', 'desc')));
export const useMemberPledges = (memberId?: string | null) =>
  useCollection<Pledge>(memberId ? `pledges:m:${memberId}` : null, () => query(col('pledges'), where('memberId', '==', memberId)));

/* Content ----------------------------------------------------------- */
export const useEvents = (enabled = true) => useCollection<ChurchEvent>(enabled ? 'events:all' : null, () => query(col('events'), orderBy('startAt', 'desc'), limit(300)));
export const usePublishedEvents = () =>
  useCollection<ChurchEvent>('events:pub', () => query(col('events'), where('status', '==', 'published'), orderBy('startAt', 'desc'), limit(150)));
export const useEvent = (id?: string) => useDocument<ChurchEvent>(id ? `events/${id}` : null);
export const useRsvps = (eventId?: string, enabled = true) =>
  useCollection<Rsvp>(eventId && enabled ? `rsvps:${eventId}` : null, () => collection(db, 'events', eventId!, 'rsvps'));
export const useMyRsvp = (eventId?: string, uid?: string) => useDocument<Rsvp>(eventId && uid ? `events/${eventId}/rsvps/${uid}` : null);

export const useDevotionals = (enabled = true) =>
  useCollection<Devotional>(enabled ? 'devotionals:all' : null, () => query(col('devotionals'), orderBy('date', 'desc'), limit(400)));
export const usePublishedDevotionals = (today: string) =>
  useCollection<Devotional>(`devotionals:pub:${today}`, () =>
    query(col('devotionals'), where('status', '==', 'published'), where('date', '<=', today), orderBy('date', 'desc'), limit(120)),
  );
export const useDevotional = (id?: string) => useDocument<Devotional>(id ? `devotionals/${id}` : null);

export const useSermons = (enabled = true) => useCollection<Sermon>(enabled ? 'sermons:all' : null, () => query(col('sermons'), orderBy('date', 'desc'), limit(300)));
export const usePublishedSermons = () =>
  useCollection<Sermon>('sermons:pub', () => query(col('sermons'), where('status', '==', 'published'), orderBy('date', 'desc'), limit(150)));
export const useSermon = (id?: string) => useDocument<Sermon>(id ? `sermons/${id}` : null);

export const useAnnouncements = (enabled = true) =>
  useCollection<Announcement>(enabled ? 'announcements:all' : null, () => query(col('announcements'), orderBy('createdAt', 'desc'), limit(200)));
export const usePublishedAnnouncements = () =>
  useCollection<Announcement>('announcements:pub', () =>
    query(col('announcements'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(30)),
  );

/* Care -------------------------------------------------------------- */
export const useCareRequests = (enabled = true) =>
  useCollection<CareRequest>(enabled ? 'care:all' : null, () => query(col('care_requests'), orderBy('createdAt', 'desc'), limit(500)));
export const useMyCareRequests = (uid?: string) =>
  useCollection<CareRequest>(uid ? `care:mine:${uid}` : null, () => query(col('care_requests'), where('uid', '==', uid), orderBy('createdAt', 'desc')));
export const usePrayerWall = () =>
  useCollection<CareRequest>('care:wall', () =>
    query(col('care_requests'), where('visibility', '==', 'public'), where('type', '==', 'prayer'), orderBy('createdAt', 'desc'), limit(60)),
  );
export const useCareRequest = (id?: string) => useDocument<CareRequest>(id ? `care_requests/${id}` : null);
export const useCareLogs = (enabled = true) => useCollection<CareLog>(enabled ? 'carelogs:all' : null, () => query(col('care_logs'), orderBy('date', 'desc'), limit(300)));
export const useMemberCareLogs = (memberId?: string | null, enabled = true) =>
  useCollection<CareLog>(memberId && enabled ? `carelogs:m:${memberId}` : null, () => query(col('care_logs'), where('memberId', '==', memberId), orderBy('date', 'desc')));
export const useTestimonies = (enabled = true) =>
  useCollection<Testimony>(enabled ? 'testimonies:all' : null, () => query(col('testimonies'), orderBy('createdAt', 'desc'), limit(200)));
export const usePublishedTestimonies = () =>
  useCollection<Testimony>('testimonies:pub', () => query(col('testimonies'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(40)));

/* Messaging --------------------------------------------------------- */
export const useSmsMessages = (enabled = true) =>
  useCollection<SmsMessage>(enabled ? 'sms:all' : null, () => query(col('sms_messages'), orderBy('createdAt', 'desc'), limit(200)));
export const useSmsTemplates = (enabled = true) => useCollection<SmsTemplate>(enabled ? 'smstpl:all' : null, () => query(col('sms_templates'), orderBy('name')));
export const useNotificationsFeed = (uid?: string) =>
  useCollection<AppNotification>(uid ? `notif:${uid}` : null, () =>
    query(col('notifications'), where('audience', 'in', ['all', uid]), orderBy('createdAt', 'desc'), limit(50)),
  );
export const useSentNotifications = (enabled = true) =>
  useCollection<AppNotification>(enabled ? 'notif:sent' : null, () => query(col('notifications'), orderBy('createdAt', 'desc'), limit(100)));

export const useAuditLogs = (enabled = true) =>
  useCollection<AuditLog>(enabled ? 'audit:recent' : null, () => query(col('audit_logs'), orderBy('at', 'desc'), limit(300)));
