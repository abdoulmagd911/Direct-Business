import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, RUN_DIR } from './paths.mjs';

// The QA sweep's own config (the builders' playwright.config.ts is left alone). The QA lane's run.sh, or on v2/main the
// CI job "every control on main (report)", starts the app on port 9610 against the QA stack and seeds the made-up
// fixtures first; this config only drives it. A pre-installed Chromium of another revision is used through
// PW_CHROMIUM_PATH when it is set.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  // the crawl presses every control, so it runs only when asked for (QA_ROUND=1)
  grepInvert: process.env.QA_ROUND ? [] : [/every control/],
  outputDir: join(RUN_DIR, 'test-results'),
  fullyParallel: true,
  workers: Number(process.env.QA_WORKERS || 4),
  retries: 0,
  reporter: [['list']],
  timeout: 240_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    locale: 'en-GB',
    timezoneId: 'Asia/Riyadh',
    viewport: { width: 1500, height: 1000 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 1000 } } }],
});
