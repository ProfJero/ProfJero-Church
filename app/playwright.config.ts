import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the local Firebase emulators (seeded), the
 * Vite dev server in emulator mode, and optionally the Worker + mock SMS API.
 * See README → Testing.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    trace: 'retain-on-failure',
  },
});
