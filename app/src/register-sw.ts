import { toast } from 'sonner';

/** Registers the service worker and offers a one-tap refresh when a new version ships. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const promptUpdate = (worker: ServiceWorker) =>
        toast('A new version of the app is ready', {
          duration: Infinity,
          action: { label: 'Refresh', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
        });
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
      // Check for updates when the app regains focus (PWAs can stay open for days).
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
    } catch (e) {
      console.warn('[cwc] service worker registration failed', e);
    }
  });
}
