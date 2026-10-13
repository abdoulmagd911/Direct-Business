/**
 * The Finance Overview's reads (the oversight's defect of 12 Oct, V231): the page asks the database for six things, each
 * a view over every unit, so they must not all be asked together (at most two at once), a read that failed for the
 * database's time limit is asked once more by itself, and a block that still cannot be read says so in its own place
 * with a Try again that repeats only that read. Quick switching between the period tabs must never leave an error
 * block. Also: a month reads "October 2026", never "1 Oct 2026"; an empty By service says so in one line.
 * Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "finance-reads-all-at-once", "finance-read-is-never-asked-again",
 * "finance-aborted-read-overwrites-the-answer", "finance-cancelled-read-frees-its-slot", "try-again-reloads-the-whole-page", "month-label-says-the-day", "by-service-empty-says-nothing", "finance-heavy-reads-asked-first".
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
  // What the database sees: a read is open from the moment its request arrives until the server has really answered
  // (route.fetch runs on, as a database statement does, when the browser gives up on the request), counted from those
  // start and end events and never from timing (QA-552).
  let open = 0;
  let peak = 0;
  await page.route(reads, async (route) => {
    open += 1;
    peak = Math.max(peak, open);
    try {
      await new Promise((r) => setTimeout(r, 250));
      const response = await route.fetch();
      await route.fulfill({ response }).catch(() => {
        // the page gave up on this request; the server has answered all the same
      });
    } catch {
      // the test ended while the server was still answering
    } finally {
      open -= 1;
    }
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

test('going back to a period just seen never leaves a block stuck on loading (QA-549)', async ({ page }) => {
  await admin(page);
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await settled(page);
  // every read now answers slowly; the person goes to MTD and back to YTD while the first asks are still out
  await page.route(reads, async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    try {
      await route.continue();
    } catch {
      // the page closed
    }
  });
  await page.locator('[data-finance-period-key="mtd"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-finance-period-key="ytd"]').click();
  await settled(page);
  // the reads sent for MTD land now, after the kept YTD answers were shown: they must change nothing
  await page.waitForTimeout(1600);
  await expect(
    page.locator('[data-finance-overview] [data-state="loading"], [data-finance-overview] [data-state="failed"]'),
    'no block is left on loading or failed after going back to a period',
  ).toHaveCount(0);
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

test('the reads are asked in the order a person looks: tiles, the two lists, then months and health', async ({
  page,
}) => {
  await admin(page);
  const asked: string[] = [];
  await page.route(reads, async (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop()!;
    if (!asked.includes(fn)) asked.push(fn);
    try {
      await new Promise((r) => setTimeout(r, 150));
      const response = await route.fetch();
      await route.fulfill({ response }).catch(() => {});
    } catch {
      // the test ended while the server was still answering
    }
  });
  await page.goto('/finance?period=mtd');
  await hydrated(page);
  await settled(page);
  const at = (fn: string) => asked.indexOf(fn);
  expect(at('finance_period'), 'the tiles are asked first').toBe(0);
  for (const early of ['finance_not_invoiced', 'finance_income_by_service']) {
    for (const heavy of ['finance_closed_months', 'finance_health']) {
      expect(at(early), `${early} is asked before ${heavy}`).toBeGreaterThanOrEqual(0);
      expect(at(early), `${early} is asked before ${heavy}`).toBeLessThan(at(heavy));
    }
  }
});
