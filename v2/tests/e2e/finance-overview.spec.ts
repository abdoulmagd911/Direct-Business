/**
 * The Finance Overview (GC-5; V610, V611, V620, V612; brief section F, tests 1–3, 10, 13, 21, 22): the period's three
 * tiles each print the exact figure under a short form and the Provisional part directly under the figure; the months
 * run newest first and a month that has ended carries Close month for a person with Full on Finance — the confirm
 * names the month and says it never changes, the chip then reads "Closed" with its day, and there is no Undo; a payment
 * that lands after the close is listed under After close while the month's own figures do not move; the commissions
 * sentence and one Payments stamp are on the page; at 390 px nothing scrolls sideways and every target is 44 px.
 * Every value is made up; each test uses its own old month, so the figures are only its own.
 * Sabotage: tests/sabotage/finance.mjs "closed-month-row-takes-late-changes", "tile-profit-leaves-provisional-out",
 * "short-form-hides-its-exact-figure", "close-month-offers-an-undo", "member-can-close-a-month",
 * "commissions-sentence-missing", "two-payments-stamps".
 */
import { expect, test, type Page } from '@playwright/test';
import { oldMonth } from './support/finance-month';
import { blocksSettled } from './support/finance-blocks';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

const addressOf = (ym: string) => `/finance?period=custom&from=${ym}-01&to=${ym}-28`;
const ref = () => `TX-9${Math.floor(Math.random() * 900000 + 100000)}`;

type Door = (fn: string, args: Record<string, unknown>) => Promise<{ id?: string }>;

async function signedInAdmin(page: Page, ym: string): Promise<Door> {
  const admin = await makePerson({ admin: true });
  // sign in on the light home page: the Overview reads the whole ledger and may take longer than the sign-in's timeout
  await signIn(page, admin.email);
  await page.goto(addressOf(ym));
  await hydrated(page);
  await blocksSettled(page);
  return async (fn, args) => {
    const r = await callAs(page.context(), fn, args);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body as { id?: string };
  };
}

/** Two paid units in the month: 1,000 with an approved cost of 600 (Final) and 500 with none yet (Provisional), and one unpaid. */
async function seed(call: Door, ym: string) {
  const a = await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: ref(),
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: `${ym}-10`,
      paid_on: `${ym}-12`,
      total_sar: 1000,
      customer_name: 'Made Up Trading Co',
    },
    p_reason: 'made up',
  });
  await call('finance_row_add', {
    p_table: 'expense_line',
    p_fields: { invoice_id: a.id, expense_type: 'Hotel', status: 'Approved', amount_sar: 600 },
    p_reason: 'made up',
  });
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: ref(),
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: `${ym}-11`,
      paid_on: `${ym}-13`,
      total_sar: 500,
      customer_name: 'Made Up Travel House',
    },
    p_reason: 'made up',
  });
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: ref(),
      kind: 'transaction',
      status: 'Published',
      created_on: `${ym}-14`,
      total_sar: 400,
      customer_name: 'Made Up Unpaid Co',
    },
    p_reason: 'made up',
  });
}

const tile = (page: Page, kind: string) => page.locator(`[data-finance-tile="${kind}"]`);
const today = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short' }).format(new Date());

test('desk 1440: the tiles print the exact figure and the Provisional part, the months close once with no Undo, a late payment is listed after the close', async ({
  page,
}) => {
  const ym = await oldMonth();
  await page.setViewportSize({ width: 1440, height: 900 });
  const call = await signedInAdmin(page, ym);
  await seed(call, ym);
  await page.goto(addressOf(ym));
  await hydrated(page);
  await blocksSettled(page);

  // only paid units count: 1,000 + 500 revenue, 600 cost, 900 profit; the unit with no approved expense is Provisional
  await expect(tile(page, 'revenue').locator('[data-finance-figure]'), 'revenue is its short form').toContainText(
    '1.5K',
  );
  await expect(
    tile(page, 'revenue').locator('[data-finance-exact]'),
    'a short form prints its exact figure',
  ).toContainText('1,500 SAR');
  await expect(tile(page, 'cost').locator('[data-finance-figure]')).toContainText('600');
  await expect(tile(page, 'profit').locator('[data-finance-figure]')).toContainText('900');
  await expect(
    tile(page, 'revenue').locator('[data-finance-provisional]'),
    'the Provisional part sits in the tile',
  ).toContainText('of which Provisional 500 · 1 unit');
  await expect(
    tile(page, 'profit').locator('[data-finance-provisional]'),
    'profit keeps its Provisional part',
  ).toContainText('of which Provisional 500 · 1 unit');
  await expect(page.locator('[data-finance-commissions]'), 'the commissions sentence is on the Overview').toHaveText(
    'Commissions paid outside Payments are not included.',
  );
  await expect(page.locator('[data-finance-stamp]'), 'one Payments stamp').toHaveCount(1);
  // the stamp is a date or, before any Payments file, words — never a dash (V622); other specs may log a file
  await expect(page.locator('[data-finance-stamp]')).toContainText('Payments · ');
  await expect(page.locator('[data-finance-stamp]')).not.toContainText('as of —');

  // the month has ended and is not closed: Close month, with a confirm that names it and says it never changes
  const row = page.locator(`[data-finance-month="${ym}-01"]`);
  await expect(row).toHaveAttribute('data-state', 'ended');
  await row.locator('[data-close-month]').click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('It will never change. Later news becomes a dated note.');
  await confirm.getByRole('button', { name: 'Close month' }).click();
  // the toast first: it lives a few seconds and the refreshed page can take longer than that on a busy machine
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'closed' });
  await expect(toast, 'closing says so').toBeVisible();
  await expect(toast, 'closing has no Undo (V620)').not.toContainText('Undo');
  await expect(row).toHaveAttribute('data-state', 'closed');
  await expect(row, 'the chip reads Closed with its day').toContainText(`Closed ${today()}`);
  await expect(row.locator('[data-close-month]')).toHaveCount(0);

  // a payment that lands after the close is a dated line under the month; the month's own figures do not change
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: ref(),
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: `${ym}-15`,
      paid_on: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date()),
      total_sar: 300,
      customer_name: 'Made Up Late Payer',
    },
    p_reason: 'made up',
  });
  await page.goto(addressOf(ym));
  await hydrated(page);
  await blocksSettled(page);
  await expect(page.locator(`[data-finance-late-toggle="${ym}-01"]`)).toContainText('Late changes · 1');
  await page.locator(`[data-finance-late-toggle="${ym}-01"]`).click();
  const line = page.locator('[data-finance-late-line="late_paid"]');
  await expect(line).toContainText('Paid late');
  await expect(line).toContainText('+300');
  await expect(row.getByText('1,500').first(), 'the closed month keeps its figures').toBeVisible();
  await expect(tile(page, 'revenue').locator('[data-finance-exact]')).toContainText('1,500 SAR');
});

test('a member sees the month is not closed and has no Close month; the Provisional part is never left out', async ({
  page,
}) => {
  const ym = await oldMonth();
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/');
  await seed(async (fn, args) => {
    const r = await callAs(page.context(), fn, args);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body as { id?: string };
  }, ym);
  const member = await makePerson();
  await page.context().clearCookies();
  await signIn(page, member.email);
  await page.goto(addressOf(ym));
  await hydrated(page);
  await blocksSettled(page);
  const row = page.locator(`[data-finance-month="${ym}-01"]`);
  await expect(row, 'a member sees the month is not closed').toContainText('Not closed');
  await expect(page.locator('[data-close-month]'), 'only Full on Finance closes a month').toHaveCount(0);
  await expect(tile(page, 'cost').locator('[data-finance-provisional]')).toContainText('of which Provisional');
});

test('phone 390: nothing scrolls sideways, the Provisional part is directly under its figure, every target is 44 px', async ({
  page,
}) => {
  const ym = await oldMonth();
  await page.setViewportSize({ width: 390, height: 844 });
  const call = await signedInAdmin(page, ym);
  await seed(call, ym);
  await page.goto(addressOf(ym));
  await hydrated(page);
  await blocksSettled(page);

  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBeLessThanOrEqual(
    390,
  );
  for (const kind of ['revenue', 'cost', 'profit']) {
    const figure = await tile(page, kind).locator('[data-finance-figure]').boundingBox();
    const part = await tile(page, kind).locator('[data-finance-provisional]').boundingBox();
    expect(
      part!.y - (figure!.y + figure!.height),
      `${kind}: the Provisional part is right under its figure`,
    ).toBeLessThan(60);
    expect(part!.x + part!.width, `${kind}: nothing is clipped`).toBeLessThanOrEqual(390);
  }
  // the floating + sits at the right edge (56 px wide, 16 px in): the Needs attention row and every month row stay clear of it
  const clear = await page.evaluate(() => {
    const rightmost = (root: Element) =>
      Math.max(
        ...[...root.querySelectorAll('*')]
          .filter((el) => el.children.length === 0)
          .map((el) => el.getBoundingClientRect().right),
      );
    return {
      attention: rightmost(document.querySelector('[data-finance-attention]')!),
      months: Math.max(...[...document.querySelectorAll('[data-finance-month]')].map(rightmost)),
    };
  });
  expect(clear.attention, 'the Needs attention row stays clear of the + button').toBeLessThanOrEqual(390 - 72);
  expect(clear.months, 'the month rows stay clear of the + button').toBeLessThanOrEqual(390 - 72);
  await expect(
    page.locator(`[data-finance-month="${ym}-01"] [data-finance-month-card]`),
    'the month is a card on a phone',
  ).toBeVisible();
  const targets = await page
    .locator('[data-finance-period] a, [data-close-month], [data-finance-late-toggle]')
    .evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ what: (e as HTMLElement).innerText.trim(), h: e.getBoundingClientRect().height }))
        .filter((x) => x.h < 43.5),
    );
  expect(targets, 'every target is 44 px or more').toEqual([]);
});
