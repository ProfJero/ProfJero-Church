/**
 * Christian Worship Centre API — Cloudflare Worker
 * - ProfJero Connect SMS proxy (secret key stays here)
 * - Web Push (VAPID) to members' devices
 * - Signed Cloudinary uploads
 * - Daily birthday SMS
 * Crafted by ProfJero.
 */
import type { Env } from './env';
import { authenticate, requireRole, ROLES, type Caller } from './auth';
import { cleanSmsBody, normalizeList, pj } from './profjero';
import { signUpload } from './cloudinary';
import { sendWebPush, type PushSub } from './webpush';
import { deleteDocument, listDocuments, runQuery, getDocument } from './firestore';
import { hasServiceAccount, serviceToken, setUserPassword } from './google';
import { HttpError } from './util';

const VERSION = '1.0.0';

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
}

function errorJson(status: number, code: string, message: string, requestId?: string) {
  return json({ error: { code, message, requestId: requestId ?? crypto.randomUUID() } }, status);
}

/** Relays a ProfJero Connect response, keeping its status, error shape and Retry-After. */
async function relay(res: Response, transform?: (body: unknown) => unknown) {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { code: `http_${res.status}`, message: text.slice(0, 300) || 'Unexpected response from SMS provider' } };
  }
  const extra: Record<string, string> = {};
  const ra = res.headers.get('retry-after');
  if (ra) extra['Retry-After'] = ra;
  return json(res.ok && transform ? transform(body) : body, res.status, extra);
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

/* ---------------- push ---------------- */

interface PushInput {
  title: string;
  body: string;
  url?: string;
  image?: string;
  tag?: string;
  audience: 'all' | { uids: string[] };
  pageToken?: string;
}

/**
 * Sends one page of pushes. Large audiences are paged (nextPageToken) so a single
 * request stays within Workers' sub-request limits; the app loops until done.
 */
async function handlePush(caller: Caller, input: PushInput, env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new HttpError(503, 'Push is not configured. Add the VAPID keys to the Worker.', 'not_configured');
  if (!input?.title || !input?.body) throw new HttpError(400, 'Title and body are required');
  const PAGE = 40;
  let subs: { id: string; sub: PushSub }[];
  let nextPageToken: string | undefined;
  const toSub = (d: Record<string, unknown>) => ({ id: String(d.__id), sub: { endpoint: String(d.endpoint), keys: d.keys as PushSub['keys'] } });
  if (input.audience === 'all') {
    const page = await listDocuments(env, 'push_subscriptions', caller.token, PAGE, input.pageToken);
    subs = page.docs.map(toSub);
    nextPageToken = page.nextPageToken;
  } else {
    const uids = (input.audience?.uids ?? []).slice(0, 30);
    if (!uids.length) throw new HttpError(400, 'No recipients');
    subs = (await runQuery(env, 'push_subscriptions', caller.token, [{ field: 'uid', op: 'IN', value: uids }], PAGE)).map(toSub);
  }
  const payload = {
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 300),
    url: typeof input.url === 'string' && input.url.startsWith('/') ? input.url : '/notifications',
    image: input.image,
    tag: input.tag,
  };
  const results = await Promise.all(
    subs.filter((s) => s.sub.endpoint && s.sub.keys?.p256dh).map((s) =>
      sendWebPush(s.sub, payload, { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT || 'mailto:admin@example.com', topic: input.tag }).then((r) => ({ ...r, id: s.id })),
    ),
  );
  const gone = results.filter((r) => r.gone);
  await Promise.all(gone.map((g) => deleteDocument(env, `push_subscriptions/${g.id}`, caller.token)));
  return {
    sent: results.filter((r) => r.status >= 200 && r.status < 300).length,
    failed: results.filter((r) => !(r.status >= 200 && r.status < 300)).length,
    removed: gone.length,
    total: results.length,
    nextPageToken: nextPageToken ?? null,
  };
}

/* ---------------- router ---------------- */

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  // Public
  if (path === '/' || path === '/v1/health') {
    return json({
      ok: true,
      name: 'CWC API',
      version: VERSION,
      sms: Boolean(env.PROFJERO_API_KEY),
      push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      media: Boolean(env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      serviceAccount: hasServiceAccount(env),
      by: 'ProfJero',
    });
  }
  if (path === '/v1/push/public-key' && m === 'GET') {
    if (!env.VAPID_PUBLIC_KEY) throw new HttpError(503, 'Push is not configured', 'not_configured');
    return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, { 'Cache-Control': 'public, max-age=3600' });
  }
  if (path === '/v1/sms/pricing' && m === 'GET') return relay(await pj(env, '/v1/pricing', { auth: false }));

  // Everything below requires a signed-in, active user
  const caller = await authenticate(req, env);

  if (path === '/v1/media/sign' && m === 'POST') {
    const { folder } = (await readJson(req)) as { folder?: string };
    return json(await signUpload(env, String(folder ?? ''), ROLES.staff.includes(caller.role)));
  }

  if (path === '/v1/push/send' && m === 'POST') {
    requireRole(caller, ROLES.push);
    return json(await handlePush(caller, (await readJson(req)) as PushInput, env));
  }

  if (path.startsWith('/v1/admin/users/') && path.endsWith('/password') && m === 'POST') {
    requireRole(caller, ROLES.admin);
    const uid = path.split('/')[4];
    const { password } = (await readJson(req)) as { password?: string };
    if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    const target = await getDocument(env, `users/${uid}`, caller.token);
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'super_admin' && caller.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can reset this account');
    await setUserPassword(env, uid, password);
    return json({ ok: true });
  }

  // SMS
  if (path === '/v1/sms/send' && m === 'POST') {
    requireRole(caller, ROLES.smsSend);
    const body = cleanSmsBody(await readJson(req), env);
    const key = req.headers.get('idempotency-key') || `cwc-${crypto.randomUUID()}`;
    if (key.length < 8 || key.length > 120) throw new HttpError(400, 'Idempotency-Key must be 8–120 characters');
    return relay(await pj(env, '/v1/sms/send', { method: 'POST', body, idempotencyKey: key }));
  }
  if (path === '/v1/sms/estimate' && m === 'POST') {
    requireRole(caller, ROLES.smsSend);
    return relay(await pj(env, '/v1/sms/estimate', { method: 'POST', body: cleanSmsBody(await readJson(req), env, true) }));
  }

  requireRole(caller, ROLES.messaging);
  const qs = (keys: string[]) => {
    const p = new URLSearchParams();
    keys.forEach((k) => url.searchParams.get(k) && p.set(k, url.searchParams.get(k)!));
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  if (path === '/v1/sms/balance' && m === 'GET') return relay(await pj(env, '/v1/balance'));
  if (path === '/v1/sms/wallet' && m === 'GET') return relay(await pj(env, '/v1/wallet'));
  if (path === '/v1/sms/transactions' && m === 'GET') return relay(await pj(env, `/v1/wallet/transactions${qs(['limit', 'before'])}`), (b) => normalizeList(b, 'transactions'));
  if (path === '/v1/sms/sender-ids' && m === 'GET') return relay(await pj(env, '/v1/sender-ids'));
  if (path === '/v1/sms/batches' && m === 'GET') return relay(await pj(env, `/v1/sms/batches${qs(['limit', 'before'])}`));
  if (path.startsWith('/v1/sms/batches/') && m === 'GET') return relay(await pj(env, `/v1/sms/batches/${encodeURIComponent(path.split('/')[4])}`));
  if (path === '/v1/sms/campaigns' && m === 'GET') return relay(await pj(env, '/v1/campaigns'), (b) => normalizeList(b, 'campaigns'));
  if (/^\/v1\/sms\/campaigns\/[^/]+\/cancel$/.test(path) && m === 'POST') return relay(await pj(env, `/v1/campaigns/${encodeURIComponent(path.split('/')[4])}/cancel`, { method: 'POST' }));
  if (path === '/v1/sms/payments' && m === 'GET') return relay(await pj(env, `/v1/payments${qs(['limit'])}`), (b) => normalizeList(b, 'payments'));
  if (path.startsWith('/v1/sms/payments/') && m === 'GET') return relay(await pj(env, `/v1/payments/${encodeURIComponent(path.split('/')[4])}`));
  if (path === '/v1/sms/payments' && m === 'POST') {
    requireRole(caller, ROLES.admin.concat('pastor', 'secretary'));
    const b = (await readJson(req)) as Record<string, unknown>;
    const body: Record<string, unknown> = {};
    if (typeof b.packageId === 'string') body.packageId = b.packageId;
    else if (Number.isInteger(b.units) && (b.units as number) > 0) body.units = b.units;
    else throw new HttpError(400, 'Choose a package or a number of units');
    if (typeof b.email === 'string' && b.email.includes('@')) body.email = b.email;
    if (typeof b.callbackUrl === 'string' && b.callbackUrl.startsWith('https://')) body.callbackUrl = b.callbackUrl;
    if (b.method === 'mobile_money' || b.method === 'card') body.method = b.method;
    const key = req.headers.get('idempotency-key') || `topup-${crypto.randomUUID()}`;
    return relay(await pj(env, '/v1/payments', { method: 'POST', body, idempotencyKey: key }));
  }

  throw new HttpError(404, 'Not found');
}

/* ---------------- daily jobs ---------------- */

/** Sends personalised birthday SMS to everyone celebrating today (Africa/Accra = UTC). */
export async function birthdayJob(env: Env, now = new Date()) {
  if (!hasServiceAccount(env) && env.EMULATOR !== 'true') return { skipped: 'no service account' };
  const token = await serviceToken(env);
  const settings = await getDocument(env, 'settings/church', token);
  if (!settings?.autoBirthdaySms || !settings.birthdaySms) return { skipped: 'disabled' };
  const md = `${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const people = (await runQuery(env, 'members', token, [{ field: 'birthMonthDay', op: 'EQUAL', value: md }], 2000)).filter(
    (m) => m.phone && !m.smsOptOut && !['deceased', 'transferred'].includes(String(m.membershipStatus)),
  );
  if (!people.length) return { sent: 0 };
  const res = await pj(env, '/v1/sms/send', {
    method: 'POST',
    idempotencyKey: `birthday-${now.toISOString().slice(0, 10)}`,
    body: cleanSmsBody({ message: settings.birthdaySms, senderId: settings.smsSenderId, recipients: people.map((p) => ({ phone: p.phone, fields: Object.fromEntries(Object.entries({ first_name: p.firstName, name: p.fullName }).filter(([, v]) => v)) })) }, env),
  });
  return { sent: people.length, status: res.status };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) res = errorJson(e.status, e.code, e.message);
      else {
        console.error('[cwc-api]', e);
        res = errorJson(500, 'internal', 'Something went wrong. Please retry.');
      }
    }
    const headers = new Headers(res.headers);
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, headers });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      birthdayJob(env)
        .then((r) => console.log('[cwc-api] birthday job', JSON.stringify(r)))
        .catch((e) => console.error('[cwc-api] birthday job failed', e)),
    );
  },
};
