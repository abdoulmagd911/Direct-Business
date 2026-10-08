import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, RUN_DIR } from './paths.mjs';

// The QA sweep's own config (the builders' playwright.config.ts is left alone). tests/qa/sweep/run.sh starts the app
// on the QA lane's port (9610) against the QA stack and seeds the fixtures first; this config only drives it.
// A pre-installed Chromium of another revision is used through PW_CHROMIUM_PATH (run.sh sets it when present).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  // the pilot path changes role levels, so it runs alone: QA_PILOT=1 run.sh -- --grep "pilot path"
  // the pilot path and the integrated pass change role levels (then put them back): run only when asked for
  grepInvert: [
    ...(process.env.QA_PILOT ? [] : [/pilot path/]),
    ...(process.env.QA_INTEGRATED ? [] : [/integrated pass/]),
    ...(process.env.QA_ROUND ? [] : [/desktop round/, /phone round/]),
  ],
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
