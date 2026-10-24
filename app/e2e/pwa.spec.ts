import { test, expect } from '@playwright/test';

/** Runs against a production build: `npm run build:emulator && npx vite preview --mode emulator --port 4173`. */
const PREVIEW = process.env.E2E_PREVIEW_URL ?? 'http://127.0.0.1:4173';

test.describe('PWA (production build)', () => {
  test.beforeAll(async ({ request }) => {
    const ok = await request.get(PREVIEW).then((r) => r.ok()).catch(() => false);
    test.skip(!ok, 'Preview server not running');
  });

  test('has an installable web app manifest', async ({ request }) => {
    const html = await (await request.get(PREVIEW)).text();
    expect(html).toContain('rel="manifest"');
    const m = await (await request.get(`${PREVIEW}/manifest.webmanifest`)).json();
    expect(m).toMatchObject({ name: 'Christian Worship Centre', short_name: 'CWC', display: 'standalone', start_url: '/?source=pwa', theme_color: '#1e3a8a' });
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
    for (const icon of m.icons) expect((await request.get(PREVIEW + icon.src)).ok()).toBe(true);
    expect(m.shortcuts.length).toBeGreaterThanOrEqual(3);
  });

  test('service worker takes control and the app opens offline', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(PREVIEW + '/login');
    await page.locator('input[name=username]').fill('member@cwc.test');
    await page.locator('input[name=password]').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    // Visit a few pages so they're in the runtime cache, then cut the network.
    for (const p of ['/devotionals', '/events', '/give']) {
      await page.goto(PREVIEW + p);
      await expect(page.locator('h1').first()).toBeVisible();
    }
    await ctx.setOffline(true);
    await page.goto(PREVIEW + '/give');
    await expect(page.getByRole('heading', { name: 'Give' })).toBeVisible();
    await expect(page.getByText(/Offline/)).toBeVisible();
    await page.goto(PREVIEW + '/');
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
