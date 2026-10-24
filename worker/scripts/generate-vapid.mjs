// Generates a VAPID key pair for web push. Store both as Worker secrets.
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
const b64u = (u8) => Buffer.from(u8).toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + b64u(pub));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
console.log('\nSet them with:\n  npx wrangler secret put VAPID_PUBLIC_KEY\n  npx wrangler secret put VAPID_PRIVATE_KEY');
