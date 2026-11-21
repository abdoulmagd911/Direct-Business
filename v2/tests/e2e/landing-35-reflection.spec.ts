/**
 * Landing 35 · the owner's check of 21 Nov, in his words: "Once the partner Finance tab loads, verify the reflection:
 * edit finance details on a client page and confirm it shows on Finance; add an achievement and confirm it shows on
 * the client and on Finance."
 *
 * What the app as built offers, and what each test holds it to:
 *  1. The one finance detail a person edits ON a client page is its Client ID (Overview → Identifiers → Add
 *     identifier → Client ID). It is what ties Payments rows to the organisation, so the test adds it through the real
 *     dialog and reads the result in both places: the client's Finance tab (which must LOAD — ready, no failure words)
 *     and the Finance page (the Ledger row, the organisation's line under Income by company, the month's Revenue card).
 *     Then the other way round: an invoice typed on Finance → New invoice under that Client ID shows on the client's
 *     Finance tab, and the tab's totals equal the Finance page's line for the organisation, difference 0.
 *  2. An achievement logged through Log achievement, naming the client: it is saved with the organisation, its own
 *     record links to the client's page, the Achievements list has it — and the client's record lists it on its
 *     Related tab (number and title), the title opening the achievement's own record (built on 21 Nov, after this
 *     test first wrote down that the record showed it nowhere).
 *     Finance shows no achievement anywhere — neither the client's Finance tab nor the Finance page: an achievement's
 *     value is "Not revenue" by rule, so no figure may count it. The test holds that too; the day Finance starts
 *     showing achievements it goes red and is rewritten to hold the new behaviour.
 * Every value is made up. Sabotage: tests/sabotage/landing-35-reflection.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { ensureAchievementPlan } from './support/achievement-plan';
import { blocksSettled } from './support/finance-blocks';
import { oldMonth } from './support/finance-month';
import { hydrated, num, signedInAdmin, tag, today, type Door } from './support/landing-32';
import { sql } from './support/stack';

test.describe.configure({ timeout: 240_000 });
test.beforeAll(ensureAchievementPlan);

/** A made-up client ID: 9935 and five more digits. */
const clientId = () => `9935${Math.floor(Math.random() * 90000 + 10000)}`;
/** A made-up transaction number. */
const ref = () => `TX-R${Math.floor(Math.random() * 900000 + 100000)}`;
/** The words a block says when its read failed ("… could not be loaded"). */
const FAILURE = /could not be loaded|Something went wrong|Try again/i;

/** A made-up client with NO client ID yet. */
async function seedClient(call: Door, words: string) {
  const name = `Made Up ${words} Org ${tag()}`;
  const p = await call('partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  return { id: p.id!, name };
}

/** The client's Finance tab, opened and answered. */
async function openClientFinance(page: Page, partnerId: string) {
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  const tab = page.locator('[data-partner-finance]');
  await expect(tab, 'the Finance tab is drawn').toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-partner-finance-ledger]'), 'the tab ledger has answered').toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 45_000 },
  );
  await expect(tab.locator('[data-state="loading"]'), 'nothing on the tab is left on Loading').toHaveCount(0, {
    timeout: 45_000,
  });
  await expect(tab.locator('[data-state="failed"]'), 'no block of the tab failed').toHaveCount(0);
  await expect(tab, 'the tab says no failure words').not.toContainText(FAILURE);
  return tab;
}

/** The four cards of the client's Finance tab: Revenue, Cost, Profit, Bookings. */
async function tabTotals(page: Page) {
  const tiles = page.locator('[data-partner-finance-totals] [data-kpi-tile]');
  await expect(tiles, 'Revenue, Cost, Profit and Bookings').toHaveCount(4);
  const text = (i: number) => tiles.nth(i).locator('> div').nth(1).innerText();
  return { revenue: num(await text(0)), cost: await text(1), profit: await text(2), units: num(await text(3)) };
}

/** The Finance page for a period (and, when asked, one organisation), every block answered. */
async function openFinance(page: Page, from: string, to: string, partnerId = '') {
  await page.goto(`/finance?period=custom&from=${from}&to=${to}${partnerId ? `&company=${partnerId}` : ''}`);
  await hydrated(page);
  await blocksSettled(page);
  await expect(page.locator('[data-finance-report]'), 'the Ledger has answered').toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-finance-overview] [data-state="failed"]'), 'no Finance block failed').toHaveCount(0);
}

/** One figure of the Ledger's strip ("Totals for this view"). */
const strip = async (page: Page, kind: string) =>
  num(await page.locator(`[data-finance-ledger-total="${kind}"] > span`).nth(1).innerText());
/** One of the Finance page's top cards, in exact riyals. */
async function tileNumber(page: Page, kind: string) {
  const tile = page.locator(`[data-finance-tile="${kind}"]`);
  const exact = tile.locator('[data-finance-exact]');
  return num(await ((await exact.count()) ? exact : tile.locator('[data-finance-figure]')).innerText());
}
/** The organisation's line under Income by company. */
const partnerLine = (page: Page, partnerId: string) =>
  page.locator(`[data-finance-ledger-companies] tbody tr:has(a[href="/partners/${partnerId}"])`);
const ledgerRow = (page: Page, number: string) => page.locator('[data-finance-ledger-row]').filter({ hasText: number });

/** Finance → New invoice, typed by hand and saved. */
async function typeInvoice(
  page: Page,
  v: { number: string; day: string; total: string; clientId: string; cost?: string },
) {
  await page.goto('/finance/new');
  await hydrated(page);
  await page.getByLabel('Transaction no.').fill(v.number);
  await page.getByLabel('Status', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Fully Paid', exact: true }).click();
  await page.getByLabel('Created').fill(v.day);
  await page.getByLabel('Paid', { exact: true }).fill(v.day);
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill(v.total);
  await page.getByLabel('Client ID', { exact: true }).fill(v.clientId);
  if (v.cost) {
    await page.locator('[data-add-expense]').click();
    const row = page.locator('[data-expense-row]').first();
    await row.getByLabel('Type').fill('Hotel');
    await row.getByLabel('Amount').fill(v.cost);
    await row.getByLabel('Status', { exact: true }).click();
    await page.getByRole('option', { name: 'Approved', exact: true }).click();
  }
  await page.locator('[data-save-new]').click();
  await expect(page.locator('[data-last-saved]'), `the invoice ${v.number} is saved`).toContainText(v.number);
  await expect(page.locator('[data-last-saved] [data-state="loading"]')).toHaveCount(0);
}

test('1 · a Client ID added on the client page shows on Finance, and an invoice typed on Finance shows on the client: the two agree, difference 0', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call } = await signedInAdmin(page);
  const org = await seedClient(call, 'Reflect');
  const cid = clientId();
  const d = today();
  const yearStart = `${d.slice(0, 4)}-01-01`;
  const ym = await oldMonth('e2e_l35_reflection_month');
  const [a, b, c] = [ref(), ref(), ref()];

  // ---- before: the tab LOADS for a client with nothing yet — ready, empty, no failure words
  const tab = await openClientFinance(page, org.id);
  await expect(page.locator('[data-partner-finance-row]'), 'no money row yet').toHaveCount(0);
  await expect(page.locator('[data-partner-finance-ids]'), 'no client ID yet').toContainText(
    'No client IDs on this partner yet',
  );

  // ---- Payments rows under a client ID no organisation carries yet: one this year (typed on Finance → New invoice),
  // one in a far-past month that is this test's alone
  await typeInvoice(page, { number: a, day: d, total: '1250', clientId: cid, cost: '450' });
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: c,
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: `${ym}-10`,
      paid_on: `${ym}-12`,
      total_sar: 640,
      client_id: cid,
    },
    p_reason: 'made up',
  });
  // Finance counts them already, under no organisation; the client's tab has nothing
  await openFinance(page, `${ym}-01`, `${ym}-28`);
  expect(await tileNumber(page, 'revenue'), 'the month’s Revenue card is the one row').toBe(640);
  await expect(partnerLine(page, org.id), 'no line for the organisation before its Client ID').toHaveCount(0);
  await openClientFinance(page, org.id);
  await expect(page.locator('[data-partner-finance-row]'), 'still no money row on the client').toHaveCount(0);

  // ---- the finance edit ON the client page: Overview → Add identifier → Client ID
  await page.goto(`/partners/${org.id}`);
  await hydrated(page);
  await page.locator('[data-identifier-add]').click();
  const dialog = page.getByRole('dialog', { name: 'Add identifier' });
  await dialog.getByLabel('Kind', { exact: true }).click();
  await page.getByRole('option', { name: 'Client ID', exact: true }).click();
  await dialog.getByLabel('Kind of client', { exact: true }).click();
  await page.getByRole('option', { name: 'Postpaid', exact: true }).click();
  await dialog.getByLabel('Value', { exact: true }).fill(cid);
  await dialog.getByLabel('Reason', { exact: true }).fill('made up: the client’s own ID');
  await dialog.locator('[data-identifier-save]').click();
  await expect(dialog, 'the box closes once saved').toHaveCount(0);
  await expect(
    page.locator('[data-identifier]').filter({ hasText: cid }),
    'the Client ID is on the client',
  ).toHaveCount(1);

  // ---- it shows on the client's Finance tab …
  await openClientFinance(page, org.id);
  await expect(tab.locator('[data-partner-finance-ids]'), 'the tab lists the Client ID').toContainText(cid);
  const rows = page.locator('[data-partner-finance-row]');
  await expect(rows, 'this year’s row is on the client now').toHaveCount(1);
  await expect(rows.first(), 'it is the invoice typed on Finance').toContainText(a);
  let totals = await tabTotals(page);
  expect(totals.revenue, 'the tab’s Revenue is the row').toBe(1250);
  expect(num(totals.cost), 'the tab’s Cost is the approved expense').toBe(450);
  expect(num(totals.profit), 'the tab’s Profit is revenue minus cost').toBe(800);
  expect(totals.units, 'one booking').toBe(1);

  // ---- … and on Finance: the Ledger for the organisation, its line under Income by company, the same figures
  await openFinance(page, yearStart, d, org.id);
  await expect(ledgerRow(page, a), 'the Ledger lists the row under the organisation').toHaveCount(1);
  await expect(page.locator('[data-finance-ledger-row]'), 'and only the organisation’s row').toHaveCount(1);
  expect(await strip(page, 'revenue'), 'the Ledger’s Revenue for the organisation').toBe(1250);
  expect(await strip(page, 'cost'), 'the Ledger’s Cost for the organisation').toBe(450);
  expect(await strip(page, 'profit'), 'the Ledger’s Profit for the organisation').toBe(800);
  await expect(partnerLine(page, org.id), 'Income by company has the organisation’s line').toHaveCount(1);
  await expect(partnerLine(page, org.id), 'the line carries the revenue').toContainText('1,250');
  // the far-past month: the same Revenue card, now wholly on the organisation's line
  await openFinance(page, `${ym}-01`, `${ym}-28`);
  expect(await tileNumber(page, 'revenue'), 'the month’s Revenue card is unchanged by the link').toBe(640);
  await expect(partnerLine(page, org.id), 'the month’s row is on the organisation’s line now').toHaveCount(1);
  await expect(partnerLine(page, org.id), 'the line is the whole card').toContainText('640');

  // ---- the other way round: a second invoice typed on Finance under the Client ID shows on the client
  await typeInvoice(page, { number: b, day: d, total: '800', clientId: cid });
  await openClientFinance(page, org.id);
  await expect(rows, 'two rows on the client').toHaveCount(2);
  await expect(rows.filter({ hasText: b }), 'the new invoice is listed').toHaveCount(1);
  totals = await tabTotals(page);
  expect(totals.revenue, 'the tab’s Revenue is both rows').toBe(2050);
  expect(num(totals.cost), 'Cost is still the one approved expense').toBe(450);
  expect(num(totals.profit), 'Profit is still the one costed row').toBe(800);
  expect(totals.units, 'two bookings').toBe(2);
  await expect(page.locator('[data-partner-finance-totals]'), 'the row with no cost is said').toContainText(
    '1 row still has no cost',
  );

  // ---- the client's tab equals the Finance page's line for the client, difference 0
  await openFinance(page, yearStart, d, org.id);
  expect((await strip(page, 'revenue')) - totals.revenue, 'revenue: Finance minus the client’s tab').toBe(0);
  expect((await strip(page, 'cost')) - num(totals.cost), 'cost: Finance minus the client’s tab').toBe(0);
  expect((await strip(page, 'profit')) - num(totals.profit), 'profit: Finance minus the client’s tab').toBe(0);
  await expect(partnerLine(page, org.id), 'the organisation’s line is both rows').toContainText('2,050');
  await expect(page.locator('[data-finance-ledger-row]'), 'the Ledger lists both rows').toHaveCount(2);
});

test('2 · an achievement logged for a client is saved with the client, links to it and is listed on the client’s Related tab; Finance shows no achievement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call } = await signedInAdmin(page);
  const org = await seedClient(call, 'Achieve');
  const title = `Made-up travel award ${tag()}`;
  const d = today();

  // ---- the achievement, through the real form, naming the client
  await page.goto('/kpis/achievements/new');
  await hydrated(page);
  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Awards' }).click();
  await page.getByLabel('What').fill(title);
  await page.locator('[data-partner-search]').fill(org.name);
  await page.locator('[data-partner-hits]').getByRole('option', { name: org.name }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('dialog', { name: 'Achievement logged' }).locator('[data-saved-same]').click();
  await expect(page).toHaveURL(/\/kpis\/achievements\/[0-9a-f-]{36}/);
  const achievementPath = new URL(page.url()).pathname;
  const number = (await page.locator('[data-record-header]').innerText()).match(/ACH-\d{4}-\d{4,}/)?.[0] ?? '';
  expect(number, 'the record shows its number').toBeTruthy();

  // ---- what IS reflected: it is saved with the client, its record names the client and leads to the client's page,
  // and the Achievements list has it
  const [saved] = await sql<{ partner_id: string | null }>(
    `select partner_id from perf.achievement where title = $1 and deleted_at is null`,
    [title],
  );
  expect(saved?.partner_id, 'the achievement is saved with the client').toBe(org.id);
  const link = page.locator('[data-achievement-organisation]:visible').first();
  await expect(link, 'the record names the client').toHaveText(org.name);
  await expect(link, 'and links to the client’s page').toHaveAttribute('href', `/partners/${org.id}`);
  await page.goto('/kpis/achievements?mine=1');
  await hydrated(page);
  await expect(
    page.locator('[data-achievement-row]').filter({ hasText: title }),
    'the Achievements list has it',
  ).toHaveCount(1);

  // ---- on the client: the record's Related tab lists the achievement (its number and its title), with who logged
  // it and no amount, and the title opens the achievement's own record
  const main = page.locator('main');
  const shows = (text: string) => text.includes(title) || text.includes(number);
  await page.goto(`/partners/${org.id}?tab=related`);
  await hydrated(page);
  const listed = page.locator('[data-partner-achievements]');
  await expect(listed, 'the client’s Related tab has its Achievements section').toBeVisible({ timeout: 45_000 });
  await expect(listed, 'the section has answered').toHaveAttribute('data-partner-achievements-state', 'ready', {
    timeout: 45_000,
  });
  const row = listed.locator(`[data-partner-achievement="${number}"]`);
  await expect(row, 'the client’s Related tab lists the achievement').toHaveCount(1);
  await expect(row, 'with its number').toContainText(number);
  await expect(row, 'and its title').toContainText(title);
  await expect(listed.locator('[data-partner-achievement]'), 'and only this client’s one achievement').toHaveCount(1);
  await expect(listed, 'no amount beside an achievement: its value is not revenue').not.toContainText(/SAR|Revenue/);
  await row.getByRole('link', { name: title }).click();
  await expect(page, 'its link opens the achievement').toHaveURL(new RegExp(`${achievementPath}$`));
  await expect(page.locator('[data-record-header]'), 'the achievement’s own record').toContainText(number);

  // ---- AS BUILT: Finance shows no achievement anywhere — neither the client's Finance tab nor the Finance page.
  // (An achievement's value is "Not revenue" by rule, so no figure may ever count it; a list of them is a new thing.)
  const tab = await openClientFinance(page, org.id);
  expect(shows(await tab.innerText()), 'as built: the client’s Finance tab does not show the achievement').toBe(false);
  await expect(page.locator('[data-partner-finance-row]'), 'an achievement is no money row').toHaveCount(0);
  await openFinance(page, `${d.slice(0, 4)}-01-01`, d, org.id);
  expect(shows(await main.innerText()), 'as built: the Finance page does not show the achievement').toBe(false);
  await expect(main.locator('a[href^="/kpis/achievements/"]'), 'as built: Finance links to no achievement').toHaveCount(
    0,
  );
  await expect(partnerLine(page, org.id), 'an achievement makes no line under Income by company').toHaveCount(0);
});
