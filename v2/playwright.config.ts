import { defineConfig, devices } from '@playwright/test';

// Builder A's local test ports are 9300–9399 (spec A18); the app under test is served on 9300.
const PORT = 9300;
const baseURL = `http://127.0.0.1:${PORT}`;

// In CI the browsers are installed by `playwright install`. In the builders' containers a Chromium is pre-installed
// under a different revision; point PW_CHROMIUM_PATH at it instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // V2_KIT lets the test build serve /kit (V202); the specs sign in through the local stack (tests/e2e/support/stack.ts).
    env: { V2_KIT: '1', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
