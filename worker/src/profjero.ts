import type { Env } from './env';
import { HttpError, normalizePhone } from './util';

/** Thin, validated proxy to ProfJero Connect. The secret key never leaves the Worker. */
export async function pj(env: Env, path: string, init: { method?: string; body?: unknown; idempotencyKey?: string; auth?: boolean } = {}) {
  if (init.auth !== false && !env.PROFJERO_API_KEY) throw new HttpError(503, 'SMS is not configured. Add PROFJERO_API_KEY to the Worker.', 'not_configured');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.auth !== false) headers.Authorization = `Bearer ${env.PROFJERO_API_KEY}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  const base = (env.PROFJERO_BASE_URL || 'https://profjero-sms-api-prod.amoakob947.workers.dev').replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(base + path, { method: init.method ?? 'GET', headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  } catch {
    throw new HttpError(502, 'Could not reach ProfJero Connect. Please retry.', 'upstream_unreachable');
  }
  return res;
}

export interface RecipientIn {
  phone: string;
  fields?: Record<string, string>;
}

/** Validates and normalises a send/estimate body from the app. */
export function cleanSmsBody(raw: unknown, env: Env, forEstimate = false) {
  const b = (raw ?? {}) as { message?: unknown; recipients?: unknown; senderId?: unknown; scheduleAt?: unknown };
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!message) throw new HttpError(400, 'Message is required', 'invalid_message');
  if (message.length > 1600) throw new HttpError(400, 'Message is longer than 1,600 characters', 'invalid_message');
  if (!Array.isArray(b.recipients) || b.recipients.length === 0) throw new HttpError(400, 'At least one recipient is required', 'invalid_recipients');
  if (b.recipients.length > 10000) throw new HttpError(400, 'A single send is limited to 10,000 recipients', 'invalid_recipients');
  const seen = new Set<string>();
  const recipients: (string | RecipientIn)[] = [];
  for (const r of b.recipients as unknown[]) {
    const phone = normalizePhone(typeof r === 'string' ? r : (r as RecipientIn)?.phone);
    if (!phone || phone.length < 8 || seen.has(phone)) continue;
    seen.add(phone);
    if (typeof r === 'object' && r && (r as RecipientIn).fields) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries((r as RecipientIn).fields ?? {})) if (/^[a-z_][a-z0-9_]{0,40}$/i.test(k)) fields[k] = String(v ?? '').slice(0, 200);
      recipients.push({ phone, fields });
    } else recipients.push(phone);
  }
  if (!recipients.length) throw new HttpError(400, 'No valid phone numbers', 'invalid_recipients');
  const out: Record<string, unknown> = { message, recipients };
  if (!forEstimate) {
    const senderId = (typeof b.senderId === 'string' && b.senderId.trim()) || env.PROFJERO_SENDER_ID;
    if (senderId) out.senderId = senderId.slice(0, 11);
    if (typeof b.scheduleAt === 'string' && b.scheduleAt) {
      const t = Date.parse(b.scheduleAt);
      if (!Number.isFinite(t)) throw new HttpError(400, 'Invalid schedule time', 'invalid_schedule');
      if (t < Date.now() + 60_000) throw new HttpError(400, 'Schedule time must be in the future', 'invalid_schedule');
      out.scheduleAt = new Date(t).toISOString();
    }
  }
  return out;
}

/** Returns the first array found in a list response, plus a cursor. */
export function normalizeList(body: unknown, key: string) {
  const b = (body ?? {}) as Record<string, unknown>;
  const arr = (b[key] ?? b.items ?? b.data ?? b.results ?? (Array.isArray(body) ? body : [])) as unknown[];
  return { [key]: Array.isArray(arr) ? arr : [], nextCursor: (b.nextCursor ?? null) as string | null, totals: b.totals };
}
