/**
 * The Finance Overview's reads (the oversight's defect of 12 Oct, V231): the page asks the database for six things, each
 * a view over every unit, so they must not all be asked together (at most two at once), a read that failed for the
 * database's time limit is asked once more by itself, and a block that still cannot be read says so in its own place
 * with a Try again that repeats only that read. Quick switching between the period tabs must never leave an error
 * block. Also: a month reads "October 2026", never "1 Oct 2026"; an empty By service says so in one line.
 * Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "finance-reads-all-at-once", "finance-read-is-never-asked-again",
 * "try-again-reloads-the-whole-page", "month-label-says-the-day", "by-service-empty-says-nothing".
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const reads = '**/rest/v1/rpc/finance_*';
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

async function admin(page: Page) {
  const person = await makePerson({ admin: true });
  await signIn(page, person.email);
}
const settled = blocksSettled;

test('quick switching between the periods never leaves an error block, and never asks for more than two reads at once', async ({
  page,
}) => {
  await admin(page);
  let open = 0;
  let peak = 0;
  await page.route(reads, async (route) => {
    open += 1;
    peak = Math.max(peak, open);
    await new Promise((r) => setTimeout(r, 250));
    try {
      await route.continue();
    } catch {
      // a read the page gave up on is cancelled; that is the point
    }
    open -= 1;
  });
  await page.goto('/finance?period=mtd');
  await hydrated(page);
  for (const key of ['ytd', 'custom', 'qtd', 'mtd', 'ytd', 'qtd', 'ytd']) {
    await page.locator(`[data-finance-period-key="${key}"]`).click();
  }
  await settled(page);
  await expect(
    page.locator('[data-finance-overview] [data-state="failed"]'),
    'no block says it could not be loaded',
  ).toHaveCount(0);
  await expect(page.locator('[data-finance-tiles]')).toBeVisible();
  await expect(page.locator('[data-finance-months]')).toBeVisible();
  await expect(page.locator('[data-finance-attention]')).toBeVisible();
  expect(peak, 'at most two Finance reads are in flight at once').toBeLessThanOrEqual(2);
});

test('a read that failed for the database’s time limit is asked once more, and the block never shows the error', async ({
  page,
}) => {
  await admin(page);
  const asked: Record<string, number> = {};
  await page.route(reads, async (route) => {
    const fn = route.request().url().split('/rpc/')[1]?.split('?')[0] ?? '';
    asked[fn] = (asked[fn] ?? 0) + 1;
    if ((fn === 'finance_closed_months' || fn === 'finance_health') && asked[fn] === 1)
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(timeout) });
    return route.continue();
  });
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await settled(page);
  await expect(
    page.locator('[data-finance-overview] [data-state="failed"]'),
    'a timeout is retried, not shown',
  ).toHaveCount(0);
  await expect(page.locator('[data-finance-months]')).toBeVisible();
  await expect(page.locator('[data-finance-attention]')).toBeVisible();
  expect(asked['finance_closed_months'], 'the failed read was asked once more').toBe(2);
  expect(asked['finance_health']).toBe(2);
  expect(asked['finance_period'], 'a read that worked is asked once').toBe(1);
});

test('a read that keeps failing says so in its own block, and Try again repeats only that read', async ({ page }) => {
  await admin(page);
  const asked: Record<string, number> = {};
  let failing = true;
  await page.route(reads, async (route) => {
    const fn = route.request().url().split('/rpc/')[1]?.split('?')[0] ?? '';
    asked[fn] = (asked[fn] ?? 0) + 1;
    if (failing && fn === 'finance_closed_months')
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(timeout) });
    return route.continue();
  });
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await settled(page);
  const failed = page.locator('[data-finance-overview] [data-state="failed"]');
  await expect(failed, 'only the months block failed').toHaveCount(1);
  await expect(failed).toContainText('The months could not be loaded');
  await expect(page.locator('[data-finance-tiles]'), 'the figures are still there').toBeVisible();
  const before = { ...asked };

  failing = false;
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-finance-months]'), 'Try again brings the months back').toBeVisible();
  await expect(failed).toHaveCount(0);
  expect(asked['finance_closed_months'], 'the months were asked again').toBeGreaterThan(
    before['finance_closed_months'] ?? 0,
  );
  expect(asked['finance_period'], 'Try again repeats only that read').toBe(before['finance_period']);
  expect(asked['finance_health']).toBe(before['finance_health']);
});

test('a month reads "October 2026", never "1 Oct 2026"', async ({ page }) => {
  await admin(page);
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await settled(page);
  const label = page.locator('[data-finance-month]').first().locator('.font-medium').first();
  await expect(label, 'the month is its name and year').toHaveText(/^[A-Z][a-z]+ \d{4}$/);
});

test('an empty By service says so in one line', async ({ page }) => {
  await admin(page);
  await page.goto('/finance?period=custom&from=1955-03-01&to=1955-03-28');
  await hydrated(page);
  await settled(page);
  await expect(page.locator('[data-finance-service-empty]'), 'nothing to split says so').toHaveText(
    'No income in this period',
  );
});
