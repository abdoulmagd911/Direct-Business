import { expect, type Page } from '@playwright/test';

/** The Overview reads its blocks in the browser, a few at a time: wait until every block has answered. */
export const blocksSettled = (page: Page) =>
  expect(page.locator('[data-finance-overview] [data-state="loading"]'), 'every block has answered').toHaveCount(0, {
    timeout: 45_000,
  });
