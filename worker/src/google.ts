import type { Env } from './env';
import { b64urlEncode, HttpError, utf8 } from './util';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cached: { token: string; exp: number } | null = null;

export function hasServiceAccount(env: Env) {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT);
}

/** OAuth access token for a Google service account (used by cron jobs & admin actions). */
export async function serviceToken(env: Env): Promise<string> {
  if (env.EMULATOR === 'true') return 'owner';
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new HttpError(503, 'FIREBASE_SERVICE_ACCOUNT is not configured', 'not_configured');
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const header = b64urlEncode(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64urlEncode(utf8(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: tokenUri, iat: now, exp: now + 3600 })));
  const sig = b64urlEncode(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${header}.${claims}`)));
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${sig}` }),
  });
  if (!res.ok) throw new HttpError(502, 'Service account sign-in failed');
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function setUserPassword(env: Env, uid: string, password: string) {
  const token = await serviceToken(env);
  const url = env.EMULATOR === 'true'
    ? `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`
    : `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid, password }) });
  if (!res.ok) throw new HttpError(502, 'Could not update the password');
}
