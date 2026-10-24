import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { name: 'small-phone', width: 320, height: 640 },
  { name: 'android', width: 360, height: 740 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'large-phone', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'full-hd', width: 1920, height: 1080 },
];

const PAGES: { role: string; paths: string[] }[] = [
  { role: 'anon', paths: ['/welcome', '/login', '/signup', '/forgot'] },
  {
    role: 'admin',
    paths: [
      '/admin', '/admin/people', '/admin/people/mem-021', '/admin/people/import', '/admin/groups', '/admin/groups/grp-1',
      '/admin/follow-ups', '/admin/attendance', '/admin/attendance/svc-today-open', '/admin/giving', '/admin/events',
      '/admin/events/evt-1', '/admin/content', '/admin/care', '/admin/messages', '/admin/messages?tab=history',
      '/admin/messages?tab=wallet', '/admin/messages?tab=push', '/admin/reports', '/admin/users', '/admin/settings', '/admin/audit',
    ],
  },
  { role: 'treasurer', paths: ['/admin', '/admin/giving'] },
  { role: 'usher', paths: ['/admin', '/admin/attendance/svc-today-open'] },
  {
    role: 'member',
    paths: ['/', '/devotionals', '/devotionals/dev-1', '/events', '/events/evt-1', '/sermons', '/sermons/ser-1', '/give', '/care', '/care/new?type=prayer', '/care/wall', '/care/care-1', '/notifications', '/me', '/checkin/svc-today-open'],
  },
];

/** Visible elements that stick out past the viewport and aren't inside a scroll/clip container. */
async function offenders(page: Page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right <= W + 1 && r.left >= -1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.position === 'fixed') continue;
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
          const pr = p.getBoundingClientRect();
          if (pr.right <= W + 1 && pr.left >= -1) {
            clipped = true;
            break;
          }
        }
        p = p.parentElement;
      }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${(el.className?.toString?.() ?? '').split(' ').slice(0, 4).join('.')} right=${Math.round(r.right)} W=${W} text="${(el.innerText ?? '').slice(0, 30)}"`);
    }
    return out.slice(0, 5);
  });
}

for (const vp of VIEWPORTS) {
  for (const group of PAGES) {
    test.describe(`${vp.name} ${vp.width}px · ${group.role}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width < 768,
        hasTouch: vp.width < 1024,
        storageState: group.role === 'anon' ? undefined : `e2e/.auth/${group.role}.json`,
      });
      for (const path of group.paths) {
        test(path, async ({ page }) => {
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => {
            if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource|permission|PERMISSION_DENIED|i\.ytimg/i.test(m.text())) errors.push(m.text().slice(0, 200));
          });
          await page.goto(path);
          await expect(page.locator('h1').first()).toBeVisible();
          await page.waitForTimeout(1200);
          expect(await offenders(page), 'elements overflow the screen').toEqual([]);
          const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(scroll, 'horizontal scroll').toBeLessThanOrEqual(1);
          expect(errors, 'runtime errors').toEqual([]);
        });
      }
    });
  }
}
