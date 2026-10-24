import { api } from '@/lib/api';
import { createDoc, getActor, patchDoc } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { uid } from '@/lib/utils';

/** Shapes returned by ProfJero Connect (relayed by the CWC Worker). */
export interface PjBatch {
  id: string;
  status: 'submitting' | 'completed' | 'partial' | 'failed';
  senderId: string;
  message: string;
  personalized: boolean;
  totalRecipients: number;
  totalUnitsReserved: number;
  totalUnitsCharged: number;
  submittedCount: number;
  failedCount: number;
  unknownCount: number;
  deliveredCount: number;
  createdAt: string;
  completedAt: string | null;
}
export interface PjRecord {
  id: string;
  recipient: string;
  message: string;
  unitsPerMessage?: number;
  unitsCharged?: number;
  status: 'queued' | 'submitting' | 'submitted' | 'delivered' | 'failed' | 'unknown';
}
export interface PjSendResult {
  batch?: PjBatch;
  records?: PjRecord[];
  scheduled?: boolean;
  campaign?: { id: string; status: string; nextRunAt: string; estimate: { recipients: number; units: number } };
}
export interface PjEstimate {
  recipients: number;
  units: number;
  availableUnits: number;
  sufficient: boolean;
  personalized: boolean;
  samples: { phone: string; message: string; segments: number }[];
}
export interface PjBalance {
  availableUnits: number;
  lowBalance: boolean;
  updatedAt: string;
}

export type Recipient = string | { phone: string; fields?: Record<string, string> };

function cleanRecipients(recipients: Recipient[]) {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of recipients) {
    const phone = normalizePhone(typeof r === 'string' ? r : r.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push(typeof r === 'string' ? phone : { phone, fields: r.fields });
  }
  return out;
}

export function estimateSms(message: string, recipients: Recipient[]) {
  return api<PjEstimate>('/v1/sms/estimate', { method: 'POST', json: { message, recipients: cleanRecipients(recipients) } });
}

export function smsBalance() {
  return api<PjBalance>('/v1/sms/balance');
}

/**
 * Sends (or schedules) an SMS through ProfJero Connect and records it in
 * Firestore. The idempotency key doubles as the history record id, so a retry
 * after a dropped connection can never double-send.
 */
export async function sendSms(input: {
  message: string;
  recipients: Recipient[];
  audience: string;
  senderId?: string;
  scheduleAt?: string | null;
  idempotencyKey?: string;
}) {
  const recipients = cleanRecipients(input.recipients);
  if (!recipients.length) throw new Error('No valid phone numbers to send to.');
  const key = input.idempotencyKey ?? `cwc-${uid()}`;
  const actor = getActor();
  const personalized = recipients.some((r) => typeof r !== 'string' && r.fields && Object.keys(r.fields).length > 0);
  await createDoc(
    'sms_messages',
    {
      senderId: input.senderId ?? '',
      message: input.message,
      audience: input.audience,
      recipients: recipients.length,
      personalized,
      status: input.scheduleAt ? 'scheduled' : 'sending',
      scheduledAt: input.scheduleAt ?? null,
      createdByName: actor?.name ?? '',
      error: null,
    },
    { id: key },
  ).catch(() => {}); // a retry with the same key re-uses the record
  try {
    const res = await api<PjSendResult>('/v1/sms/send', {
      method: 'POST',
      idempotencyKey: key,
      json: { senderId: input.senderId || undefined, message: input.message, recipients, scheduleAt: input.scheduleAt || undefined },
    });
    if (res.scheduled && res.campaign) {
      await patchDoc('sms_messages', key, { status: 'scheduled', campaignId: res.campaign.id, unitsReserved: res.campaign.estimate?.units ?? null });
    } else if (res.batch) {
      await patchDoc('sms_messages', key, batchPatch(res.batch));
    }
    return { key, ...res };
  } catch (e) {
    await patchDoc('sms_messages', key, { status: 'failed', error: (e as Error).message }).catch(() => {});
    throw e;
  }
}

export function batchPatch(b: PjBatch) {
  return {
    status: b.status,
    senderId: b.senderId,
    unitsReserved: b.totalUnitsReserved,
    unitsCharged: b.totalUnitsCharged,
    delivered: b.deliveredCount,
    failed: b.failedCount,
  };
}

export function getBatch(id: string) {
  return api<{ batch: PjBatch; records: PjRecord[] }>(`/v1/sms/batches/${encodeURIComponent(id)}`);
}
