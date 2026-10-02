import { defineConfig, devices } from '@playwright/test';
import type { ClockOptions } from './tests/e2e/support/fixtures';

// Builder A's local test ports are 9300–9399 (spec A18); the app under test is served on 9300.
const PORT = 9300;
const baseURL = `http://127.0.0.1:${PORT}`;

// In CI the browsers are installed by `playwright install`. In the builders' containers a Chromium is pre-installed
// under a different revision; point PW_CHROMIUM_PATH at it instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig<ClockOptions>({
  testDir: 'tests/e2e',
  // the admin's access steps of the employee view (brief E, V217), as they stand once the oversight has made them
  globalSetup: './tests/e2e/support/employee-view-access.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Asia/Riyadh',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /\.alone\.spec\.ts$/ },
    // The old app's lesson (PRF-139): the same flows under another clock, an Arabic browser and a moved clock — the
    // app must still speak of Riyadh days, Gregorian dates and Western digits (V40), whatever the machine says. The
    // moved clock is tests/e2e/support/fixtures.ts (`movedClock`): 22:30 UTC on the last day of a month, which is
    // already the next day in Riyadh.
    {
      name: 'utc-arabic-browser',
      testMatch: /(p3-7|settings|org|profile|access|door|partners)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], locale: 'ar-SA', timezoneId: 'UTC', movedClock: true },
    },
    // A spec whose action reaches every person (one "Generate for everyone without a password", say) runs alone, after
    // all the others: in parallel it would change the people another spec is in the middle of using. Name it *.alone.spec.ts.
    {
      name: 'alone',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /\.alone\.spec\.ts$/,
      dependencies: ['chromium', 'utc-arabic-browser'],
      fullyParallel: false,
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // V2_KIT lets the test build serve /kit (V202); the specs sign in through the local stack (tests/e2e/support/stack.ts).
    env: { V2_KIT: '1', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
