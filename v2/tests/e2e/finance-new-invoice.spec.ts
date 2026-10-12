/**
 * New invoice (P4-4, GC-5; V617, V610, V611, V622; brief section F tests 5, 11, 12, 13; QA-547, QA-548): a person with
 * Full on Finance types an invoice, a line and expenses; Save writes the rows (typed, logged) and says so with an Undo
 * that takes every row back; the same number twice is refused in its field before anything is written; a person without
 * Full gets the no-access state; at 390 px nothing scrolls sideways and every target is 44 px.
 * The panel after Save + new, "Last saved", shows the database's own money row for the invoice — never a figure worked
 * out in the browser — and the spec seeds one of each case that tempts a screen to compute (a paid unit with and without
 * an approved cost, a product with no supplier cost, a wallet top-up, a customer an exclusion rule leaves out) and holds
 * the panel to the row. Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "new-invoice-skips-the-required-check", "new-invoice-saves-a-duplicate-number",
 * "new-invoice-undo-leaves-the-lines", "new-invoice-offers-a-fifth-kind", "new-invoice-panel-ignores-the-count",
 * "new-invoice-panel-says-final-for-all", "new-invoice-panel-works-out-its-own-cost", "new-invoice-undo-keeps-the-last-saved-panel".
 */
import { expect, test, type Page } from '@playwright/test';
import { oldMonth } from './support/finance-month';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const ref = () => `TX-8${Math.floor(Math.random() * 900000 + 100000)}`;
const tag = () => Math.random().toString(36).slice(2, 8);

async function pick(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

type Line = { product: string; item: string; qty: string; price: string };
type Case = {
  number: string;
  ym: string;
  kind?: 'Transaction' | 'Wallet top-up';
  status: string;
  customer?: string;
  total?: string;
  lines?: Line[];
  expenses?: { type: string; amount: string; status: string }[];
};

/** Types a case into the form and saves it with Save + new, so the panel shows what the database made of it. */
async function enter(page: Page, c: Case) {
  await page.goto('/finance/new');
  await hydrated(page);
  if (c.kind) await page.getByRole('radio', { name: c.kind, exact: true }).click();
  await page.getByLabel('Transaction no.').fill(c.number);
  await pick(page, 'Status', c.status);
  await page.getByLabel('Created').fill(`${c.ym}-10`);
  await page.getByLabel('Paid', { exact: true }).fill(`${c.ym}-12`);
  if (c.total) await page.getByRole('textbox', { name: 'Total', exact: true }).fill(c.total);
  if (c.customer) await page.getByLabel('Name', { exact: true }).fill(c.customer);
  for (const [i, l] of (c.lines ?? []).entries()) {
    await page.locator('[data-add-line]').click();
    const row = page.locator('[data-line-row]').nth(i);
    await row.getByLabel('Product').click();
    await page.getByRole('option', { name: l.product, exact: true }).click();
    await row.getByLabel('Item').fill(l.item);
    await row.getByLabel('Qty').fill(l.qty);
    await row.getByLabel('Price').fill(l.price);
  }
  for (const [i, e] of (c.expenses ?? []).entries()) {
    await page.locator('[data-add-expense]').click();
    const row = page.locator('[data-expense-row]').nth(i);
    await row.getByLabel('Type').fill(e.type);
    await row.getByLabel('Amount').fill(e.amount);
    await row.getByLabel('Status', { exact: true }).click();
    await page.getByRole('option', { name: e.status, exact: true }).click();
  }
  await page.locator('[data-save-new]').click();
  await expect(page.locator('[data-last-saved]'), `the panel names ${c.number}`).toContainText(c.number);
  await expect(page.locator('[data-last-saved] [data-state="loading"]')).toHaveCount(0);
}

const money = (n: number) =>
  new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** The database's own money row for an invoice, as the panel must show it. */
async function row(number: string) {
  const rows = await sql<{ counted: boolean; revenue: string; cost: string; profit: string; cost_is: string }>(
    `select r.counted, r.revenue, r.cost, r.profit,
            case when r.provisional then 'provisional' else 'final' end as cost_is
       from finance.money_row r where r.ref = $1`,
    [number],
  );
  return rows;
}

async function expectPanelIsTheRow(page: Page, number: string, what: string) {
  const rows = await row(number);
  const panel = page.locator('[data-last-saved]');
  if (rows.length === 0) {
    await expect(
      panel.locator('[data-last-none]'),
      `${what}: no money row, so the panel says it is in no figures`,
    ).toBeVisible();
    await expect(panel.locator('[data-last-unit]')).toHaveCount(0);
    return;
  }
  const r = rows[0]!;
  const unit = panel.locator('[data-last-unit]').first();
  await expect(unit, `${what}: counted as the database says`).toHaveAttribute('data-counted', String(r.counted));
  const shown = (k: string) => unit.locator(`[data-total="${k}"] dd`);
  const count = r.counted;
  await expect(shown('revenue'), `${what}: revenue is the database's`).toHaveText(money(count ? Number(r.revenue) : 0));
  await expect(shown('cost'), `${what}: cost is the database's`).toHaveText(money(count ? Number(r.cost) : 0));
  await expect(shown('profit'), `${what}: profit is the database's`).toHaveText(money(count ? Number(r.profit) : 0));
  const state = unit.locator('[data-last-state] > :first-child');
  await expect(state, `${what}: the state is the database's`).toContainText(
    !count ? 'Not counted' : r.cost_is === 'provisional' ? 'Provisional' : 'Final',
  );
  if (count && r.cost_is === 'provisional')
    await expect(unit.locator('[data-last-provisional]'), `${what}: Provisional sits beside Profit`).toContainText(
      money(Number(r.profit)),
    );
  else await expect(unit.locator('[data-last-provisional]')).toHaveCount(0);
}

test.describe.configure({ timeout: 180_000 });

test('desk 1440: the kinds offered, the panel is the database’s own row in each tempting case, a saved invoice has its rows', async ({
  page,
}) => {
  const ym = await oldMonth();
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email);
  await page.goto('/finance/new');
  await hydrated(page);

  // the kinds on offer: no Credit note (V423); no figure is worked out beside the form before it is saved
  await expect(page.locator('[data-kind]'), 'four kinds, no Credit note').toHaveCount(4);
  await expect(page.getByRole('radio', { name: 'Credit note' })).toHaveCount(0);
  await expect(page.getByText('Typed', { exact: true }), 'a new invoice is Typed').toBeVisible();
  await expect(page.locator('[data-last-saved]'), 'nothing is shown before a save').toHaveCount(0);
  // the channel is not a box here: it would be a second request, and one Undo must remove the whole invoice (QA-548)
  await expect(page.getByLabel('Channel')).toHaveCount(0);

  // a product on the no-supplier-cost list (V621): Final at cost 0
  const free = `Free ${tag()}`;
  await sql(
    `insert into finance.product (key, name_en, name_ar, word, no_supplier_cost, created_by)
     values ($1, $2, $3, $2, true, $4)`,
    [`free_${tag()}`, free, 'بلا تكلفة', admin.id],
  );
  // a customer the exclusion rules leave out (D16)
  const left = `Left Out ${tag()}`;
  const rule = await callAs(page.context(), 'finance_exclusion_rule_save', {
    p_id: null,
    p_fields: { kind: 'name', value: left, mode: 'exclude', reason: 'made up' },
  });
  expect(rule.status, JSON.stringify(rule.body)).toBe(200);

  const cases: [string, Case][] = [
    [
      'a paid unit with an approved cost is Final',
      {
        number: ref(),
        ym,
        status: 'Fully Paid',
        total: '1000',
        customer: 'Made Up Trading Co',
        lines: [{ product: 'Hotels', item: 'Rooms', qty: '2', price: '500' }],
        expenses: [{ type: 'Hotel', amount: '600', status: 'Approved' }],
      },
    ],
    [
      'a paid unit with no approved cost is Provisional',
      { number: ref(), ym, status: 'Fully Paid', total: '1000', customer: 'Made Up Travel House' },
    ],
    [
      'a pending cost does not count and keeps it Provisional',
      {
        number: ref(),
        ym,
        status: 'Fully Paid',
        total: '800',
        customer: 'Made Up Pending Co',
        expenses: [
          { type: 'Hotel', amount: '300', status: 'Approved' },
          { type: 'Flight', amount: '250', status: 'Pending' },
        ],
      },
    ],
    [
      'a product with no supplier cost is Final at cost 0',
      {
        number: ref(),
        ym,
        status: 'Fully Paid',
        total: '500',
        customer: 'Made Up Free Co',
        lines: [{ product: free, item: 'Service', qty: '1', price: '500' }],
      },
    ],
    [
      'a wallet top-up is in no total',
      { number: ref(), ym, kind: 'Wallet top-up', status: 'Fully Paid', customer: 'Made Up Wallet Co' },
    ],
    [
      'a customer the exclusion rules leave out is not counted',
      { number: ref(), ym, status: 'Fully Paid', total: '700', customer: left },
    ],
    [
      'an unpaid invoice is not counted',
      { number: ref(), ym, status: 'Draft', total: '900', customer: 'Made Up Draft Co' },
    ],
  ];
  for (const [what, c] of cases) {
    await enter(page, c);
    await expectPanelIsTheRow(page, c.number, what);
  }

  // the first case, saved with Save: one invoice, its line with a service (V483), its expense, all typed
  const number = ref();
  await page.goto('/finance/new');
  await hydrated(page);
  await page.getByLabel('Transaction no.').fill(number);
  await pick(page, 'Status', 'Fully Paid');
  await page.getByLabel('Created').fill(`${ym}-10`);
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill('1000');
  await page.locator('[data-add-line]').click();
  const line = page.locator('[data-line-row]').first();
  await line.getByLabel('Product').click();
  await page.getByRole('option', { name: 'Hotels', exact: true }).click();
  await expect(line.getByLabel('Service'), 'the service follows the product (V483)').toContainText('Hotels');
  await line.getByLabel('Item').fill('Hotel · 5 room nights');
  await line.getByLabel('Qty').fill('2');
  await line.getByLabel('Price').fill('500');
  await expect(line.locator('[data-line-total]'), 'a line works out qty × price').toHaveText('1,000.00');
  await page.locator('[data-save]').click();
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: `${number} saved` });
  await expect(toast, 'saving says so').toBeVisible();
  await expect(toast.getByRole('button', { name: 'Undo' }), 'saving offers Undo').toBeVisible();
  await expect(page).toHaveURL(/\/finance$/);
  const [saved] = await sql<{ id: string; source: string; src: { _row?: string } }>(
    `select id, source, src from finance.invoice where ref = $1 and deleted_at is null`,
    [number],
  );
  expect(saved?.source, 'a typed invoice is Typed').toBe('manual');
  expect(saved?.src?._row, 'and it is a person’s row').toBe('person');
  const lines = await sql(`select service_id from finance.invoice_line where invoice_id = $1 and deleted_at is null`, [
    saved?.id,
  ]);
  expect(lines, 'one line, with its service').toHaveLength(1);
  expect(lines[0]?.service_id).toBeTruthy();

  // Save + new, then Undo that invoice: the panel stops printing its figures (QA-551)
  const gone = ref();
  await enter(page, { number: gone, ym, status: 'Fully Paid', total: '300', customer: 'Made Up Undone Co' });
  const lastToast = page.locator('[data-sonner-toast]').filter({ hasText: `${gone} saved` });
  await lastToast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Undone' }).last()).toBeVisible();
  await expect(page.locator('[data-last-saved]'), 'an undone invoice is no longer shown as last saved').toHaveCount(0);

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
