import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { BASE_URL, RUN_DIR } from '../sweep/paths.mjs';

// The preview gallery's own config (tests/qa/gallery/run.sh starts the app and seeds first; this only drives it).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.ts$/,
  outputDir: join(RUN_DIR, 'gallery-results'),
  fullyParallel: true,
  workers: Number(process.env.QA_WORKERS || 4),
  retries: 0,
  reporter: [['list']],
  timeout: 900_000,
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    locale: 'en-GB',
    timezoneId: 'Asia/Riyadh',
    launchOptions: executablePath ? { executablePath } : {},
  },
});
