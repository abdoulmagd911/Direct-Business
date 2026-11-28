/**
 * Landing 37 (Finance F-C) in the browser: a Pending or Draft invoice is seen, and found, before it counts.
 *  1. End to end, as the owner's check on a 100 SAR Pending invoice: typed in the New invoice form and saved, the
 *     form shows it as the last saved record (transaction number, status, created, paid, total) — and shows it again
 *     when the form is opened again, never a blank page. The Ledger lists it under "Not yet counted" with its amount
 *     and what is left; Revenue on the strip and on the page's card, and every other figure, are unchanged (delta 0).
 *     The top search finds it by its number and opens the Ledger at that list. Once it is paid, Revenue rises by
 *     exactly its 100 and it leaves the list. How long the save took is written to the report.
 *  2. A Draft invoice of nobody known is found by the top search too (it said "Nothing matches" before).
 *  3. The organisation's Finance tab: the Pending invoice is named in "Not yet counted"; the tab's cards are unchanged.
 *  4. CR-1594-23: the "Custom" period tab opens its From / To panel on the FIRST press — while the server's answer
 *     to the new address is still held back.
 *  5. On a phone (375 px) the list fits: nothing scrolls sideways, the Direct link is a full-size tap.
 *  6. The speed gate: the Finance reads answer in under 3 s, in total, for every role; no role, no read.
 * Page-wide figures are read only inside a far-past month no other spec uses, and compared as differences. Every
 * value is made up. Sabotage: tests/sabotage/landing-37-e2e.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled, openFinanceTab } from './support/finance-blocks';
import {
  hydrated,
  num,
  ownMonth,
  personAs,
  rowNo,
  seedImported,
  seedOrg,
  signedInAdmin,
  signedInAs,
  today,
} from './support/landing-32';
import { PHONE, sideways } from './support/landing-34';
import { callAs, sql } from './support/stack';

// the far-past months are each one test's alone; the tests take turns so one never reads another's month half-seeded
test.describe.configure({ mode: 'default' });

async function openFinance(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
  await blocksSettled(page);
  // Landing 58: the ledger is under its own tab
  await openFinanceTab(page, 'Ledger');
  await expect(page.locator('[data-finance-report]'), 'the Ledger has answered').toBeVisible({ timeout: 45_000 });
}
const strip = (page: Page, kind: string) => page.locator(`[data-finance-ledger-total="${kind}"] > span`).nth(1);
const stripNumber = async (page: Page, kind: string) => num(await strip(page, kind).innerText());
async function tileNumber(page: Page, kind: string) {
  const tile = page.locator(`[data-finance-tile="${kind}"]`);
  const exact = tile.locator('[data-finance-exact]');
  return num(await ((await exact.count()) ? exact : tile.locator('[data-finance-figure]')).innerText());
}
const waitingRow = (page: Page, number: string) =>
  page.locator(`[data-ledger-not-yet-counted] [data-ledger-not-yet-counted-row][data-number="${number}"]`);
const countedRow = (page: Page, number: string) =>
  page.locator('[data-finance-ledger-row]').filter({ hasText: number });
const savedFact = (page: Page, k: string) => page.locator(`[data-last-saved-record] [data-saved-fact="${k}"] dd`);

async function pick(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** An imported row of one organisation that is NOT confirmed paid, with its Direct link. */
async function seedImportedUnpaid(partnerId: string, byId: string, day: string, number: string, amount: number) {
  const batch = randomUUID();
  await sql(
    `insert into work.import_batch (id, partner_id, signature, file_name, created_by)
     values ($1, $2, 'invoice_export', 'made-up-l37.csv', $3)`,
    [batch, partnerId, byId],
  );
  await sql(
    `insert into work.import_record
       (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid,
        status_text, direct_url, created_by)
     values ($1, $2, 'transaction', $3, null, $4, $5, $5, false, 'Waiting for Issuing', $6, $7)`,
    [partnerId, batch, number, day, amount, `https://example.invalid/t/${number}`, byId],
  );
}

test('1 · a 100 SAR Pending invoice, end to end: saved, shown as last saved, listed as not yet counted, found by search — and no total moves until it is paid', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1961-03');
  const org = await seedOrg(call, 'Pending');
  const paid = rowNo();
  await seedImported(org.id, admin.id, month.mid, [{ number: paid, revenue: 700, cost: 200 }]);

  // before: the figures of the month, as they stand
  await openFinance(page, month.url);
  const before = {
    revenue: await stripNumber(page, 'revenue'),
    cost: await stripNumber(page, 'cost'),
    profit: await stripNumber(page, 'profit'),
    received: await stripNumber(page, 'received'),
    remaining: await stripNumber(page, 'remaining'),
    tile: await tileNumber(page, 'revenue'),
    rows: await page.locator('[data-finance-ledger-row]').count(),
  };

  // typed in the form: Pending, 100, the organisation's client ID, dated inside the month
  const number = rowNo();
  await page.goto('/finance/new');
  await hydrated(page);
  await page.getByLabel('Transaction no.').fill(number);
  await pick(page, 'Status', 'Pending');
  await page.getByLabel('Created').fill(month.mid);
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill('100');
  await page.getByLabel('Client ID', { exact: true }).fill(org.cid);
  const t0 = Date.now();
  await page.locator('[data-save-new]').click();
  const record = page.locator('[data-last-saved-record]');
  await expect(record, 'after the save the form shows the saved record').toHaveAttribute('data-ref', number, {
    timeout: 30_000,
  });
  const saveMs = Date.now() - t0;
  console.log(`[l37] invoice ${number} · saved and read back in ${saveMs} ms`);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/l37-pending.json', JSON.stringify({ number, save_ms: saveMs, month: month.from }));
  await expect(savedFact(page, 'transaction'), 'its transaction number').toHaveText(number);
  await expect(savedFact(page, 'status'), 'its status').toHaveText('Pending');
  await expect(savedFact(page, 'created'), 'its created day').toHaveText('15 Mar 1961');
  await expect(savedFact(page, 'paid'), 'no paid day: a dash').toHaveText('—');
  await expect(savedFact(page, 'total'), 'its total').toHaveText('100.00');
  await expect(record, 'it says it is not counted until paid').toContainText('Not counted until it is paid');
  await expect(page.getByLabel('Transaction no.'), 'the fields are ready for the next one').toHaveValue('');

  // the form opened again: the saved record, not a blank page
  await page.goto('/finance/new');
  await hydrated(page);
  await expect(record, 'reopening the form shows the saved record').toHaveAttribute('data-ref', number, {
    timeout: 30_000,
  });
  await expect(savedFact(page, 'total'), 'reopened: its total').toHaveText('100.00');
  await expect(savedFact(page, 'status'), 'reopened: its status').toHaveText('Pending');

  // the Ledger: listed as not yet counted; no figure moved
  await openFinance(page, month.url);
  const row = waitingRow(page, number);
  await expect(row, 'the Pending invoice is a row under Not yet counted').toHaveCount(1);
  await expect(row.locator('[data-ledger-not-yet-counted-amount]'), 'its amount, as not yet counted').toContainText(
    '100',
  );
  await expect(row.locator('[data-ledger-not-yet-counted-remaining]'), 'what is left on it').toContainText('100');
  await expect(row.locator('[data-ledger-not-yet-counted-status]'), 'its status word').toContainText('Pending');
  await expect(row.locator('a[data-entity="partner"]'), 'its organisation').toContainText(org.name);
  await expect(countedRow(page, number), 'it is not among the counted rows').toHaveCount(0);
  expect((await stripNumber(page, 'revenue')) - before.revenue, 'Revenue: after minus before').toBe(0);
  expect((await stripNumber(page, 'cost')) - before.cost, 'Cost: after minus before').toBe(0);
  expect((await stripNumber(page, 'profit')) - before.profit, 'Profit: after minus before').toBe(0);
  expect((await stripNumber(page, 'received')) - before.received, 'Received: after minus before').toBe(0);
  expect((await stripNumber(page, 'remaining')) - before.remaining, 'Remaining: after minus before').toBe(0);
  expect((await tileNumber(page, 'revenue')) - before.tile, 'the top Revenue card: after minus before').toBe(0);
  expect(await page.locator('[data-finance-ledger-row]').count(), 'the counted rows are the same rows').toBe(
    before.rows,
  );

  // the top search finds it by its number, says it is not counted yet, and opens the Ledger at that list
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await palette.getByRole('combobox').fill(number);
  const hit = palette.locator(`[data-palette-invoice="${number}"]`);
  await expect(hit, 'the search finds the invoice by its number').toBeVisible();
  await expect(hit, 'and says it is not counted yet').toContainText('Not counted yet');
  await expect(palette, 'not the empty state').not.toContainText('Nothing matches');
  await hit.click();
  await expect(page, 'the hit opens the Ledger on the invoice’s own day').toHaveURL(
    new RegExp(`/finance\\?period=custom&from=${month.mid}&to=${month.mid}#finance-ledger-waiting$`),
  );
  await hydrated(page);
  await expect(waitingRow(page, number), 'and the invoice is on the screen').toBeVisible({ timeout: 45_000 });

  // paid: Revenue rises by exactly its 100, and it leaves the list
  const [inv] = await sql<{ id: string; version: number }>(`select id, version from finance.invoice where ref = $1`, [
    number,
  ]);
  await call('finance_row_edit', {
    p_table: 'invoice',
    p_id: inv!.id,
    p_fields: { status: 'Fully Paid' },
    p_version: inv!.version,
    p_reason: 'made up e2e: paid',
  });
  await openFinance(page, month.url);
  expect((await stripNumber(page, 'revenue')) - before.revenue, 'once paid, Revenue rises by exactly 100').toBe(100);
  await expect(waitingRow(page, number), 'once paid it no longer waits').toHaveCount(0);
  await expect(countedRow(page, number), 'it is a counted row now').toHaveCount(1);
});

test('2 · a Draft invoice of nobody known is found by the top search, by its number', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call } = await signedInAdmin(page);
  const month = await ownMonth('1961-04');
  const number = `MADEUP-${rowNo()}-01`;
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: number,
      kind: 'transaction',
      status: 'Draft',
      created_on: month.mid,
      total_sar: 100,
      customer_name: 'Made Up New Company',
    },
    p_reason: 'made up e2e',
  });
  await page.goto('/my-day');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await palette.getByRole('combobox').fill(number);
  const hit = palette.locator(`[data-palette-invoice="${number}"]`);
  await expect(hit, 'a Draft invoice is found by its number').toBeVisible();
  await expect(hit).toContainText('Made Up New Company');
  await expect(hit, 'it is not counted yet').toContainText('Not counted yet');
  await hit.click();
  await hydrated(page);
  const row = waitingRow(page, number);
  await expect(row, 'the Ledger lists the Draft as not yet counted').toBeVisible({ timeout: 45_000 });
  await expect(row.locator('[data-ledger-not-yet-counted-status]')).toContainText('Draft');
  await expect(row, 'with no organisation: nobody known').toContainText('No partner');
});

test('3 · the organisation’s Finance tab names a Pending invoice in Not yet counted, and its cards do not move', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Tab Pending');
  const d = today();
  await seedImported(org.id, admin.id, d, [{ number: rowNo(), revenue: 900, cost: 300 }]);
  const tab = `/partners/${org.id}?tab=finance`;
  const tiles = async () => {
    const all = page.locator('[data-partner-finance-totals] [data-kpi-tile]');
    await expect(all.first()).toBeVisible({ timeout: 45_000 });
    return all.allInnerTexts();
  };
  await page.goto(tab);
  await hydrated(page);
  const before = await tiles();
  await expect(
    page.locator('[data-partner-finance-not-counted]'),
    'with nothing waiting the tab says everything is counted',
  ).toContainText('Everything is counted');

  const number = rowNo();
  const imported = rowNo();
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: number,
      kind: 'transaction',
      status: 'Pending',
      created_on: d,
      total_sar: 100,
      client_id: org.cid,
    },
    p_reason: 'made up e2e',
  });
  await seedImportedUnpaid(org.id, admin.id, d, imported, 300);
  await page.goto(tab);
  await hydrated(page);
  const mine = page.locator(`[data-partner-finance-waiting-row="${number}"]`);
  await expect(mine, 'the Pending invoice is named on the tab').toBeVisible({ timeout: 45_000 });
  await expect(mine).toContainText('Pending');
  await expect(mine.locator('[data-partner-finance-waiting-amount]')).toContainText('100');
  await expect(
    page.locator(`[data-partner-finance-waiting-row="${imported}"]`),
    'and the imported row that is not paid',
  ).toBeVisible();
  expect(await tiles(), 'the tab’s cards: the same with the Pending invoice as before it').toEqual(before);
  await expect(
    page.locator('[data-partner-finance-not-counted]'),
    'the tab no longer says everything is counted',
  ).not.toContainText('Everything is counted');
  await expect(
    page.locator('[data-partner-finance-row]').filter({ hasText: number }),
    'it is not among the tab’s counted rows',
  ).toHaveCount(0);

  // the Finance page lists the imported one with its Direct link
  await openFinance(page, `/finance?period=custom&from=${d}&to=${d}&company=${org.id}`);
  const link = waitingRow(page, imported).locator('[data-ledger-direct-link]');
  await expect(link, 'the imported row carries its Direct link').toHaveAttribute(
    'href',
    `https://example.invalid/t/${imported}`,
  );
});

test('4 · CR-1594-23: the Custom period opens its From / To panel on the first press', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signedInAdmin(page);
  await page.goto('/finance?period=ytd');
  await hydrated(page);
  await blocksSettled(page);
  const custom = page.locator('[data-finance-period-key="custom"]');
  const panel = page.locator('[data-finance-custom-panel]');
  await expect(panel, 'closed on Year to date').toHaveCount(0);
  // the server's answer to the new address is held back, as a slow read would hold it
  let held = 0;
  await page.route(
    (url) => url.pathname === '/finance' && url.searchParams.get('period') === 'custom',
    async (route) => {
      held += 1;
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    },
  );
  const t0 = Date.now();
  await custom.click();
  await expect(panel, 'the first press opens the From / To panel, before the server answers').toBeVisible({
    timeout: 2000,
  });
  const openedMs = Date.now() - t0;
  console.log(`[l37] Custom · panel open ${openedMs} ms after one press (the answer was held 4000 ms)`);
  await expect(custom, 'Custom is the lit tab at once').toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-finance-from]'), 'From is there').toBeVisible();
  await expect(page.locator('[data-finance-to]'), 'To is there').toBeVisible();
  expect(held, 'the address was asked for — and was still on its way').toBeGreaterThan(0);
  // once the answer lands the address says Custom and the panel is still open: one press was enough
  await expect(page).toHaveURL(/period=custom/, { timeout: 30_000 });
  await blocksSettled(page);
  await expect(panel, 'still open once the page has answered').toBeVisible();
  await page.unroute((url) => url.pathname === '/finance' && url.searchParams.get('period') === 'custom');
  // and back to Year to date closes it at once
  await page.locator('[data-finance-period-key="ytd"]').click();
  await expect(panel, 'another tab closes the panel').toHaveCount(0);
});

test('5 · on a phone the not-yet-counted list fits: nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1961-05');
  const org = await seedOrg(call, 'Phone Pending With A Long Trade Name For The Narrow Screen');
  await seedImported(org.id, admin.id, month.mid, [{ number: rowNo(), revenue: 500, cost: null }]);
  const imported = rowNo();
  await seedImportedUnpaid(org.id, admin.id, month.mid, imported, 300);
  const numbers: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const number = rowNo();
    numbers.push(number);
    await call('finance_row_add', {
      p_table: 'invoice',
      p_fields: {
        ref: number,
        kind: 'transaction',
        status: i % 2 ? 'Draft' : 'Pending',
        created_on: month.mid,
        total_sar: 100 + i,
        client_id: org.cid,
      },
      p_reason: 'made up e2e',
    });
  }
  await page.setViewportSize(PHONE);
  // this run's organisation only: an earlier run on the same database left its own waiting rows in the month
  await page.goto(`${month.url}&company=${org.id}#finance-ledger-waiting`);
  await hydrated(page);
  const list = page.locator('[data-ledger-not-yet-counted]');
  await expect(list, 'the list is drawn on a phone').toBeVisible({ timeout: 45_000 });
  expect(await sideways(page), 'nothing scrolls sideways').toBeLessThanOrEqual(0);
  const shown = list.locator('[data-ledger-not-yet-counted-row]:visible');
  await expect(shown, 'a phone lists the first five').toHaveCount(5);
  await list.locator('[data-ledger-not-yet-counted-see-all]').click();
  await expect(shown, 'See all lists the eight').toHaveCount(8);
  expect(await sideways(page), 'still nothing scrolls sideways').toBeLessThanOrEqual(0);
  const link = waitingRow(page, imported).locator('[data-ledger-direct-link]');
  const box = await link.boundingBox();
  expect(box!.height, 'the Direct link is a full-size tap on a phone').toBeGreaterThanOrEqual(44);
  const small = await list.evaluate(
    (el) =>
      [...el.querySelectorAll('*')].filter(
        (n) =>
          n.children.length === 0 &&
          (n.textContent ?? '').trim() !== '' &&
          parseFloat(getComputedStyle(n).fontSize) < 12,
      ).length,
  );
  expect(small, 'no word under 12 px').toBe(0);
});

test('6 · the speed gate: the Finance reads answer in under 3 s in total for every role; no role, no read', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const d = today();
  const year = { p_from: `${d.slice(0, 4)}-01-01`, p_to: d };
  const READS: [string, Record<string, unknown>][] = [
    ['finance_unified_ledger', year],
    ['finance_period', year],
    ['finance_counted_by_month', year],
    ['finance_search', { p_text: '9932', p_limit: 8 }],
  ];
  const out: Record<string, Record<string, number | string>> = {};
  for (const role of ['admin', 'head', 'manager', 'member', 'viewer', 'none'] as const) {
    const person = await personAs(role);
    const who = await signedInAs(browser, person);
    try {
      out[role] = {};
      let total = 0;
      for (const [fn, args] of READS) {
        const t0 = Date.now();
        const r = await callAs(who.context, fn, args);
        const ms = Date.now() - t0;
        if (role === 'none') {
          expect(r.status, `${fn}: a person with no role is refused, not answered`).toBe(403);
          expect((r.body as { message?: string }).message, `${fn}: the refusal names the missing level`).toBe(
            'access.needs_level',
          );
          out[role]![fn] = `refused (${r.status})`;
        } else {
          expect(r.status, `${fn} as ${role}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
          if (fn === 'finance_unified_ledger')
            expect(
              Array.isArray((r.body as { not_yet_counted?: unknown }).not_yet_counted),
              `the Ledger answers its not-yet-counted list to ${role}`,
            ).toBe(true);
          total += ms;
          out[role]![fn] = ms;
        }
      }
      if (role !== 'none') {
        expect(total, `the Finance reads as ${role} took ${total} ms in total`).toBeLessThan(3000);
        out[role]!.total = total;
      }
      // the form's last-saved read is for Full on Finance: a viewer (View) and a person with no role are refused
      const last = await callAs(who.context, 'finance_last_saved', {});
      if (role === 'viewer' || role === 'none') expect(last.status, `finance_last_saved as ${role}: refused`).toBe(403);
      else expect(last.status, `finance_last_saved as ${role}`).toBe(200);
      console.log(`[l37-speed] ${role} · ${JSON.stringify(out[role])}`);
    } finally {
      await who.context.close();
    }
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/l37-speed.json', JSON.stringify({ period: year, limit_ms: 3000, roles: out }, null, 2));
});
