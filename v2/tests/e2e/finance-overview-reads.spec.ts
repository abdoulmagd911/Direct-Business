/**
 * The Finance Overview's reads (the oversight's defect of 12 Oct, V231): the page asks the database for six things, each
 * a view over every unit, so they must not all be asked together (at most two at once), a read that failed for the
 * database's time limit is asked once more by itself, and a block that still cannot be read says so in its own place
 * with a Try again that repeats only that read. Quick switching between the period tabs must never leave an error
 * block. Also: a month reads "October 2026", never "1 Oct 2026"; an empty By service says so in one line.
 * Every value is made up.
 * The "What needs attention" strip (Landing 34b): a window that comes back while the health read is on its way does
 * not ask it again; a reader the database refuses the health read has no strip at all — no Loading, no error; a
 * Viewer (View on Finance) gets the strip drawn. Sabotage: tests/sabotage/landing-34b-e2e.mjs.
 * Sabotage: tests/sabotage/finance.mjs "finance-reads-all-at-once", "finance-read-is-never-asked-again",
 * "finance-aborted-read-overwrites-the-answer", "finance-cancelled-read-frees-its-slot", "try-again-reloads-the-whole-page", "month-label-says-the-day", "by-service-empty-says-nothing", "finance-heavy-reads-asked-first".
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import { personAs } from './support/landing-32';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const reads = '**/rest/v1/rpc/finance_*';
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };

async function admin(page: Page) {
  const person = await makePerson({ admin: true });
  // these specs read every block: one made-up import is logged, so the page is past "Not imported yet" (V622)
  await sql(
    `insert into finance.import_batch (id, file, file_name, export_time, started_by)
     values ('00000000-0000-4000-8000-0000000f1ce5', 'invoices', 'made-up-invoices.xlsx', now() - interval '1 day', $1)
     on conflict (id) do nothing`,
    [person.id],
  );
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
  // (L17: 5000 ms — under parallel load the 800 ms route delay plus server time exceeds the old 1600 ms
  // budget, so the stale answers landed after the assertion and the plant stayed green)
  await page.waitForTimeout(5000);
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

// ---- Landing 34b: the "What needs attention" strip always settles

const fnOf = (url: string) => url.split('/rpc/')[1]?.split('?')[0] ?? '';

test('a window that comes back while the health read is on its way does not ask it again, and the strip then draws', async ({
  page,
}) => {
  await admin(page);
  const asked: Record<string, number> = {};
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(reads, async (route) => {
    const fn = fnOf(route.request().url());
    asked[fn] = (asked[fn] ?? 0) + 1;
    // the heaviest read is still on its way while the person looks at another window
    if (fn === 'finance_health') await held;
    try {
      await route.continue();
    } catch {
      // the page gave up on this request
    }
  });
  try {
    await page.goto('/finance?period=ytd');
    await hydrated(page);
    const overview = page.locator('[data-finance-overview]');
    await expect(page.locator('[data-finance-tiles]'), 'the figures have answered').toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-finance-months]'), 'the months have answered').toBeVisible({ timeout: 45_000 });
    await expect.poll(() => asked['finance_health'] ?? 0, 'the health read is out').toBe(1);
    await expect(overview, 'the strip waits for its own read').toHaveAttribute('data-finance-strip', 'loading');

    // the window comes back: the shell asks every screen to refetch 400 ms later (RefetchBridge, FOCUS_SETTLE_MS)
    const refetched = page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('[refetch] ms='),
      timeout: 60_000,
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refetched;
    // well past the shell's wait, and time for a second ask to have reached the network
    await page.waitForTimeout(1500);
    expect(asked['finance_health'], 'the health read on its way is not asked again when the window comes back').toBe(1);
    expect(asked['finance_period'], 'a fresh answer is not asked again either').toBe(1);
    await expect(overview, 'the strip is still waiting for the one read').toHaveAttribute(
      'data-finance-strip',
      'loading',
    );

    release();
    await expect(overview, 'the strip draws once its read answers').toHaveAttribute('data-finance-strip', 'drawn', {
      timeout: 45_000,
    });
    await expect(page.locator('[data-finance-attention]'), 'What needs attention is on the page').toBeVisible();
    await expect(
      page.locator('[data-finance-overview] [data-state="loading"], [data-finance-overview] [data-state="failed"]'),
      'no block is left on loading or failed',
    ).toHaveCount(0);
    expect(asked['finance_health'], 'the health read was asked once in all').toBe(1);
  } finally {
    release();
  }
});

test('a reader the database refuses the health read has no attention strip — no Loading, no error, no second ask', async ({
  page,
}) => {
  await admin(page);
  const asked: Record<string, number> = {};
  await page.route(reads, async (route) => {
    const fn = fnOf(route.request().url());
    asked[fn] = (asked[fn] ?? 0) + 1;
    if (fn === 'finance_health')
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: '42501', message: 'access.needs_level', details: null, hint: null }),
      });
    return route.continue();
  });
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await settled(page);
  await expect(page.locator('[data-finance-tiles]'), 'the figures are drawn').toBeVisible();
  await expect.poll(() => asked['finance_health'] ?? 0, 'the health read was asked').toBe(1);
  await expect(page.locator('[data-finance-overview]'), 'a refused health read hides the strip').toHaveAttribute(
    'data-finance-strip',
    'hidden',
  );
  await expect(page.locator('[data-finance-attention]'), 'no attention strip is drawn').toHaveCount(0);
  await expect(
    page.locator('[data-finance-overview] [data-state="failed"]'),
    'a refusal is not said as "could not be loaded"',
  ).toHaveCount(0);
  await expect(
    page.locator('[data-finance-overview] [data-state="loading"]'),
    'a refusal leaves nothing on Loading',
  ).toHaveCount(0);
  // a refusal is an answer: asking again would get the same one
  await page.waitForTimeout(2500);
  expect(asked['finance_health'], 'a refused read is not asked again').toBe(1);
  await expect(page.locator('[data-finance-overview]'), 'the strip stays hidden').toHaveAttribute(
    'data-finance-strip',
    'hidden',
  );
});

test('a Viewer — View on Finance — gets the attention strip drawn', async ({ page }) => {
  // the import log is past "Not imported yet" (made by an admin, as in the other tests here)
  const maker = await makePerson({ admin: true });
  await sql(
    `insert into finance.import_batch (id, file, file_name, export_time, started_by)
     values ('00000000-0000-4000-8000-0000000f1ce5', 'invoices', 'made-up-invoices.xlsx', now() - interval '1 day', $1)
     on conflict (id) do nothing`,
    [maker.id],
  );
  const viewer = await personAs('viewer');
  const [level] = await sql<{ level: string }>(`select authz.level_of($1, 'finance')::text as level`, [viewer.id]);
  expect(level?.level, 'a Viewer holds View on Finance, no more').toBe('view');
  const statuses: number[] = [];
  page.on('response', (r) => {
    if (fnOf(r.url()) === 'finance_health') statuses.push(r.status());
  });
  await signIn(page, viewer.email, '/finance?period=ytd');
  await hydrated(page);
  await expect(page.locator('[data-finance-overview]'), 'Finance is drawn for a Viewer').toBeVisible();
  await settled(page);
  expect(statuses, 'the database answers the health read for a View reader').toEqual([200]);
  await expect(page.locator('[data-finance-overview]'), 'a View reader’s strip is drawn').toHaveAttribute(
    'data-finance-strip',
    'drawn',
  );
  await expect(page.locator('[data-finance-attention]'), 'What needs attention is on the page').toBeVisible();
  await expect(
    page.locator('[data-finance-attention] [data-finance-flag]'),
    'the strip holds its three counts',
  ).toHaveCount(3);
  await expect(
    page.locator('[data-finance-overview] [data-state="failed"]'),
    'no block says it could not be loaded',
  ).toHaveCount(0);
});
