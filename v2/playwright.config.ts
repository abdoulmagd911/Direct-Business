import { defineConfig, devices } from '@playwright/test';

// Builder B's port range is 9400–9499 (spec A18).
const PORT = 9400;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Asia/Riyadh',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: process.env.E2E_DEV ? `pnpm dev` : `pnpm build && pnpm start`,
    url: `http://127.0.0.1:${PORT}/sign-in`,
    // a sabotage sets E2E_FRESH so the mutated tree is built and started, not a server left running
    reuseExistingServer: !process.env.CI && !process.env.E2E_FRESH,
    timeout: 240_000,
    env: { NEXT_TELEMETRY_DISABLED: '1', V2_DEV_ME: '1' },
  },
});
