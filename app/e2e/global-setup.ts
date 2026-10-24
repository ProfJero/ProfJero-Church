import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';

export const ACCOUNTS = {
  admin: 'admin@cwc.test',
  pastor: 'pastor@cwc.test',
  treasurer: 'treasurer@cwc.test',
  secretary: 'secretary@cwc.test',
  usher: 'usher@cwc.test',
  member: 'member@cwc.test',
  phoneMember: '0241234567',
} as const;

/** Signs each seeded account in once and saves its session for the tests. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync('e2e/.auth', { recursive: true });
  const browser = await chromium.launch(config.projects[0].use.launchOptions);
  await Promise.all(
    Object.entries(ACCOUNTS).map(async ([role, login]) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(baseURL + '/login');
      await page.locator('input[name=username]').fill(login);
      await page.locator('input[name=password]').fill('password123');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
      await page.waitForTimeout(1000);
      await ctx.storageState({ path: `e2e/.auth/${role}.json`, indexedDB: true });
      await ctx.close();
    }),
  );
  await browser.close();
}
