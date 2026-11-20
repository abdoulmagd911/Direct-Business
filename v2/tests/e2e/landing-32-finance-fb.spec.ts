/**
 * Landing 32 (Finance F-B) in the browser: who counts and who does not.
 *  1. An admin excludes one Ledger row and includes it again: every figure moves by exactly that row and comes back
 *     exactly; the record itself is never removed; a reason is required both ways.
 *  2. A head (Full on Finance) reads the Counted? column and has no button.
 *  3. A period with no known cost shows Cost and Profit empty — a dash and the words, never 0.
 *  4. Settings → Finance: the exclusion list and the merge list open empty, nothing pre-filled; a rule added there
 *     takes its rows out of the Ledger (no Include on such a row), a merge counts one organisation under another,
 *     removing the rule counts the row again; only an admin sees the lists.
 *  5. An organisation's Finance tab equals the Finance page's line for it, difference 0; an excluded row is listed
 *     apart and is in no total.
 *  6. A code's detail offers Exclude / Include on a use's row to an admin.
 *  7. The import preview says what the exclusion list will leave out, and when a code text matches no code.
 *  8. The speed gate: the three Finance reads answer in under 3 s for every role; no role, no read.
 * Each test reads page-wide figures only inside a far-past month no other spec uses. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-e2e.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  clearMadeUpRules,
  hydrated,
  num,
  ownMonth,
  personAs,
  rowNo,
  seedImported,
  seedOrg,
  signedInAdmin,
  signedInAs,
  tag,
  today,
} from './support/landing-32';
import { callAs, sql } from './support/stack';

async function openFinance(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
  await blocksSettled(page);
  await expect(page.locator('[data-finance-report]'), 'the Ledger has answered').toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-counted-table] [data-state="loading"]'), 'Is it counted? has answered').toHaveCount(
    0,
    { timeout: 45_000 },
  );
}

/** One figure of the Ledger's strip. */
const strip = (page: Page, kind: string) => page.locator(`[data-finance-ledger-total="${kind}"] > span`).nth(1);
const stripNumber = async (page: Page, kind: string) => num(await strip(page, kind).innerText());
/** One of the page's top cards, in exact riyals (a card of 1,000 or more carries its exact figure under the short one). */
async function tileNumber(page: Page, kind: string) {
  const tile = page.locator(`[data-finance-tile="${kind}"]`);
  const exact = tile.locator('[data-finance-exact]');
  return num(await ((await exact.count()) ? exact : tile.locator('[data-finance-figure]')).innerText());
}
const ledgerRow = (page: Page, number: string) => page.locator('[data-finance-ledger-row]').filter({ hasText: number });
const apartRow = (page: Page, number: string) =>
  page.locator('[data-ledger-not-counted] [data-ledger-not-counted-row]').filter({ hasText: number });
const partnerLine = (page: Page, partnerId: string) =>
  page.locator(`[data-finance-ledger-companies] tbody tr:has(a[href="/partners/${partnerId}"])`);

/** The reason box: its button waits for a reason. */
async function giveReason(page: Page, reason: string, what: string) {
  const dialog = page.getByRole('dialog');
  const save = dialog.locator('[data-reason-save]');
  await expect(save, `${what}: the button waits for a reason`).toBeDisabled();
  await dialog.locator('[data-reason]').fill('   ');
  await expect(save, `${what}: spaces are not a reason`).toBeDisabled();
  await dialog.locator('[data-reason]').fill(reason);
  await expect(save, `${what}: a typed reason opens the button`).toBeEnabled();
  await save.click();
  await expect(dialog, `${what}: the box closes once saved`).toHaveCount(0);
}

async function pick(page: Page, wrapper: Locator, option: string) {
  await wrapper.locator('button[role=combobox]').click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('1 · an admin excludes one Ledger row and includes it again: every figure moves by exactly that row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1962-05');
  const org = await seedOrg(call, 'Toggle');
  const [a, b, c] = [rowNo(), rowNo(), rowNo()];
  await seedImported(org.id, admin.id, month.mid, [
    { number: a, revenue: 100, cost: 40 },
    { number: b, revenue: 250, cost: 50 },
    { number: c, revenue: 1000, cost: null },
  ]);
  await openFinance(page, month.url);

  // before: 1,350 revenue, 90 cost, 260 profit; all three rows count
  expect(await stripNumber(page, 'revenue'), 'the strip revenue is the three rows').toBe(1350);
  expect(await stripNumber(page, 'cost'), 'the strip cost is the two costed rows').toBe(90);
  expect(await stripNumber(page, 'profit'), 'the strip profit is the two costed rows').toBe(260);
  expect(await tileNumber(page, 'revenue'), 'the top Revenue card agrees').toBe(1350);
  await expect(page.locator('[data-finance-ledger-row]'), 'three rows in the Ledger').toHaveCount(3);
  await expect(
    page.locator('[data-finance-ledger-row] [data-ledger-counted="yes"]'),
    'every row says it is counted',
  ).toHaveCount(3);
  await expect(page.locator('[data-ledger-not-counted]'), 'nothing is listed apart yet').toHaveCount(0);
  const monthRow = page.locator('[data-counted-month="1962-05"]');
  expect(
    num(
      await monthRow
        .locator('[data-counted-cell="counted"]')
        .innerText()
        .then((s) => s.split('\n')[0]!),
    ),
  ).toBe(1350);

  // Exclude the 250 row: a reason is required
  const reason = `made up e2e: a test booking ${tag()}`;
  await ledgerRow(page, b).locator('[data-ledger-exclude]').click();
  await giveReason(page, reason, 'Exclude');

  await expect
    .poll(() => stripNumber(page, 'revenue'), { message: 'the strip revenue dropped by exactly 250' })
    .toBe(1100);
  expect(await stripNumber(page, 'cost'), 'the strip cost dropped by exactly 50').toBe(40);
  expect(await stripNumber(page, 'profit'), 'the strip profit dropped by exactly 200').toBe(60);
  const apart = apartRow(page, b);
  await expect(apart, 'the row is listed under Not counted').toHaveCount(1);
  await expect(apart.locator('[data-ledger-counted="no"]'), 'and says it is not counted').toBeVisible();
  await expect(apart.locator('[data-ledger-not-counted-reason]'), 'with the reason typed').toContainText(reason);
  await expect(apart.locator('[data-ledger-not-counted-revenue]'), 'and its own revenue').toContainText('250');
  await expect(ledgerRow(page, b), 'it left the counted rows').toHaveCount(0);
  await expect(page.locator('[data-finance-ledger-row]'), 'two rows still count').toHaveCount(2);
  await expect
    .poll(() => tileNumber(page, 'revenue'), { message: 'the top Revenue card dropped by the same 250' })
    .toBe(1100);
  await expect(
    monthRow.locator('[data-counted-cell="excluded"]'),
    'Is it counted? shows the excluded amount for the month',
  ).toContainText('250');
  await expect(monthRow.locator('[data-counted-cell="counted"]')).toContainText('1,100');
  // the record is still there; the exclusion is a rule for that one row
  const kept = await sql(`select deleted_at from work.import_record where partner_id = $1 and transaction_ref = $2`, [
    org.id,
    b,
  ]);
  expect(kept, 'the imported record is still there').toHaveLength(1);
  expect(kept[0]!.deleted_at, 'and was not removed').toBeNull();
  const rules = await sql<{ id: string; kind: string; reason: string }>(
    `select id, kind, reason from finance.exclusion_rule where partner_id = $1 and value_raw = $2 and deleted_at is null`,
    [org.id, b],
  );
  expect(rules, 'one rule excludes that row').toHaveLength(1);
  expect(rules[0]!.kind, 'a rule for one invoice').toBe('invoice');
  expect(rules[0]!.reason, 'holding the reason typed').toBe(reason);

  // Include it again: a reason is required, and every figure is back exactly
  const back = `made up e2e: counted after all ${tag()}`;
  await apart.locator('[data-ledger-include]').click();
  await giveReason(page, back, 'Include');
  await expect.poll(() => stripNumber(page, 'revenue'), { message: 'the strip revenue is back' }).toBe(1350);
  expect(await stripNumber(page, 'cost'), 'the strip cost is back').toBe(90);
  expect(await stripNumber(page, 'profit'), 'the strip profit is back').toBe(260);
  await expect(page.locator('[data-ledger-not-counted]'), 'nothing is listed apart any more').toHaveCount(0);
  await expect(ledgerRow(page, b).locator('[data-ledger-counted="yes"]'), 'the row counts again').toBeVisible();
  await expect.poll(() => tileNumber(page, 'revenue'), { message: 'the top Revenue card is back' }).toBe(1350);
  await expect(monthRow.locator('[data-counted-cell="counted"]')).toContainText('1,350');
  const after = await sql<{ deleted_at: Date | null; delete_reason: string | null }>(
    `select deleted_at, delete_reason from finance.exclusion_rule where id = $1`,
    [rules[0]!.id],
  );
  expect(after[0]!.deleted_at, 'the rule was taken away').not.toBeNull();
  expect(after[0]!.delete_reason, 'with the reason typed for Include').toBe(back);
});

test('2 · a head reads the Counted? column and has no Exclude or Include', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const month = await ownMonth('1962-08');
  const setup = await signedInAdmin(page);
  const org = await seedOrg(setup.call, 'Reader');
  const [a, b] = [rowNo(), rowNo()];
  await seedImported(org.id, setup.admin.id, month.mid, [
    { number: a, revenue: 300, cost: 100 },
    { number: b, revenue: 200, cost: 50 },
  ]);
  await setup.call('finance_row_exclude', { p_partner: org.id, p_number: b, p_reason: 'made up e2e: for the head' });

  const head = await signedInAs(browser, await personAs('head'));
  try {
    await openFinance(head.page, month.url);
    await expect(
      head.page.locator('[data-finance-ledger-row] [data-ledger-counted="yes"]'),
      'the head sees the counted row say so',
    ).toHaveCount(1);
    const apart = apartRow(head.page, b);
    await expect(apart.locator('[data-ledger-counted="no"]'), 'and the excluded row say it is not').toBeVisible();
    await expect(apart.locator('[data-ledger-not-counted-reason]')).toContainText('made up e2e: for the head');
    await expect(head.page.locator('[data-ledger-exclude]'), 'a head has no Exclude button').toHaveCount(0);
    await expect(head.page.locator('[data-ledger-include]'), 'a head has no Include button').toHaveCount(0);
    // and the database refuses a head who asks anyway
    const refused = await callAs(head.context, 'finance_row_exclude', {
      p_partner: org.id,
      p_number: a,
      p_reason: 'made up e2e: not allowed',
    });
    expect(refused.status, 'the database refuses a head').toBe(403);
  } finally {
    await head.context.close();
  }
  // the admin, on the same period, has both
  await openFinance(page, month.url);
  await expect(page.locator('[data-ledger-exclude]'), 'the admin has Exclude on the counted row').toHaveCount(1);
  await expect(page.locator('[data-ledger-include]'), 'and Include on the excluded one').toHaveCount(1);
});

test('3 · a period with no known cost shows Cost and Profit empty, never 0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1963-02');
  const org = await seedOrg(call, 'No Cost');
  const [a, b] = [rowNo(), rowNo()];
  await seedImported(org.id, admin.id, month.mid, [
    { number: a, revenue: 600, cost: null },
    { number: b, revenue: 400, cost: null },
  ]);
  await openFinance(page, month.url);

  expect(await stripNumber(page, 'revenue'), 'the revenue is the two rows').toBe(1000);
  const cost = page.locator('[data-ledger-cost-empty]');
  await expect(cost, 'the strip Cost is marked empty').toBeVisible();
  const costWords = await cost.innerText();
  expect(costWords, 'the empty Cost is a dash').toContain('—');
  expect(costWords, 'the empty Cost never reads 0').not.toMatch(/0/);
  await expect(page.locator('[data-ledger-figure-empty]'), 'Cost and Profit are both empty').toHaveCount(2);
  const profitWords = await page.locator('[data-finance-ledger-total="profit"]').innerText();
  expect(profitWords, 'the empty Profit is a dash').toContain('—');
  expect(profitWords, 'the empty Profit never reads 0').not.toMatch(/0/);
  const line = partnerLine(page, org.id);
  await expect(line, 'one line for the organisation').toHaveCount(1);
  await expect(line.locator('[data-ledger-partner-cost]'), 'its cost says it is not known').toHaveText('Not known yet');
  await expect(line.locator('[data-ledger-partner-profit]'), 'and its profit with it').toHaveText('Not known yet');
  // each row too: the cost and profit cells say the words, never a figure
  for (const n of [a, b])
    await expect(ledgerRow(page, n).locator('td [data-not-known]'), `row ${n} has no cost and no profit`).toHaveCount(
      3,
    );
});

test.describe('the lists in Settings → Finance', () => {
  // these two type on the lists, which are everyone's: they take turns, and each takes its rules off again
  test.describe.configure({ mode: 'serial' });

  test('4 · the lists open empty; a rule excludes, a merge counts under another organisation, removing counts again', async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await clearMadeUpRules();
    const { call, admin } = await signedInAdmin(page);
    const month = await ownMonth('1964-03');
    const orgA = await seedOrg(call, 'Kept');
    const orgB = await seedOrg(call, 'Listed');
    const [a, b] = [rowNo(), rowNo()];
    await seedImported(orgA.id, admin.id, month.mid, [{ number: a, revenue: 400, cost: 100 }]);
    await seedImported(orgB.id, admin.id, month.mid, [{ number: b, revenue: 300, cost: 50 }]);
    const ruleHook = `[data-exclusion-rule="client_id:${orgB.cid}"]`;
    const mergeHook = `[data-merge-rule="client_id:${orgB.cid}"]`;
    try {
      // both lists are drawn, and empty: nothing is on them until someone types it
      await page.goto('/settings/finance');
      await hydrated(page);
      const exclusions = page.locator('[data-exclusion-list]');
      const merges = page.locator('[data-merge-list]');
      await expect(exclusions, 'the exclusion list is drawn').toBeVisible();
      await expect(merges, 'the merge list is drawn').toBeVisible();
      // Nothing is on the lists until someone types it. The database is shared by the specs running beside this one,
      // so "empty" is said as: the lists draw exactly the rules the database holds now, each of them typed by a test
      // (a made-up reason) — never one that came with the code. (That a new database holds none is LST-01's.)
      const [held] = await sql<{ rules: number; merges: number; seeded: number }>(
        `select (select count(*)::int from finance.exclusion_rule where deleted_at is null and partner_id is null) as rules,
                (select count(*)::int from finance.merge_rule where deleted_at is null) as merges,
                (select count(*)::int from finance.exclusion_rule where deleted_at is null and reason not ilike 'made%')
                + (select count(*)::int from finance.merge_rule where deleted_at is null and reason not ilike 'made%') as seeded`,
      );
      expect(held!.seeded, 'no rule on either list came with the code').toBe(0);
      await expect(exclusions.locator(ruleHook), 'this test’s rule is not on the exclusion list yet').toHaveCount(0);
      await expect(merges.locator(mergeHook), 'nor on the merge list').toHaveCount(0);
      if (held!.rules === 0)
        await expect(exclusions.locator('[data-state="empty"]'), 'the exclusion list says it is empty').toContainText(
          'Nothing is excluded yet.',
        );
      if (held!.merges === 0)
        await expect(merges.locator('[data-state="empty"]'), 'the merge list says it is empty').toBeVisible();

      // Add to the exclusion list: the dialog opens with nothing chosen and nothing typed
      await exclusions.locator('[data-exclusion-add]').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('[data-exclusion-kind]'), 'no kind is chosen').toHaveAttribute(
        'data-exclusion-kind',
        '',
      );
      await expect(dialog.locator('[data-exclusion-value]'), 'the value box is empty').toHaveValue('');
      await expect(dialog.locator('[data-exclusion-reason]'), 'the reason box is empty').toHaveValue('');
      await expect(dialog.locator('[data-exclusion-save]'), 'nothing to save yet').toBeDisabled();
      await pick(page, dialog.locator('[data-exclusion-kind]'), 'Client ID');
      await dialog.locator('[data-exclusion-value]').fill(orgB.cid);
      await expect(dialog.locator('[data-exclusion-save]'), 'a reason is required').toBeDisabled();
      await dialog.locator('[data-exclusion-reason]').fill('made up e2e: an excluded client');
      await dialog.locator('[data-exclusion-save]').click();
      const rule = page.locator(ruleHook);
      await expect(rule, 'the rule is on the list').toBeVisible();
      await expect(rule.locator('[data-exclusion-catches]'), 'it catches the one row').toContainText('1 row');
      await expect(rule.locator('[data-exclusion-catches]'), 'and says its amount').toContainText('300');

      // the Ledger: the listed organisation's row is not counted, by the list — and offers no Include
      await openFinance(page, month.url);
      const apart = apartRow(page, b);
      await expect(apart, 'the listed row is under Not counted').toHaveCount(1);
      await expect(apart.locator('[data-ledger-by-list-rule]'), 'it says a list rule excludes it').toContainText(
        'Excluded by a list rule — change it in Settings → Finance',
      );
      await expect(apart.locator('[data-ledger-not-counted-reason]')).toContainText('made up e2e: an excluded client');
      await expect(apart.locator('[data-ledger-include]'), 'a list rule is not undone from the row').toHaveCount(0);
      expect(await stripNumber(page, 'revenue'), 'the totals leave it out').toBe(400);
      expect(await stripNumber(page, 'cost')).toBe(100);
      await expect(partnerLine(page, orgB.id), 'the listed organisation has no line by partner').toHaveCount(0);

      // the merge list: the dialog opens empty too; the listed client ID is counted under the kept organisation
      await page.goto('/settings/finance');
      await hydrated(page);
      await page.locator('[data-merge-list] [data-merge-add]').click();
      await expect(dialog.locator('[data-merge-kind]'), 'no kind is chosen').toHaveAttribute('data-merge-kind', '');
      await expect(dialog.locator('[data-merge-value]'), 'the value box is empty').toHaveValue('');
      await expect(dialog.locator('[data-merge-partner]'), 'no organisation is picked').toHaveAttribute(
        'data-merge-partner',
        '',
      );
      await expect(dialog.locator('[data-merge-reason]'), 'the reason box is empty').toHaveValue('');
      await pick(page, dialog.locator('[data-merge-kind]'), 'Client ID');
      await dialog.locator('[data-merge-value]').fill(orgB.cid);
      await dialog.locator('[data-merge-partner] [data-partner-search]').fill(orgA.name);
      await dialog.locator(`[data-partner-hit="${orgA.id}"]`).click();
      await dialog.locator('[data-merge-reason]').fill('made up e2e: one group');
      await dialog.locator('[data-merge-save]').click();
      await expect(page.locator(mergeHook), 'the merge is on the list').toBeVisible();
      await expect(page.locator(`${mergeHook} [data-merge-target="${orgA.id}"]`), 'counted under A').toContainText(
        orgA.name,
      );

      // Remove the exclusion: a reason is required
      await page.locator(`${ruleHook} [data-exclusion-remove]`).click();
      await giveReason(page, 'made up e2e: counted after all', 'Remove');
      await expect(page.locator(ruleHook), 'the rule left the list').toHaveCount(0);

      // the Ledger: the row counts again, and under the kept organisation — one line holding both amounts
      await openFinance(page, month.url);
      await expect(page.locator('[data-ledger-not-counted]'), 'nothing is listed apart any more').toHaveCount(0);
      await expect(ledgerRow(page, b).locator('[data-ledger-counted="yes"]'), 'the row counts again').toBeVisible();
      expect(await stripNumber(page, 'revenue'), 'the totals take it in').toBe(700);
      await expect(page.locator('[data-finance-ledger-companies] tbody tr'), 'one line by partner').toHaveCount(1);
      const line = partnerLine(page, orgA.id);
      await expect(line.locator('td').nth(1), 'the kept organisation holds both amounts').toHaveText('700');
      await expect(line.locator('[data-ledger-partner-cost]'), 'and both costs').toHaveText('150');
      await expect(partnerLine(page, orgB.id), 'the merged organisation has no line of its own').toHaveCount(0);

      // only an admin sees the lists
      for (const role of ['member', 'head'] as const) {
        const other = await signedInAs(browser, await personAs(role), '/settings/finance');
        try {
          await hydrated(other.page);
          await expect(other.page.locator('[data-credit-limit]'), `a ${role} sees the credit limit`).toBeVisible();
          await expect(other.page.locator('[data-exclusion-list]'), `a ${role} sees no exclusion list`).toHaveCount(0);
          await expect(other.page.locator('[data-merge-list]'), `a ${role} sees no merge list`).toHaveCount(0);
          const read = await callAs(other.context, 'finance_exclusion_rules', {});
          expect(read.status, `the database refuses a ${role} the list`).toBe(403);
        } finally {
          await other.context.close();
        }
      }
    } finally {
      await clearMadeUpRules();
    }
  });

  test('7 · the import preview says what the exclusion list leaves out, and when a code text matches no code', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await clearMadeUpRules();
    const { call } = await signedInAdmin(page);
    const org = await seedOrg(call, 'Import');
    try {
      await call('finance_exclusion_rule_save', {
        p_id: null,
        p_fields: { kind: 'client_id', value: org.cid, reason: 'made up e2e: import preview' },
        p_reason: 'made up e2e: import preview',
      });
      await page.goto('/finance?period=custom&from=1965-01-01&to=1965-01-31');
      await hydrated(page);
      const section = page.locator('[data-finance-import-section]');
      await section.scrollIntoViewIfNeeded();
      await section.locator('[data-partner-search]').fill(org.name);
      await section.locator(`[data-partner-hit="${org.id}"]`).click();
      const file = [
        'Invoice Number,Before Discount,Discount,After Discount,Product,Payment Status',
        `99320${Math.floor(Math.random() * 90000 + 10000)},500,50,450,Hotel,Fully Paid`,
        `99321${Math.floor(Math.random() * 90000 + 10000)},300,30,270,Flight,Fully Paid`,
      ].join('\n');
      await section
        .locator('[data-import-file]')
        .setInputFiles({ name: 'made-up-promo.csv', mimeType: 'text/csv', buffer: Buffer.from(file, 'utf8') });
      await section.locator('[data-import-code]').fill(`MADEUPE2ENOCODE${tag().toUpperCase()}`);
      await section.locator('[data-import-review]').click();

      await expect(
        section.locator('[data-import-code-state]'),
        'the code text matches no code, and the preview says so',
      ).toHaveAttribute('data-import-code-state', 'not_found');
      await expect(section.locator('[data-import-code-state]')).toContainText('Code has not been found');
      const note = section.locator('[data-import-rule-excluded]');
      await expect(note, 'the preview says the list catches every row').toHaveAttribute(
        'data-import-rule-excluded',
        'all',
      );
      await expect(note, 'naming the rule and its reason').toContainText(org.cid);
      await expect(note).toContainText('made up e2e: import preview');
      await expect(
        section.locator('[data-import-counts] li').filter({ hasText: 'Left out by rule' }),
        'Left out by rule counts the two rows',
      ).toContainText('2');
    } finally {
      await clearMadeUpRules();
    }
  });
});

test('5 · an organisation’s Finance tab equals the Finance page’s line for it, difference 0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Tab');
  const d = today();
  const [m1, m2] = [`TX-L${rowNo()}`, `TX-L${rowNo()}`];
  const [i1, i2, i3] = [rowNo(), rowNo(), rowNo()];
  // recorded here: 1,000 with an approved expense of 200, and 500 with no cost yet
  await call('finance_import', {
    p_file: 'invoices',
    p_rows: [
      { ref: m1, status: 'Fully Paid', created_on: d, total_sar: 1000, client_id: org.cid },
      { ref: m2, status: 'Fully Paid', created_on: d, total_sar: 500, client_id: org.cid },
    ],
    p_export_time: new Date().toISOString(),
  });
  await call('finance_import', {
    p_file: 'expenses',
    p_rows: [{ ref: m1, expense_type: 'Hotel', status: 'Approved', amount_sar: 200, created_at: `${d}T10:00:00Z` }],
    p_export_time: new Date().toISOString(),
  });
  // imported: 500 (cost 100), 700 (no cost), and 900 (cost 300) which the admin excludes
  await seedImported(org.id, admin.id, d, [
    { number: i1, revenue: 500, cost: 100 },
    { number: i2, revenue: 700, cost: null },
    { number: i3, revenue: 900, cost: 300 },
  ]);
  await call('finance_row_exclude', { p_partner: org.id, p_number: i3, p_reason: 'made up e2e: not this one' });

  await page.goto(`/partners/${org.id}?tab=finance`);
  await hydrated(page);
  await expect(page.locator('[data-partner-finance-ledger]'), 'the tab ledger has answered').toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 45_000 },
  );
  const tiles = page.locator('[data-partner-finance-totals] [data-kpi-tile]');
  const tile = async (i: number) => num(await tiles.nth(i).locator('> div').nth(1).innerText());
  await expect(tiles, 'Revenue, Cost, Profit and Units').toHaveCount(4);
  const rows = page.locator('[data-partner-finance-row]');
  await expect(rows, 'four rows count').toHaveCount(4);

  // the Finance page's line for this organisation, for the tab's own period (this year, to today in Riyadh)
  type Line = { partner_id: string | null; revenue: number; cost: number | null; profit: number | null };
  type Row = { partner_id: string | null; source: string; counted: boolean; revenue: number; number: string | null };
  const period = { p_from: `${d.slice(0, 4)}-01-01`, p_to: d };
  const whole = await call<{ by_company: Line[] }>('finance_unified_ledger', period);
  const line = whole.by_company.find((c) => c.partner_id === org.id);
  expect(line, 'the Finance page has a line for the organisation').toBeTruthy();
  expect(line!.revenue, 'the line is the four counted rows').toBe(2700);
  expect((await tile(0)) - line!.revenue, 'revenue: the tab minus the Finance page line').toBe(0);
  expect((await tile(1)) - (line!.cost ?? NaN), 'cost: the tab minus the Finance page line').toBe(0);
  expect((await tile(2)) - (line!.profit ?? NaN), 'profit: the tab minus the Finance page line').toBe(0);
  expect(await tile(3), 'four units').toBe(4);

  // the excluded row is listed apart, with its reason, and is in no total (2,700 has no room for its 900)
  const apart = page.locator('[data-company-not-counted-rows] [data-company-not-counted-row]');
  await expect(apart, 'one row is listed as not counted').toHaveCount(1);
  await expect(apart, 'it is the excluded row').toContainText(i3);
  await expect(apart.locator('[data-company-not-counted-reason]')).toHaveText('made up e2e: not this one');
  await expect(rows.filter({ hasText: i3 }), 'it is not among the counted rows').toHaveCount(0);

  // Imported off: the tab is the rows recorded here alone — the same rows of the Finance page's answer
  const own = await call<{ rows: Row[] }>('finance_unified_ledger', { ...period, p_partner: org.id });
  const manual = own.rows.filter((r) => r.source === 'manual' && r.counted && r.partner_id === org.id);
  const manualRevenue = manual.reduce((s, r) => s + r.revenue, 0);
  expect(manualRevenue, 'the rows recorded here are 1,000 and 500').toBe(1500);
  await page.getByRole('switch', { name: 'Imported', exact: true }).click();
  await expect(rows, 'two rows with the imported ones hidden').toHaveCount(2);
  expect((await tile(0)) - manualRevenue, 'revenue with Imported off: the tab minus the manual rows').toBe(0);
  await expect(
    page.locator('[data-company-not-counted-row]'),
    'the excluded imported row is hidden with the rest',
  ).toHaveCount(0);
});

test('6 · a code’s detail: an admin excludes a use’s row with a reason and includes it again', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Code');
  const code = `MADEUPE2E${tag().toUpperCase()}`;
  const ref = `TX-L${rowNo()}`;
  const added = await call('identifier_add', {
    p_partner: org.id,
    p_kind: 'discount_code',
    p_value: code,
    p_reason: 'made up',
  });
  await call('finance_import', {
    p_file: 'invoices',
    p_rows: [{ ref, status: 'Fully Paid', created_on: today(), total_sar: 800, client_id: org.cid }],
    p_export_time: new Date().toISOString(),
  });
  await call('code_use_add', { p_code: added.id, p_invoice_ref: ref, p_discount: 80, p_reason: 'made up: a use' });

  await page.goto(`/codes?code=${added.id}`);
  await hydrated(page);
  const use = page.locator('[data-code-ledger] [data-code-use]');
  await expect(use, 'the one use is listed').toHaveCount(1);
  await expect(use, 'and it counts').toHaveAttribute('data-counted', 'true');
  await expect(use.locator('[data-code-include]'), 'a counted row offers no Include').toHaveCount(0);
  const totals = page.locator('[data-code-totals]');
  await expect(totals, 'the totals hold its discount').toContainText('80');

  const reason = `made up e2e: not a real use ${tag()}`;
  await use.locator('[data-code-exclude]').click();
  await giveReason(page, reason, 'Exclude');
  await expect(use, 'the row is not counted now').toHaveAttribute('data-counted', 'false');
  await expect(use, 'and says why').toContainText(reason);
  await expect(use.locator('[data-code-exclude]'), 'an excluded row offers no Exclude').toHaveCount(0);
  await expect(use.locator('[data-code-list-rule]'), 'it was excluded by hand, not by a list').toHaveCount(0);
  await expect(page.locator('[data-code-ledger-empty]'), 'no use counts any more').toBeVisible();

  await use.locator('[data-code-include]').click();
  await giveReason(page, `made up e2e: it is real ${tag()}`, 'Include');
  await expect(use, 'the row counts again').toHaveAttribute('data-counted', 'true');
  await expect(use.locator('[data-code-exclude]'), 'and offers Exclude again').toBeVisible();
  await expect(page.locator('[data-code-ledger-empty]')).toHaveCount(0);
});

test('8 · the speed gate: the Finance reads answer in under 3 s for every role; no role, no read', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const d = today();
  const year = { p_from: `${d.slice(0, 4)}-01-01`, p_to: d };
  const READS = ['finance_unified_ledger', 'finance_period', 'finance_counted_by_month'] as const;
  const out: Record<string, Record<string, number | string>> = {};
  for (const role of ['admin', 'head', 'manager', 'member', 'viewer', 'none'] as const) {
    const who = await signedInAs(browser, await personAs(role));
    try {
      out[role] = {};
      for (const fn of READS) {
        const t0 = Date.now();
        const r = await callAs(who.context, fn, year);
        const ms = Date.now() - t0;
        if (role === 'none') {
          expect(r.status, `${fn}: a person with no role is refused, not answered and not an error`).toBe(403);
          expect((r.body as { code?: string }).code, `${fn}: refused for want of access`).toBe('42501');
          out[role]![fn] = `refused (${r.status}) in ${ms} ms`;
        } else {
          expect(r.status, `${fn} as ${role}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
          expect(ms, `${fn} as ${role} answered in ${ms} ms`).toBeLessThan(3000);
          out[role]![fn] = ms;
        }
        console.log(`[l32-speed] ${role} · ${fn} · ${out[role]![fn]}${role === 'none' ? '' : ' ms'}`);
      }
    } finally {
      await who.context.close();
    }
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/l32-speed.json', JSON.stringify({ period: year, limit_ms: 3000, roles: out }, null, 2));
});
