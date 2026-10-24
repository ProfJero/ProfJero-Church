import { test, expect, type Browser } from '@playwright/test';

const as = (browser: Browser, role: string, viewport = { width: 390, height: 844 }) =>
  browser.newContext({ storageState: `e2e/.auth/${role}.json`, viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 1024 });

const stamp = () => Date.now().toString(36).slice(-5);

test('a new member signs up with only a phone number', async ({ page }) => {
  const n = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(`Yaa Test ${stamp()}`);
  await page.getByLabel('Phone number').fill(`054${n}`);
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Yaa/ })).toBeVisible();
  // ...and can sign back in with the same phone number
  await page.goto('/me');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.locator('input[name=username]').fill(`054 ${n.slice(0, 3)} ${n.slice(3)}`);
  await page.locator('input[name=password]').fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Yaa/ })).toBeVisible();
});

test('prayer request → pastor replies → member sees the reply', async ({ browser }) => {
  const subject = `Exams ${stamp()}`;
  const member = await (await as(browser, 'member')).newPage();
  await member.goto('/care/new?type=prayer');
  await member.getByLabel('Subject (optional)').fill(subject);
  await member.getByLabel('Details').fill('Please pray for my final exams next week.');
  await member.getByRole('button', { name: /Prayer wall/ }).click();
  await member.getByRole('button', { name: 'Send request' }).click();
  await expect(member.getByText('We’ve received your request')).toBeVisible();

  const pastor = await (await as(browser, 'pastor', { width: 1280, height: 860 })).newPage();
  await pastor.goto('/admin/care');
  await pastor.getByText(subject).click();
  await pastor.getByPlaceholder('Write an encouraging reply…').fill('We are standing with you. You will excel!');
  await pastor.getByRole('button', { name: 'Send reply' }).click();
  await expect(pastor.getByText(/Reply sent|Reply saved/)).toBeVisible();

  await member.goto('/care');
  await member.getByText(subject).click();
  await expect(member.getByText('We are standing with you. You will excel!')).toBeVisible();
  // and it's on the prayer wall for others
  const other = await (await as(browser, 'phoneMember')).newPage();
  await other.goto('/care/wall');
  await expect(other.getByText(subject)).toBeVisible();
});

test('usher checks a member in at a live service', async ({ browser }) => {
  const page = await (await as(browser, 'usher')).newPage();
  await page.goto('/admin/attendance/svc-today-open');
  await page.getByPlaceholder('Find a person to check in…').fill('Ankrah');
  const btn = page.getByRole('button', { name: 'Check in' }).first();
  await btn.click();
  await expect(page.getByText(/checked in$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Increase Women' }).click();
  await expect(page.getByText(/^Checked in · [1-9]/)).toBeVisible();
});

test('treasurer records a tithe and sees it in transactions', async ({ browser }) => {
  const page = await (await as(browser, 'treasurer', { width: 1280, height: 860 })).newPage();
  await page.goto('/admin/giving?new=1');
  await page.getByPlaceholder('Search member, or type a name').fill('Kwame');
  await page.getByRole('option').first().click();
  await page.getByLabel('Amount (GH₵)').fill('275');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/GH₵ 275.00 recorded/)).toBeVisible();
  await page.getByRole('tab', { name: /Transactions/ }).click();
  await expect(page.getByRole('cell', { name: 'GH₵ 275.00' }).first()).toBeVisible();
});

test('secretary adds a first-timer and a follow-up is created', async ({ browser }) => {
  const last = `Visitor${stamp()}`;
  const page = await (await as(browser, 'secretary', { width: 1280, height: 860 })).newPage();
  await page.goto('/admin/people?new=1');
  await page.getByLabel('First name').fill('Esi');
  await page.getByLabel('Last name').fill(last);
  await page.getByLabel('Membership status').selectOption('first_timer');
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(last) })).toBeVisible();
  await page.goto('/admin/follow-ups');
  await expect(page.getByText(`Esi ${last}`)).toBeVisible();
});

test('member RSVPs to an event and can cancel', async ({ browser }) => {
  const page = await (await as(browser, 'phoneMember')).newPage();
  await page.goto('/events/evt-2');
  const going = page.getByRole('button', { name: 'I’m attending' });
  const cancel = page.getByRole('button', { name: 'Going · Cancel' });
  await expect(going.or(cancel)).toBeVisible();
  if (await going.isVisible()) {
    await going.click();
    await expect(page.getByText('You’re going!')).toBeVisible();
  }
  await cancel.click();
  await expect(page.getByRole('button', { name: 'I’m attending' })).toBeVisible();
});

test('members cannot open the admin console', async ({ browser }) => {
  const page = await (await as(browser, 'member')).newPage();
  await page.goto('/admin/giving');
  await expect(page.getByText('This area is restricted')).toBeVisible();
});

test('the treasurer only sees finance in the admin menu', async ({ browser }) => {
  const page = await (await as(browser, 'treasurer', { width: 1280, height: 860 })).newPage();
  await page.goto('/admin');
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Giving & finance' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Pastoral care' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveCount(0);
});

test('dark mode applies across the app', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json', colorScheme: 'dark', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto('/admin');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(10, 13, 22)');
});

test('SMS through the Worker reaches ProfJero Connect', async ({ browser, request }) => {
  const up = await request.get('http://127.0.0.1:8787/v1/health').catch(() => null);
  test.skip(!up?.ok(), 'Worker not running locally');
  const page = await (await as(browser, 'secretary', { width: 1280, height: 860 })).newPage();
  await page.goto('/admin/messages?compose=1');
  await page.getByLabel('Audience').selectOption('manual');
  await page.getByLabel('Phone numbers').fill('0241234567, 0551234567');
  await page.getByLabel('Message').fill('Hello from the CWC test suite');
  await page.getByRole('button', { name: 'Check cost' }).click();
  await expect(page.getByText(/2 units · balance/)).toBeVisible();
  await page.getByRole('button', { name: 'Send to 2' }).click();
  await page.getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByText('Sending to 2 people')).toBeVisible();
});
