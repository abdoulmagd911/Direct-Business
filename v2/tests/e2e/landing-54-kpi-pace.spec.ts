/**
 * Landing 54 — Reports → KPI pace in the browser (the design session's Batch 3, boards 5–8), against a made-up
 * department of its own. A manager opens the page from Reports and reads the month that has just ended: each KPI
 * with its Responsible, monthly target, actual, pace and status, the three counts, the curve, the initiatives line —
 * and Reports stays the open entry of the drawer. The current month marks today. A person is Responsible for at
 * most three KPIs: the fourth is refused by the database. An admin gets the pencil (it leads to the plan's targets);
 * a manager, a member and a viewer read without it; a person with no level is refused; at phone width nothing
 * scrolls sideways. Every value is made up.
 * With L54_SHOTS set to a folder, each view is saved there as a picture (for the builder's own look; nothing reads it).
 * Sabotage: tests/sabotage/landing-54-e2e.mjs.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { hydrated, personAs, signedInAs } from './support/landing-32';
import { PHONE, sideways } from './support/landing-34';
import { seedPace } from './support/landing-54';
import { callAs } from './support/stack';

const SHOTS = process.env.L54_SHOTS;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
const card = (page: Page, code: string, measure: 'count' | 'value' = 'count') =>
  page.locator(`[data-pace-kpi="${code}"][data-pace-measure="${measure}"]`);

test('KPI pace: a month’s KPIs with their pace and status, for each role, wide and on a phone', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const seed = await seedPace(page, browser);
  try {
    // ------------------------------------------------------------------ the manager, from Reports
    const m = await signedInAs(browser, seed.manager, `/reports?month=${seed.last}`);
    const mp = m.page;
    await hydrated(mp);
    await expect(mp.locator('[data-report-kpi-pace]'), 'Reports has the way to KPI pace').toBeVisible();
    await mp.locator('[data-report-kpi-pace]').click();
    await expect(mp).toHaveURL(new RegExp(`/reports/kpi-pace\\?month=${seed.last}$`));
    await expect(mp.getByRole('heading', { level: 1, name: 'KPI pace' })).toBeVisible();
    await expect(mp.locator('nav a[aria-current="page"]').filter({ hasText: 'Reports' }).first()).toBeVisible();
    await expect(mp.locator('[data-pace-kpi]')).toHaveCount(3);

    const problem = card(mp, 'PROBLEM');
    await expect(problem.locator('[data-pace-responsible]')).toHaveText(seed.member.name);
    await expect(problem.locator('[data-pace-target]')).toHaveText('4');
    await expect(problem.locator('[data-pace-actual]')).toHaveText('4');
    await expect(problem.locator('[data-pace-pct]')).toHaveText('100%');
    await expect(problem.locator('[data-pace-status]')).toHaveText('On track');
    await expect(problem.locator('[data-pace-initiatives]')).toContainText(`${seed.project} (1)`);
    await expect(problem.getByRole('link', { name: 'View them' })).toHaveAttribute('href', '/projects');

    const contracts = card(mp, 'CONTRACT');
    await expect(contracts.locator('[data-pace-responsible]')).toHaveText('Not set');
    await expect(contracts.locator('[data-pace-pct]')).toHaveText('80%');
    await expect(contracts.locator('[data-pace-status]')).toHaveText('At risk');
    await expect(contracts.locator('[data-pace-initiatives]')).toContainText('None linked yet');

    const value = card(mp, 'CONTRACT', 'value');
    await expect(value.locator('[data-pace-target]')).toHaveText('10,000');
    await expect(value.locator('[data-pace-actual]')).toHaveText('5,000');
    await expect(value.locator('[data-pace-pct]')).toHaveText('50%');
    await expect(value.locator('[data-pace-status]')).toHaveText('Behind');

    await expect(mp.locator('[data-pace-count="on_track"]')).toHaveText('1');
    await expect(mp.locator('[data-pace-count="at_risk"]')).toHaveText('1');
    await expect(mp.locator('[data-pace-count="behind"]')).toHaveText('1');
    await expect(mp.locator('[data-pace-edit]'), 'a manager has no pencil').toHaveCount(0);

    // the curve: the first KPI's, and another's on its button; a finished month has no today
    await expect(mp.locator('[data-pace-chart] [data-pace-line="target"]')).toBeVisible();
    await expect(mp.locator('[data-pace-chart] [data-pace-line="actual"]')).toBeVisible();
    await expect(mp.locator('[data-pace-today]')).toHaveCount(0);
    await value.getByRole('button', { name: /^Show .* on the chart$/ }).click();
    await expect(mp.locator('[data-pace-chart] h2')).toContainText('deal value (SAR)');
    await shot(mp, 'manager-last-month-1440');

    // the year selector keeps the month; the current month marks today
    await expect(mp.locator('[data-pace-years] a[aria-current="true"]')).toHaveText(seed.last.slice(0, 4));
    await mp.goto('/reports/kpi-pace');
    await expect(mp.locator('[data-pace-today]'), 'the current month marks today').toContainText('Today');
    await expect(card(mp, 'PROBLEM').locator('[data-pace-target]')).toHaveText('6');
    await expect(card(mp, 'PROBLEM').locator('[data-pace-actual]')).toHaveText('0');
    await shot(mp, 'manager-this-month-1440');

    // a month with no target says so
    await mp.goto('/reports/kpi-pace?month=2024-02');
    await expect(mp.getByText('No KPI has a target for this month yet')).toBeVisible();
    await expect(mp.locator('[data-pace-kpi]')).toHaveCount(0);
    await shot(mp, 'manager-empty-1440');

    // ------------------------------------------------------------------ at most three KPIs for one person
    const others = Object.entries(seed.categories).filter(([code]) => code !== 'PROBLEM');
    for (const [, id] of others.slice(0, 2))
      await seed.asManager('kpi_responsible_set', { p_plan: seed.planId, p_category: id, p_person: seed.member.id });
    const fourth = await callAs(m.context, 'kpi_responsible_set', {
      p_plan: seed.planId,
      p_category: others[2]![1],
      p_person: seed.member.id,
    });
    expect(fourth.status, 'a fourth KPI for one person is refused').toBe(400);
    expect(JSON.stringify(fourth.body)).toContain('kpi.responsible_limit');

    // ------------------------------------------------------------------ the phone
    await mp.setViewportSize(PHONE);
    await mp.goto(`/reports/kpi-pace?month=${seed.last}`);
    await expect(mp.locator('[data-pace-kpi]')).toHaveCount(3);
    expect(await sideways(mp), 'nothing scrolls sideways at 375 px').toBeLessThanOrEqual(0);
    await shot(mp, 'manager-last-month-375');
    await m.context.close();

    // ------------------------------------------------------------------ the other roles
    for (const who of ['member', 'viewer'] as const) {
      const s = await signedInAs(browser, seed[who], `/reports/kpi-pace?month=${seed.last}`);
      await expect(s.page.locator('[data-pace-kpi]'), `a ${who} reads the KPIs`).toHaveCount(3);
      await expect(card(s.page, 'PROBLEM').locator('[data-pace-status]')).toHaveText('On track');
      await expect(s.page.locator('[data-pace-edit]'), `a ${who} has no pencil`).toHaveCount(0);
      await shot(s.page, `${who}-last-month-1440`);
      await s.context.close();
    }
    const nobody = await signedInAs(browser, await personAs('none'), `/reports/kpi-pace?month=${seed.last}`);
    await expect(nobody.page.locator('[data-state="no-access"]')).toBeVisible();
    await expect(nobody.page.locator('[data-pace-kpi]')).toHaveCount(0);
    await nobody.context.close();

    // the admin (signed in on the first page): the pencil, leading to the plan's targets
    await page.goto(`/reports/kpi-pace?month=${seed.last}`);
    const mine = page.locator(`[data-pace-edit][href="/settings/performance/${seed.planId}"]`);
    await expect(mine, 'an admin gets the pencil on each of the plan’s KPIs').toHaveCount(3);
    await shot(page, 'admin-last-month-1440');
    await mine.first().click();
    await expect(page).toHaveURL(new RegExp(`/settings/performance/${seed.planId}$`));
  } finally {
    await seed.close();
  }
});
