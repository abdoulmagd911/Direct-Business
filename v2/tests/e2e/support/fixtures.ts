import { test as base } from '@playwright/test';

/**
 * The moved clock (PRF-139): a project that sets `movedClock: true` runs every test with the browser's clock at
 * 22:30 UTC on the last day of a month — 01:30 the next day in Riyadh, and a new month there. A screen that speaks of
 * "today" from the machine's clock instead of Riyadh's shows the wrong day; a date typed or shown must stay Gregorian
 * with Western digits whatever the browser's locale says. Specs that care import `test` from here.
 */
export type ClockOptions = { movedClock: boolean };

export const MOVED_CLOCK_AT = new Date('2026-10-31T22:30:00Z');

export const test = base.extend<ClockOptions>({
  movedClock: [false, { option: true }],
  page: async ({ page, movedClock }, provide) => {
    if (movedClock) await page.clock.setFixedTime(MOVED_CLOCK_AT);
    await provide(page);
  },
});

export { expect } from '@playwright/test';
