/**
 * Landing 41 — the Finance page lists the achievements of the period, apart from the money (the owner, 22 Nov:
 * "achievements show on Finance as a separate, non-money list"), on the real stack. An achievement logged in a month
 * shows in the card when Finance is on that month and not when it is on another (a month with none says so); the card says it is not money and
 * draws no amount; the title opens the achievement's own record; and the period's revenue figure is the same before
 * and after the achievement is logged. The database decides what is listed (FAC-01). Every value is made up.
 * Sabotages: tests/sabotage/landing-41.mjs.
 */
import { expect, test } from '@playwright/test';
import { ensureAchievementPlan } from './support/achievement-plan';
import { hydrated, signedInAdmin } from './support/landing-32';
import { callAs, sql } from './support/stack';

/** Two months of this year (the plan's year) that no other spec logs an achievement in: May and April. */
const YEAR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric' }).format(new Date());
const MONTH = `${YEAR}-05`;
const OTHER = `${YEAR}-04`;
const addressOf = (ym: string) => `/finance?period=custom&from=${ym}-01&to=${ym}-28`;

test('an achievement of the period shows on Finance as a list apart from the money, and changes no figure', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signedInAdmin(page);
  await ensureAchievementPlan();
  const card = page.locator('[data-finance-achievements]');

  // a month nobody logs an achievement in: the card is there, says it is not money, and says it is empty
  await page.goto(addressOf(OTHER));
  await hydrated(page);
  await expect(card, 'the card is on Finance').toBeVisible();
  await expect(card, 'and says it is not money').toContainText('Not money — counted in no total');
  await expect(card.locator('[data-finance-achievements-empty]'), 'another month lists none of it').toBeVisible();

  await page.goto(addressOf(MONTH));
  await hydrated(page);
  await expect(card, 'the card is on Finance for the month too').toBeVisible();
  const revenue = page.locator('[data-finance-tile="revenue"] [data-finance-figure]').first();
  await expect(revenue, 'the revenue figure is drawn').toBeVisible();
  const before = (await revenue.innerText()).trim();

  const [cat] = await sql<{ code: string }>(
    `select c.code from perf.achievement_category c
     where c.active and c.deleted_at is null and c.required_ref_system_id is null and not c.has_deal_value
       and not c.sets_prospect order by c.code limit 1`,
  );
  const title = `Made-up fix ${Math.random().toString(36).slice(2, 8)}`;
  const made = await callAs(page.context(), 'achievement_log', {
    p_values: { category: cat!.code, title, happened_on: `${MONTH}-14` },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const id = (made.body as { id: string }).id;

  await page.reload();
  await hydrated(page);
  const row = card.locator('[data-finance-achievement]', { hasText: title });
  await expect(row, 'the achievement of the month is listed').toBeVisible();
  await expect(row.locator('[data-finance-achievement-day]'), 'with its day').toContainText(`14 May ${YEAR}`);
  await expect(card, 'the card draws no amount').not.toContainText(/SAR|﷼/);
  await expect(revenue, 'the revenue figure is drawn again').toBeVisible();
  expect((await revenue.innerText()).trim(), 'the period’s revenue is unchanged by the achievement').toBe(before);

  await page.goto(addressOf(OTHER));
  await hydrated(page);
  await expect(card, 'the card is on Finance for another month too').toBeVisible();
  // the list has answered (its empty line is drawn) before "not listed" is believed: a card still loading lists
  // nothing either
  await expect(card.locator('[data-finance-achievements-empty]'), 'another month lists none of it').toBeVisible();
  await expect(
    card.locator('[data-finance-achievement]', { hasText: title }),
    'and not this month’s achievement',
  ).toHaveCount(0);

  await page.goto(addressOf(MONTH));
  await hydrated(page);
  await card.locator('[data-finance-achievement]', { hasText: title }).getByRole('link').click();
  await expect(page, 'the title opens the achievement’s own record').toHaveURL(new RegExp(`/kpis/achievements/${id}`));
});
