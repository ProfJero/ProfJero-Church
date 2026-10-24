import { b64urlDecode, b64urlEncode, concat, utf8 } from './util';

/**
 * Web Push with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291),
 * implemented on WebCrypto so it runs on Workers without dependencies.
 */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Encrypts a payload for one subscription. `fixed` is only for test vectors. */
export async function encryptPayload(
  plaintext: Uint8Array,
  uaPublicB64: string,
  authSecretB64: string,
  fixed?: { asKeyPair: CryptoKeyPair; asPublic: Uint8Array; salt: Uint8Array },
) {
  const uaPublic = b64urlDecode(uaPublicB64);
  const authSecret = b64urlDecode(authSecretB64);
  const asKeyPair = fixed?.asKeyPair ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = fixed?.asPublic ?? new Uint8Array((await crypto.subtle.exportKey('raw', asKeyPair.publicKey)) as ArrayBuffer);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, asKeyPair.privateKey, 256));

  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const record = concat(plaintext, new Uint8Array([2])); // final-record delimiter, no padding
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

let vapidKeyCache: { pub: string; key: CryptoKey } | null = null;

async function vapidSigningKey(publicKeyB64: string, privateKeyB64: string) {
  if (vapidKeyCache?.pub === publicKeyB64) return vapidKeyCache.key;
  const pub = b64urlDecode(publicKeyB64);
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', d: privateKeyB64, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapidKeyCache = { pub: publicKeyB64, key };
  return key;
}

export async function vapidAuthorization(endpoint: string, subject: string, publicKey: string, privateKey: string, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(utf8(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await vapidSigningKey(publicKey, privateKey);
  // WebCrypto ECDSA signatures are already raw r||s, which is what JWS ES256 expects.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${publicKey}`;
}

export interface PushResult {
  endpoint: string;
  status: number;
  gone: boolean;
}

export async function sendWebPush(sub: PushSub, payload: unknown, opts: { publicKey: string; privateKey: string; subject: string; ttl?: number; topic?: string; urgency?: 'normal' | 'high' }): Promise<PushResult> {
  const body = await encryptPayload(utf8(JSON.stringify(payload)), sub.keys.p256dh, sub.keys.auth);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(sub.endpoint, opts.subject, opts.publicKey, opts.privateKey),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttl ?? 86400),
    Urgency: opts.urgency ?? 'normal',
  };
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  try {
    const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
    return { endpoint: sub.endpoint, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch {
    return { endpoint: sub.endpoint, status: 0, gone: false };
  }
}
