import type { Timestamp } from 'firebase/firestore';

export type ID = string;
/** Firestore Timestamp, or a millisecond number for data that has not round-tripped yet. */
export type TS = Timestamp | null | undefined;

export type Role =
  | 'super_admin'
  | 'admin'
  | 'pastor'
  | 'treasurer'
  | 'secretary'
  | 'staff'
  | 'viewer'
  | 'member';

export interface UserProfile {
  id: ID;
  uid: ID;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  memberId?: ID | null;
  photoUrl?: string;
  createdAt?: TS;
  lastLogin?: TS;
  notificationPrefs?: { push?: boolean; sms?: boolean; email?: boolean };
}

export type MembershipStatus =
  | 'visitor'
  | 'first_timer'
  | 'new_convert'
  | 'member'
  | 'worker'
  | 'leader'
  | 'inactive'
  | 'transferred'
  | 'deceased';

export type Gender = 'male' | 'female' | '';
export type HouseholdRole = 'head' | 'spouse' | 'child' | 'relative' | 'other' | '';

export interface Member {
  id: ID;
  firstName: string;
  lastName: string;
  otherNames?: string;
  fullName: string;
  title?: string;
  gender: Gender;
  dob?: string; // YYYY-MM-DD
  birthMonthDay?: string; // MM-DD for birthday queries
  phone: string; // normalised 233XXXXXXXXX
  altPhone?: string;
  email?: string;
  address?: string;
  gpsAddress?: string; // GhanaPost GPS digital address
  hometown?: string;
  region?: string;
  occupation?: string;
  maritalStatus?: 'single' | 'married' | 'widowed' | 'divorced' | '';
  anniversary?: string; // wedding anniversary YYYY-MM-DD
  membershipStatus: MembershipStatus;
  joinDate?: string;
  baptismDate?: string;
  salvationDate?: string;
  groupIds: ID[];
  householdId?: ID | null;
  householdRole?: HouseholdRole;
  photoUrl?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  notes?: string;
  tags: string[];
  uid?: ID | null;
  howHeard?: string;
  invitedBy?: string;
  smsOptOut?: boolean;
  keywords: string[];
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: ID;
}

export type GroupType = 'ministry' | 'department' | 'cell' | 'fellowship' | 'committee' | 'class';

export interface Group {
  id: ID;
  name: string;
  type: GroupType;
  description?: string;
  leaderIds: ID[];
  leaderNames?: string[];
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  color?: string;
  memberCount?: number;
  createdAt?: TS;
}

export interface Household {
  id: ID;
  name: string;
  createdAt?: TS;
}

export type FollowUpStage = 'new' | 'contacted' | 'visited' | 'integrated' | 'closed';
export type FollowUpKind = 'first_timer' | 'new_convert' | 'absentee' | 'pastoral' | 'general';

export interface FollowUpNote {
  text: string;
  by: string;
  at: number;
}

export interface FollowUp {
  id: ID;
  memberId?: ID | null;
  name: string;
  phone?: string;
  kind: FollowUpKind;
  stage: FollowUpStage;
  assignedTo?: ID | null;
  assignedName?: string;
  dueDate?: string;
  notes: FollowUpNote[];
  createdAt?: TS;
  updatedAt?: TS;
}

export interface Service {
  id: ID;
  title: string;
  type: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  isOpen: boolean;
  headcount: { men: number; women: number; children: number; visitors: number };
  checkins: number;
  firstTimers?: number;
  notes?: string;
  preacher?: string;
  theme?: string;
  createdAt?: TS;
  createdBy?: ID;
}

export interface AttendanceRecord {
  id: ID;
  serviceId: ID;
  serviceType: string;
  date: string;
  memberId: ID;
  memberName: string;
  method: 'manual' | 'qr' | 'self';
  checkedInAt?: TS;
  by?: ID;
}

export type PaymentMethod = 'cash' | 'momo' | 'bank' | 'cheque' | 'card' | 'other';

export interface Gift {
  id: ID;
  category: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  memberId?: ID | null;
  memberName?: string;
  serviceId?: ID | null;
  pledgeId?: ID | null;
  campaignId?: ID | null;
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptNo: string;
  recordedBy?: ID;
  recordedByName?: string;
  createdAt?: TS;
}

export interface Campaign {
  id: ID;
  name: string;
  description?: string;
  goal: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt?: TS;
}

export interface Pledge {
  id: ID;
  campaignId: ID;
  campaignName: string;
  memberId?: ID | null;
  memberName: string;
  phone?: string;
  amount: number;
  paid: number;
  dueDate?: string;
  createdAt?: TS;
}

export interface Expense {
  id: ID;
  category: string;
  amount: number;
  payee?: string;
  method: PaymentMethod;
  date: string;
  description?: string;
  reference?: string;
  receiptUrl?: string;
  approvedBy?: string;
  recordedBy?: ID;
  recordedByName?: string;
  createdAt?: TS;
}

export type ContentStatus = 'draft' | 'published';

export interface ChurchEvent {
  id: ID;
  title: string;
  description?: string;
  category: string;
  startAt: string; // ISO local datetime "YYYY-MM-DDTHH:mm"
  endAt?: string;
  location?: string;
  mapUrl?: string;
  imageUrl?: string;
  status: ContentStatus;
  rsvpEnabled: boolean;
  capacity?: number | null;
  rsvpCount?: number;
  createdAt?: TS;
  createdBy?: ID;
}

export interface Rsvp {
  id: ID; // uid
  uid: ID;
  name: string;
  phone?: string;
  guests: number;
  createdAt?: TS;
}

export interface Devotional {
  id: ID;
  title: string;
  date: string; // YYYY-MM-DD
  scripture: string; // reference e.g. "John 3:16"
  scriptureText?: string;
  body: string; // plain text with paragraphs
  prayer?: string;
  confession?: string;
  author?: string;
  imageUrl?: string;
  status: ContentStatus;
  createdAt?: TS;
}

export interface Sermon {
  id: ID;
  title: string;
  preacher: string;
  date: string;
  series?: string;
  scripture?: string;
  summary?: string;
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  status: ContentStatus;
  createdAt?: TS;
}

export interface Announcement {
  id: ID;
  title: string;
  body: string;
  pinned: boolean;
  status: ContentStatus;
  expiresOn?: string;
  imageUrl?: string;
  createdAt?: TS;
}

export type CareType = 'prayer' | 'counselling' | 'visit' | 'urgent' | 'thanksgiving';
export type CareStatus = 'new' | 'in_progress' | 'scheduled' | 'completed' | 'closed';

export interface CareResponse {
  text: string;
  by: string;
  at: number;
  internal?: boolean;
}

export interface CareRequest {
  id: ID;
  type: CareType;
  uid?: ID | null;
  memberId?: ID | null;
  name: string;
  phone?: string;
  subject?: string;
  details: string;
  visibility: 'private' | 'public';
  anonymous?: boolean;
  preferredDate?: string;
  location?: string;
  status: CareStatus;
  assignedTo?: ID | null;
  assignedName?: string;
  scheduledFor?: string;
  responses: CareResponse[];
  prayedCount?: number;
  createdAt?: TS;
  updatedAt?: TS;
}

export interface Testimony {
  id: ID;
  uid?: ID | null;
  name: string;
  title: string;
  body: string;
  status: 'pending' | 'published' | 'rejected';
  createdAt?: TS;
}

export type CareLogType = 'visitation' | 'counselling' | 'hospital' | 'call' | 'bereavement' | 'other';

export interface CareLog {
  id: ID;
  memberId?: ID | null;
  memberName: string;
  type: CareLogType;
  date: string;
  summary: string;
  nextStep?: string;
  confidential: boolean;
  by?: ID;
  byName?: string;
  createdAt?: TS;
}

export interface SmsMessage {
  id: ID; // = idempotency key / batch id
  senderId: string;
  message: string;
  audience: string;
  recipients: number;
  personalized: boolean;
  status: 'sending' | 'submitting' | 'completed' | 'partial' | 'failed' | 'scheduled' | 'cancelled';
  unitsReserved?: number;
  unitsCharged?: number;
  delivered?: number;
  failed?: number;
  scheduledAt?: string | null;
  campaignId?: string | null;
  error?: string | null;
  createdBy?: ID;
  createdByName?: string;
  createdAt?: TS;
}

export interface SmsTemplate {
  id: ID;
  name: string;
  body: string;
  category: string;
  createdAt?: TS;
}

export interface AppNotification {
  id: ID;
  title: string;
  body: string;
  url?: string;
  audience: 'all' | ID; // 'all' or a uid
  kind: 'announcement' | 'devotional' | 'event' | 'care' | 'sermon' | 'general';
  createdAt?: TS;
  createdBy?: ID;
  push?: { sent: number; failed: number } | null;
}

export interface PushSubscriptionDoc {
  id: ID;
  uid: ID;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt?: TS;
}

export interface AuditLog {
  id: ID;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  by: ID;
  byName: string;
  at?: TS;
}

export interface PaymentAccount {
  label: string; // e.g. "MTN MoMo"
  kind: 'momo' | 'bank' | 'other';
  name: string; // account name
  number: string; // account / wallet number
  extra?: string; // branch, merchant ID, USSD
}

export interface ChurchSettings {
  name: string;
  shortName: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  gpsAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  serviceTimes?: string;
  serviceTypes: string[];
  givingCategories: string[];
  expenseCategories: string[];
  eventCategories: string[];
  paymentAccounts: PaymentAccount[];
  smsSenderId?: string;
  smsSignature?: string;
  welcomeSms?: string;
  birthdaySms?: string;
  autoBirthdaySms?: boolean;
  autoWelcomeSms?: boolean;
}
