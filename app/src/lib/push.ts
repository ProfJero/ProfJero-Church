import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { api, apiConfigured } from './api';
import { db } from './firebase';

export type PushState = 'unsupported' | 'denied' | 'default' | 'subscribed' | 'unsubscribed';

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iOS only allows web push for apps added to the Home Screen. */
export function needsInstallForPush() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return ios && !isStandalone();
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function b64urlToBytes(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) return 'subscribed';
  return Notification.permission === 'granted' ? 'unsubscribed' : 'default';
}

export async function enablePush(uid: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!apiConfigured()) throw new Error('Notifications need the CWC API (VITE_API_URL) to be configured.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api<{ publicKey: string }>('/v1/push/public-key');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) });
  }
  await saveSubscription(uid, sub);
  return 'subscribed';
}

export async function saveSubscription(uid: string, sub: PushSubscription) {
  const json = sub.toJSON();
  await setDoc(doc(db, 'push_subscriptions', await sha256(sub.endpoint)), {
    uid,
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    userAgent: navigator.userAgent.slice(0, 200),
    createdAt: serverTimestamp(),
  });
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deleteDoc(doc(db, 'push_subscriptions', await sha256(sub.endpoint))).catch(() => {});
    await sub.unsubscribe();
  }
  return 'unsubscribed';
}

/** Keep the stored subscription fresh for signed-in users (endpoints rotate). */
export async function refreshPushSubscription(uid: string) {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await saveSubscription(uid, sub).catch(() => {});
}

export interface PushSendInput {
  title: string;
  body: string;
  url?: string;
  audience: 'all' | { uids: string[] };
  tag?: string;
  image?: string;
}

export function sendPush(input: PushSendInput) {
  return api<{ sent: number; failed: number; removed: number; total: number }>('/v1/push/send', { method: 'POST', json: input });
}
