/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// App shell (injected at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA: every navigation serves the cached index.html, so the app opens offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/humans\.txt/, /^\/robots\.txt/] }));

// Cloudinary media — cache-first, capped so phones don't fill up.
registerRoute(
  ({ url }) => url.hostname === 'res.cloudinary.com',
  new CacheFirst({
    cacheName: 'cwc-media',
    plugins: [new ExpirationPlugin({ maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })],
  }),
);

// YouTube thumbnails for sermons
registerRoute(
  ({ url }) => url.hostname === 'i.ytimg.com',
  new StaleWhileRevalidate({ cacheName: 'cwc-thumbs', plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 })] }),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------------- Push notifications ---------------- */

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  image?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'Christian Worship Centre';
  const options: NotificationOptions & { image?: string; renotify?: boolean; vibrate?: number[] } = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-96.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    image: data.image,
    data: { url: data.url || '/notifications' },
    requireInteraction: data.requireInteraction ?? false,
    vibrate: [120, 60, 120],
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Let open tabs refresh their inbox badge
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', title }));
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await (client as WindowClient).navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // The page re-saves the fresh subscription on next launch (see refreshPushSubscription).
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))),
  );
});
