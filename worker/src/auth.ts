import { b64urlDecode, HttpError, utf8 } from './util';
import type { Env } from './env';
import { getDocument, type Doc } from './firestore';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: Record<string, CryptoKey>; expires: number } | null = null;

export interface Caller {
  uid: string;
  token: string;
  role: string;
  isActive: boolean;
  name: string;
}

async function getKeys(): Promise<Record<string, CryptoKey>> {
  if (jwksCache && jwksCache.expires > Date.now()) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new HttpError(503, 'Could not fetch token signing keys');
  const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const keys: Record<string, CryptoKey> = {};
  for (const k of body.keys) {
    keys[k.kid] = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  }
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  jwksCache = { keys, expires: Date.now() + maxAge * 1000 };
  return keys;
}

export function decodeJwt(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Malformed token');
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(b64urlDecode(parts[0]))) as { alg: string; kid?: string };
  const payload = JSON.parse(dec.decode(b64urlDecode(parts[1]))) as Record<string, unknown>;
  return { header, payload, signed: utf8(`${parts[0]}.${parts[1]}`), signature: b64urlDecode(parts[2]) };
}

/** Verifies a Firebase Auth ID token (RS256, issuer/audience/expiry checks). */
export async function verifyIdToken(token: string, env: Env, keysOverride?: Record<string, CryptoKey>): Promise<{ uid: string; claims: Record<string, unknown> }> {
  const { header, payload, signed, signature } = decodeJwt(token);
  const now = Math.floor(Date.now() / 1000);
  const emulator = env.EMULATOR === 'true';
  if (!emulator) {
    if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Invalid token algorithm');
    const keys = keysOverride ?? (await getKeys());
    const key = keys[header.kid];
    if (!key) throw new HttpError(401, 'Unknown signing key');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    if (!ok) throw new HttpError(401, 'Invalid token signature');
  }
  const pid = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== pid) throw new HttpError(401, 'Token is for a different project');
  if (payload.iss !== `https://securetoken.google.com/${pid}`) throw new HttpError(401, 'Invalid token issuer');
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new HttpError(401, 'Token issued in the future');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new HttpError(401, 'Invalid token subject');
  return { uid: payload.sub, claims: payload };
}

/** Authenticates the request and loads the caller's role using their own token (rules apply). */
export async function authenticate(req: Request, env: Env): Promise<Caller> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required');
  const { uid } = await verifyIdToken(token, env);
  let profile: Doc | null;
  try {
    profile = await getDocument(env, `users/${uid}`, token);
  } catch {
    throw new HttpError(403, 'Could not load your profile');
  }
  if (!profile) throw new HttpError(403, 'No profile for this account');
  const isActive = profile.isActive !== false;
  if (!isActive) throw new HttpError(403, 'Your account has been deactivated');
  return { uid, token, role: String(profile.role ?? 'member'), isActive, name: String(profile.fullName ?? '') };
}

export const ROLES = {
  messaging: ['super_admin', 'admin', 'pastor', 'secretary'],
  smsSend: ['super_admin', 'admin', 'pastor', 'secretary', 'treasurer'], // treasurers send giving receipts
  push: ['super_admin', 'admin', 'pastor', 'secretary'],
  admin: ['super_admin', 'admin'],
  staff: ['super_admin', 'admin', 'pastor', 'treasurer', 'secretary', 'staff', 'viewer'],
};

export function requireRole(caller: Caller, roles: string[]) {
  if (!roles.includes(caller.role)) throw new HttpError(403, 'Your role does not allow this action');
}
