/**
 * New invoice (P4-4, GC-5; V617, V610, V611, V622; brief section F tests 5, 11, 12, 13): a person with Full on Finance types
 * an invoice, a line and expenses; the side panel works out Revenue, Cost and Profit with the Provisional part beside
 * Profit; Save writes one row each (typed, logged) and says so with an Undo that takes every row back; the same number
 * twice is refused in its field before anything is written; a person without Full gets the no-access state; at 390 px
 * nothing scrolls sideways and every target is 44 px. Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "new-invoice-skips-the-required-check", "new-invoice-saves-a-duplicate-number",
 * "new-invoice-leaves-provisional-out", "new-invoice-undo-leaves-the-lines", "new-invoice-offers-a-fifth-kind",
 * "new-invoice-credit-to-always-asked".
 */
import { expect, test, type Page } from '@playwright/test';
import { oldMonth } from './support/finance-month';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const ref = () => `TX-8${Math.floor(Math.random() * 900000 + 100000)}`;

async function pick(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const total = (page: Page, kind: string) => page.locator(`[data-total="${kind}"] dd`);

test('desk 1440: a typed invoice shows its totals with the Provisional part, saves one row each, and Undo takes them all back', async ({
  page,
}) => {
  const ym = await oldMonth();
  const number = ref();
  await page.setViewportSize({ width: 1440, height: 900 });
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);
  await page.goto('/finance/new');
  await hydrated(page);

  // the kinds on offer: no Credit note (V423), and the one that carries no revenue is named as the brief says
  await expect(page.locator('[data-kind]'), 'four kinds, no Credit note').toHaveCount(4);
  await expect(page.getByRole('radio', { name: 'Credit note' })).toHaveCount(0);
  await expect(page.getByText('Typed', { exact: true }), 'a new invoice is Typed').toBeVisible();
  await expect(page.getByLabel('Transaction no.')).toBeVisible();

  await page.getByLabel('Transaction no.').fill(number);
  await pick(page, 'Status', 'Fully Paid');
  await page.getByLabel('Created').fill(`${ym}-10`);
  await page.getByLabel('Paid', { exact: true }).fill(`${ym}-12`);
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill('1000');
  await page.getByLabel('Client ID').fill('CL-9001');
  await page.getByLabel('Name', { exact: true }).fill('Made Up Trading Co');

  await page.locator('[data-add-line]').click();
  const line = page.locator('[data-line-row]').first();
  await line.getByLabel('Product').click();
  await page.getByRole('option', { name: 'Hotels', exact: true }).click();
  await expect(line.getByLabel('Service'), 'the service follows the product (V483)').toContainText('Hotels');
  await line.getByLabel('Item').fill('Hotel · 5 room nights');
  await line.getByLabel('Qty').fill('2');
  await line.getByLabel('Price').fill('500');
  await expect(line.locator('[data-line-total]'), 'a line works out qty × price').toHaveText('1,000.00');

  // revenue counts once the status is paid; with no expense yet the profit is Provisional, shown beside it
  await expect(total(page, 'revenue')).toHaveText('1,000.00');
  await expect(page.locator('[data-new-state]'), 'no approved expense is Provisional').toContainText('Provisional');
  await expect(page.locator('[data-new-provisional]'), 'the Provisional part sits beside Profit').toContainText(
    '1,000.00',
  );

  await page.locator('[data-add-expense]').click();
  const expense = page.locator('[data-expense-row]').first();
  await expense.getByLabel('Type').fill('Hotel');
  await expense.getByLabel('Amount').fill('600');
  await expense.getByLabel('Status', { exact: true }).click();
  await page.getByRole('option', { name: 'Approved', exact: true }).click();
  await expect(total(page, 'cost')).toHaveText('600.00');
  await expect(total(page, 'profit')).toHaveText('400.00');
  await expect(page.locator('[data-new-state]'), 'every expense approved is Final').toContainText('Final');
  await expect(page.locator('[data-new-provisional]')).toHaveCount(0);

  // a pending expense turns it Provisional again, and a check says so
  await page.locator('[data-add-expense]').click();
  const second = page.locator('[data-expense-row]').nth(1);
  await second.getByLabel('Type').fill('Airline ticket');
  await second.getByLabel('Status', { exact: true }).click();
  await page.getByRole('option', { name: 'Pending', exact: true }).click();
  await expect(page.locator('[data-new-state]'), 'a pending expense keeps it Provisional').toContainText('Provisional');
  await expect(page.locator('[data-check="expense_pending"]')).toContainText('1 pending');
  await second.getByRole('button', { name: 'Remove expense' }).click();
  await expect(page.locator('[data-new-state]')).toContainText('Final');
  await expect(page.locator('[data-check="lines_match"]'), 'the lines add up to the total').toContainText(
    'Lines add up',
  );

  await page.locator('[data-save]').click();
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: `${number} saved` });
  await expect(toast, 'saving says so').toBeVisible();
  await expect(toast.getByRole('button', { name: 'Undo' }), 'saving offers Undo').toBeVisible();
  await expect(page).toHaveURL(/\/finance$/);

  const [saved] = await sql<{
    id: string;
    source: string;
    status_raw: string;
    total_sar: string;
    src: { _row?: string };
  }>(`select id, source, status_raw, total_sar, src from finance.invoice where ref = $1 and deleted_at is null`, [
    number,
  ]);
  expect(saved, 'the invoice is written').toBeTruthy();
  expect(saved?.source, 'a typed invoice is Typed').toBe('manual');
  expect(saved?.src?._row, 'and it is a person’s row').toBe('person');
  const lines = await sql(
    `select service_id, total_sar from finance.invoice_line where invoice_id = $1 and deleted_at is null`,
    [saved?.id],
  );
  expect(lines, 'one line, with its service').toHaveLength(1);
  expect(lines[0]?.service_id).toBeTruthy();
  expect(
    await sql(`select 1 from finance.expense_line where invoice_id = $1 and deleted_at is null`, [saved?.id]),
  ).toHaveLength(1);

  // the database agrees with the side panel: the month's revenue, cost and profit are what the form said
  await page.goto(`/finance?period=custom&from=${ym}-01&to=${ym}-28`);
  await hydrated(page);
  await expect(page.locator('[data-finance-tile="revenue"] [data-finance-exact]')).toContainText('1,000 SAR');
  await expect(page.locator('[data-finance-tile="profit"] [data-finance-figure]')).toContainText('400');

  // Undo takes every row back (the line's name is this run's own, so an earlier run's leftovers never count)
  const undoName = `Undo me ${number}`;
  await page.goto('/finance/new');
  await hydrated(page);
  await page.getByLabel('Transaction no.').fill(ref());
  await pick(page, 'Status', 'Draft');
  await page.getByLabel('Created').fill(`${ym}-15`);
  await page.locator('[data-add-line]').click();
  await page.locator('[data-line-row]').first().getByLabel('Item').fill(undoName);
  await page.locator('[data-line-row]').first().getByLabel('Price').fill('10');
  await page.locator('[data-save]').click();
  const undoable = page.locator('[data-sonner-toast]').filter({ hasText: 'saved' }).last();
  await undoable.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Undone' }), 'Undo says so').toBeVisible();
  await expect
    .poll(
      async () =>
        (await sql(`select 1 from finance.invoice_line l where l.name = $1 and l.deleted_at is null`, [undoName]))
          .length,
      {
        message: 'Undo takes the line and the invoice back',
      },
    )
    .toBe(0);
});

test('the same number twice is refused in its field, and an empty form says what is missing; nothing is written', async ({
  page,
}) => {
  const ym = await oldMonth();
  const number = ref();
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);
  await page.goto('/finance/new');
  await hydrated(page);

  await page.locator('[data-save]').click();
  await expect(page.locator('[id$="-error"]').first(), 'an empty form says what is missing').toContainText('Required');
  await expect(page.getByLabel('Transaction no.'), 'the first missing field is marked').toHaveAttribute(
    'aria-invalid',
    'true',
  );

  const fill = async () => {
    await page.getByLabel('Transaction no.').fill(number);
    await pick(page, 'Status', 'Draft');
    await page.getByLabel('Created').fill(`${ym}-10`);
  };
  await fill();
  await page.locator('[data-save]').click();
  await expect(page).toHaveURL(/\/finance$/);

  await page.goto('/finance/new');
  await hydrated(page);
  await fill();
  await page.locator('[data-save]').click();
  await expect(page.getByText('Already used'), 'the same number twice is refused in its field').toBeVisible();
  expect(
    await sql(`select 1 from finance.invoice where ref = $1 and deleted_at is null`, [number]),
    'the second write never happened',
  ).toHaveLength(1);
});

test('Commercial on a unit with no client opens Credit to, and saving writes the one-share credit (V613)', async ({
  page,
}) => {
  const ym = await oldMonth();
  const number = ref();
  const credited = await makePerson();
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);
  await page.goto('/finance/new');
  await hydrated(page);

  await page.getByLabel('Transaction no.').fill(number);
  await pick(page, 'Status', 'Draft');
  await page.getByLabel('Created').fill(`${ym}-10`);
  await expect(page.getByLabel('Credit to'), 'no channel, no Credit to').toHaveCount(0);
  await pick(page, 'Channel', 'Direct');
  await expect(page.getByLabel('Credit to'), 'only Commercial asks who is credited').toHaveCount(0);
  await pick(page, 'Channel', 'Commercial');
  await pick(page, 'Credit to', credited.name);
  await page.locator('[data-save]').click();
  await expect(page).toHaveURL(/\/finance$/);

  const [row] = await sql<{ person_id: string; share: string }>(
    `select s.person_id, s.share from finance.credit_split s join finance.invoice i on i.id = s.invoice_id
     where i.ref = $1 and s.deleted_at is null`,
    [number],
  );
  expect(row?.person_id, 'the picked person is credited').toBe(credited.id);
  expect(Number(row?.share), 'with one share').toBe(1);
});

test('a person without Full on Finance gets the no-access state, not the form', async ({ page }) => {
  const member = await makePerson();
  await signIn(page, member.email);
  await page.goto('/finance/new');
  await hydrated(page);
  await expect(page.locator('[data-new-invoice]'), 'a member never sees the form').toHaveCount(0);
  await expect(page.locator('[data-state="no-access"]')).toBeVisible();
});

test('phone 390: one column, nothing scrolls sideways, every target is 44 px, Save is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);
  await page.goto('/finance/new');
  await hydrated(page);
  await page.locator('[data-add-line]').click();
  await page.locator('[data-add-expense]').click();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide, 'nothing scrolls sideways').toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '[data-new-invoice] button, [data-new-invoice] input, [data-new-invoice] [role="combobox"]',
      ),
    ]
      .filter((el) => el.getClientRects().length && !el.closest('[hidden]'))
      .map((el) => ({
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName,
        h: el.getBoundingClientRect().height,
      }))
      .filter((x) => x.h < 43.5),
  );
  expect(small, 'every target is 44 px or more').toEqual([]);
  await expect(page.locator('[data-save]')).toBeVisible();
  const rows = await page.locator('[data-line-row]').first().boundingBox();
  expect(rows && rows.width, 'a line is a card the width of the phone').toBeLessThanOrEqual(390);
});
