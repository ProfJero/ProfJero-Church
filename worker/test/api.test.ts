import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { birthdayJob } from '../src/index';
import { verifyIdToken } from '../src/auth';
import { b64urlEncode, utf8 } from '../src/util';
import type { Env } from '../src/env';

const PID = 'demo-cwc';
const baseEnv: Env = {
  FIREBASE_PROJECT_ID: PID,
  ALLOWED_ORIGINS: 'https://app.cwc.test',
  PROFJERO_BASE_URL: 'https://pj.test',
  PROFJERO_API_KEY: 'pk_live_secret',
  PROFJERO_SENDER_ID: 'CWC',
  EMULATOR: 'true',
  FIRESTORE_EMULATOR_URL: 'https://fs.test',
};

function unsignedToken(uid: string, over: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64urlEncode(utf8(JSON.stringify({ alg: 'none', typ: 'JWT' })));
  const p = b64urlEncode(utf8(JSON.stringify({ aud: PID, iss: `https://securetoken.google.com/${PID}`, sub: uid, iat: now, exp: now + 3600, ...over })));
  return `${h}.${p}.`;
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
let calls: { url: string; init: RequestInit }[] = [];
function mockFetch(roles: Record<string, string>, extra?: Handler) {
  calls = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    const userMatch = url.pathname.match(/\/documents\/users\/([^/]+)$/);
    if (url.host === 'fs.test' && userMatch) {
      const role = roles[userMatch[1]];
      if (!role) return new Response('{}', { status: 404 });
      return Response.json({ name: `projects/${PID}/databases/(default)/documents/users/${userMatch[1]}`, fields: { role: { stringValue: role }, isActive: { booleanValue: role !== 'disabled' }, fullName: { stringValue: 'Test' } } });
    }
    if (extra) return extra(url, init);
    return new Response('not mocked', { status: 599 });
  });
}

const call = (path: string, init: RequestInit & { uid?: string } = {}, env: Env = baseEnv) => {
  const headers = new Headers(init.headers);
  headers.set('origin', 'https://app.cwc.test');
  if (init.uid) headers.set('authorization', `Bearer ${unsignedToken(init.uid)}`);
  return worker.fetch(new Request(`https://api.test${path}`, { ...init, headers }), env);
};

afterEach(() => vi.unstubAllGlobals());

describe('Firebase ID token verification', () => {
  let keys: Record<string, CryptoKey>;
  let priv: CryptoKey;
  beforeEach(async () => {
    const kp = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    keys = { k1: kp.publicKey };
    priv = kp.privateKey;
  });
  async function signed(payload: Record<string, unknown>, kid = 'k1') {
    const h = b64urlEncode(utf8(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
    const p = b64urlEncode(utf8(JSON.stringify(payload)));
    const sig = b64urlEncode(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, utf8(`${h}.${p}`)));
    return `${h}.${p}.${sig}`;
  }
  const env = { ...baseEnv, EMULATOR: 'false' };
  const now = () => Math.floor(Date.now() / 1000);
  const good = () => ({ aud: PID, iss: `https://securetoken.google.com/${PID}`, sub: 'u1', iat: now(), exp: now() + 600 });

  it('accepts a valid token', async () => {
    await expect(verifyIdToken(await signed(good()), env, keys)).resolves.toMatchObject({ uid: 'u1' });
  });
  it('rejects tampered, expired, foreign or unsigned tokens', async () => {
    const t = await signed(good());
    const tampered = t.split('.');
    tampered[1] = b64urlEncode(utf8(JSON.stringify({ ...good(), sub: 'attacker' })));
    await expect(verifyIdToken(tampered.join('.'), env, keys)).rejects.toThrow(/signature/);
    await expect(verifyIdToken(await signed({ ...good(), exp: now() - 10 }), env, keys)).rejects.toThrow(/expired/);
    await expect(verifyIdToken(await signed({ ...good(), aud: 'other' }), env, keys)).rejects.toThrow(/different project/);
    await expect(verifyIdToken(await signed(good(), 'unknown'), env, keys)).rejects.toThrow(/Unknown signing key/);
    await expect(verifyIdToken(unsignedToken('u1'), env, keys)).rejects.toThrow(/algorithm/);
  });
});

describe('routing & access control', () => {
  it('serves health publicly with CORS for allowed origins', async () => {
    mockFetch({});
    const res = await call('/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.cwc.test');
    expect(await res.json()).toMatchObject({ ok: true, sms: true, push: false });
  });
  it('requires sign-in for SMS', async () => {
    mockFetch({});
    const res = await call('/v1/sms/balance');
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toMatch(/Sign in/);
  });
  it('blocks members and deactivated staff', async () => {
    mockFetch({ m1: 'member', d1: 'disabled' });
    expect((await call('/v1/sms/balance', { uid: 'm1' })).status).toBe(403);
    expect((await call('/v1/sms/balance', { uid: 'd1' })).status).toBe(403);
  });
  it('lets treasurers send receipts but not read the wallet', async () => {
    mockFetch({ t1: 'treasurer' }, () => Response.json({ batch: { id: 'x' } }, { status: 201 }));
    expect((await call('/v1/sms/wallet', { uid: 't1' })).status).toBe(403);
    const res = await call('/v1/sms/send', { uid: 't1', method: 'POST', body: JSON.stringify({ message: 'Receipt', recipients: ['0241234567'] }), headers: { 'Idempotency-Key': 'receipt-12345' } });
    expect(res.status).toBe(201);
  });
});

describe('ProfJero Connect proxy', () => {
  it('forwards sends with the secret key, idempotency key, sender ID and normalised numbers', async () => {
    mockFetch({ s1: 'secretary' }, () => Response.json({ batch: { id: 'cwc-key-0001', status: 'submitting' }, records: [] }, { status: 201 }));
    const res = await call('/v1/sms/send', {
      uid: 's1',
      method: 'POST',
      headers: { 'Idempotency-Key': 'cwc-key-0001', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hi {first_name|Beloved}', recipients: [{ phone: '024 123 4567', fields: { first_name: 'Ama' } }, '0241234567', '+447700900123', 'bad'] }),
    });
    expect(res.status).toBe(201);
    const pjCall = calls.find((c) => c.url.startsWith('https://pj.test'))!;
    expect(pjCall.url).toBe('https://pj.test/v1/sms/send');
    const h = new Headers(pjCall.init.headers);
    expect(h.get('authorization')).toBe('Bearer pk_live_secret');
    expect(h.get('idempotency-key')).toBe('cwc-key-0001');
    expect(JSON.parse(String(pjCall.init.body))).toEqual({
      message: 'Hi {first_name|Beloved}',
      senderId: 'CWC',
      recipients: [{ phone: '233241234567', fields: { first_name: 'Ama' } }, '447700900123'],
    });
  });
  it('relays provider errors (e.g. 402 insufficient units) with Retry-After', async () => {
    mockFetch({ a1: 'admin' }, () => new Response(JSON.stringify({ error: { code: 'http_429', message: 'Slow down', requestId: 'r1' } }), { status: 429, headers: { 'Retry-After': '30' } }));
    const res = await call('/v1/sms/balance', { uid: 'a1' });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect((await res.json()).error.requestId).toBe('r1');
  });
  it('validates messages before spending anything', async () => {
    mockFetch({ a1: 'admin' });
    const res = await call('/v1/sms/send', { uid: 'a1', method: 'POST', body: JSON.stringify({ message: 'x'.repeat(1601), recipients: ['0241234567'] }) });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.startsWith('https://pj.test'))).toBe(false);
  });
  it('rejects schedules in the past', async () => {
    mockFetch({ a1: 'admin' });
    const res = await call('/v1/sms/send', { uid: 'a1', method: 'POST', body: JSON.stringify({ message: 'Hi', recipients: ['0241234567'], scheduleAt: '2020-01-01T00:00:00Z' }) });
    expect(res.status).toBe(400);
  });
  it('maps wallet, pricing and payments endpoints', async () => {
    mockFetch({ a1: 'admin' }, (u) => Response.json(u.pathname === '/v1/payments' ? { items: [{ reference: 'p1' }] } : { ok: u.pathname }));
    expect(await (await call('/v1/sms/wallet', { uid: 'a1' })).json()).toEqual({ ok: '/v1/wallet' });
    expect(await (await call('/v1/sms/pricing')).json()).toEqual({ ok: '/v1/pricing' });
    expect((await (await call('/v1/sms/payments?limit=5', { uid: 'a1' })).json()).payments).toEqual([{ reference: 'p1' }]);
    const pay = await call('/v1/sms/payments', { uid: 'a1', method: 'POST', body: JSON.stringify({ packageId: 'starter', method: 'mobile_money', callbackUrl: 'https://app.cwc.test/admin/messages' }) });
    expect(pay.status).toBe(200);
    const last = calls[calls.length - 1];
    expect(JSON.parse(String(last.init.body))).toEqual({ packageId: 'starter', method: 'mobile_money', callbackUrl: 'https://app.cwc.test/admin/messages' });
    expect(new Headers(last.init.headers).get('idempotency-key')).toMatch(/^topup-/);
  });
});

describe('push & media', () => {
  it('pages through subscriptions and removes expired ones', async () => {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const env = { ...baseEnv, VAPID_PUBLIC_KEY: b64urlEncode(await crypto.subtle.exportKey('raw', kp.publicKey)), VAPID_PRIVATE_KEY: ((await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey).d! };
    const p256dh = b64urlEncode(await crypto.subtle.exportKey('raw', ua.publicKey));
    const sub = (id: string, endpoint: string) => ({ name: `x/push_subscriptions/${id}`, fields: { uid: { stringValue: 'u' }, endpoint: { stringValue: endpoint }, keys: { mapValue: { fields: { p256dh: { stringValue: p256dh }, auth: { stringValue: 'BTBZMqHH6r4Tts7J_aSIgg' } } } } } });
    mockFetch({ p1: 'pastor' }, (u, init) => {
      if (u.host === 'fs.test' && init.method === 'DELETE') return new Response('{}');
      if (u.host === 'fs.test') return Response.json({ documents: [sub('a', 'https://push.test/ok'), sub('b', 'https://push.test/gone')], nextPageToken: 'next' });
      if (u.pathname === '/gone') return new Response('', { status: 410 });
      return new Response('', { status: 201 });
    });
    const res = await call('/v1/push/send', { uid: 'p1', method: 'POST', body: JSON.stringify({ title: 'Hi', body: 'There', audience: 'all' }) }, env);
    expect(await res.json()).toEqual({ sent: 1, failed: 1, removed: 1, total: 2, nextPageToken: 'next' });
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/push_subscriptions/b'))).toBe(true);
    const pushCall = calls.find((c) => c.url === 'https://push.test/ok')!;
    expect(new Headers(pushCall.init.headers).get('authorization')).toMatch(/^vapid t=.+, k=/);
    expect(new Headers(pushCall.init.headers).get('content-encoding')).toBe('aes128gcm');
  });
  it('signs Cloudinary uploads and restricts members to avatars', async () => {
    const env = { ...baseEnv, CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' };
    mockFetch({ m1: 'member', s1: 'secretary' });
    const ok = await call('/v1/media/sign', { uid: 'm1', method: 'POST', body: JSON.stringify({ folder: 'avatars' }) }, env);
    const body = await ok.json();
    expect(body).toMatchObject({ apiKey: 'key', cloudName: 'demo', folder: 'cwc/avatars' });
    const expected = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', utf8(`folder=cwc/avatars&timestamp=${body.timestamp}secret`))), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(body.signature).toBe(expected);
    expect((await call('/v1/media/sign', { uid: 'm1', method: 'POST', body: JSON.stringify({ folder: 'events' }) }, env)).status).toBe(403);
    expect((await call('/v1/media/sign', { uid: 's1', method: 'POST', body: JSON.stringify({ folder: 'events' }) }, env)).status).toBe(200);
  });
});

describe('birthday job', () => {
  it('sends one personalised, idempotent SMS to today’s birthdays', async () => {
    mockFetch({}, (u, init) => {
      if (u.pathname.endsWith('/settings/church')) return Response.json({ name: 'x', fields: { autoBirthdaySms: { booleanValue: true }, birthdaySms: { stringValue: 'Happy birthday {first_name|Beloved}!' }, smsSenderId: { stringValue: 'CWC' } } });
      if (u.pathname.endsWith(':runQuery')) {
        expect(JSON.parse(String(init.body)).structuredQuery.where.fieldFilter.value).toEqual({ stringValue: '10-24' });
        return Response.json([
          { document: { name: 'x/members/1', fields: { phone: { stringValue: '233241111111' }, firstName: { stringValue: 'Ama' }, membershipStatus: { stringValue: 'member' } } } },
          { document: { name: 'x/members/2', fields: { phone: { stringValue: '233242222222' }, firstName: { stringValue: 'Kofi' }, smsOptOut: { booleanValue: true } } } },
        ]);
      }
      return Response.json({ batch: {} }, { status: 201 });
    });
    const r = await birthdayJob(baseEnv, new Date('2026-10-24T07:00:00Z'));
    expect(r).toMatchObject({ sent: 1, status: 201 });
    const send = calls.find((c) => c.url === 'https://pj.test/v1/sms/send')!;
    expect(new Headers(send.init.headers).get('idempotency-key')).toBe('birthday-2026-10-24');
    expect(JSON.parse(String(send.init.body)).recipients).toEqual([{ phone: '233241111111', fields: { first_name: 'Ama' } }]);
  });
});
