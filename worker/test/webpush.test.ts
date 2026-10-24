import { describe, expect, it } from 'vitest';
import { encryptPayload, vapidAuthorization } from '../src/webpush';
import { b64urlDecode, b64urlEncode, utf8, concat } from '../src/util';

// RFC 8291 Appendix A test vector
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function importPair(priv: string, pubB64: string) {
  const pub = b64urlDecode(pubB64);
  const jwk = { kty: 'EC', crv: 'P-256', d: priv, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)) };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return { privateKey, publicKey } as CryptoKeyPair;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/** Independent receiver-side decryption (what the browser does). */
async function decrypt(body: Uint8Array, uaPriv: string, uaPub: string, auth: string) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const ua = await importPair(uaPriv, uaPub);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(b64urlDecode(auth), ecdh, concat(utf8('WebPush: info\0'), b64urlDecode(uaPub), asPublic), 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  return new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2)));
}

describe('web push encryption', () => {
  it('matches the RFC 8291 test vector', async () => {
    const asKeyPair = await importPair(V.asPrivate, V.asPublic);
    const body = await encryptPayload(utf8(V.plaintext), V.uaPublic, V.auth, { asKeyPair, asPublic: b64urlDecode(V.asPublic), salt: b64urlDecode(V.salt) });
    expect(b64urlEncode(body)).toBe(V.body);
  });

  it('round-trips with a random sender key', async () => {
    const body = await encryptPayload(utf8('{"title":"Hello CWC"}'), V.uaPublic, V.auth);
    expect(await decrypt(body, V.uaPrivate, V.uaPublic, V.auth)).toBe('{"title":"Hello CWC"}');
  });
});

describe('VAPID', () => {
  it('produces a verifiable ES256 JWT for the push service origin', async () => {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const pub = b64urlEncode(await crypto.subtle.exportKey('raw', kp.publicKey));
    const d = ((await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey).d!;
    const auth = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', 'mailto:a@b.c', pub, d, 1_700_000_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth)!;
    expect(m[4]).toBe(pub);
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
    expect(claims).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'mailto:a@b.c', exp: 1_700_000_000 + 43200 });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64urlDecode(m[3]), utf8(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
});
