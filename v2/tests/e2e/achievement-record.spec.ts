/**
 * V654, the Achievements record page and list, at 375 and 1,440 px: the record's title wraps like the list's — three
 * lines at most on a PC, the whole title on a phone, never a cut line there; the trail never repeats (a PC says
 * "Achievements / <number and title>", a phone has the back arrow and the title and no trail); "No evidence" is said once,
 * as the chip beside the title, the Evidence tab reads "Evidence (0)" and offers "Add evidence", and there is no separate
 * Evidence figure; the list says "Clear filters" only while a filter is on, at the end of the filter row, the month box
 * has its own small x that clears only the month, and an empty filtered list says what happened with a Clear filters
 * button. Every value is made up.
 * Sabotage: tests/sabotage/achievements.mjs "record-trail-repeats-the-list", "record-title-cut-on-a-phone",
 * "record-shows-evidence-twice", "evidence-tab-has-no-count-in-brackets", "month-x-clears-every-filter",
 * "empty-list-offers-no-way-out".
 */
import { expect, test, type Page } from '@playwright/test';
import { ensureAchievementPlan } from './support/achievement-plan';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test.beforeAll(ensureAchievementPlan);

const LONG =
  'TEST A very long made-up achievement title that keeps going well past what a phone card can hold on a line, and on, and on, until it needs five lines on a phone';

for (const [label, width, height] of [
  ['phone 375', 375, 800],
  ['desk 1440', 1440, 900],
] as const) {
  const phone = width < 640;

  test(`${label}: the record's title wraps, the trail does not repeat, No evidence is said once`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    const [cat] = await sql<{ code: string }>(
      `select c.code from perf.achievement_category c
       where c.active and c.deleted_at is null and c.required_ref_system_id is null and not c.has_deal_value
         and not c.sets_prospect order by c.code limit 1`,
    );
    const title = `${LONG} ${Math.random().toString(36).slice(2, 7)}`;
    const made = await callAs(page.context(), 'achievement_log', {
      p_values: { category: cat!.code, title, happened_on: new Date().toISOString().slice(0, 10) },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const id = (made.body as { id: string }).id;
    await page.goto(`/kpis/achievements/${id}`);
    await hydrated(page);

    // (1) the title: three lines at most, then a "more" tap that opens the rest; nothing sideways
    const measure = () =>
      page.locator('[data-record-title]').evaluate((el) => {
        const line = parseFloat(getComputedStyle(el).lineHeight);
        return {
          lines: Math.round(el.getBoundingClientRect().height / line),
          clamp: getComputedStyle(el).webkitLineClamp,
          wide: el.scrollWidth - el.clientWidth,
          right: document.documentElement.clientWidth - el.getBoundingClientRect().right,
        };
      });
    const h1 = await measure();
    expect(h1.wide, 'no line runs past the page sideways').toBeLessThanOrEqual(0);
    expect(h1.right, 'the title ends inside the screen').toBeGreaterThanOrEqual(0);
    expect(h1.lines, 'three lines at most before the tap').toBeLessThanOrEqual(3);
    const more = page.locator('[data-record-title-more]');
    if (phone) {
      expect(h1.clamp, 'the title is cut at three lines').toBe('3');
      await expect(more, 'a cut title offers More').toHaveText('More');
      await more.click();
      expect((await measure()).lines, 'More opens the rest').toBeGreaterThan(3);
      await expect(more).toHaveText('Show less');
      await more.click();
      expect((await measure()).lines, 'Show less closes it again').toBeLessThanOrEqual(3);
    }

    // (2) the trail: a PC says "Achievements / <number and title>" once, a phone has the arrow and no trail
    const crumbs = page.locator('nav[aria-label="Breadcrumb"]');
    const back = page.getByRole('link', { name: 'Achievements', exact: true }).first();
    if (phone) {
      await expect(crumbs, 'a phone has no trail').toBeHidden();
      await expect(
        page.getByRole('link', { name: 'Back to Achievements', exact: true }),
        'but the back arrow',
      ).toBeVisible();
    } else {
      await expect(crumbs).toBeVisible();
      const parts = await crumbs.locator('> span').allInnerTexts();
      expect(parts.length, 'two parts: the list and this record').toBe(2);
      expect(parts[0]!.replace('/', '').trim()).toBe('Achievements');
      expect(parts[1]!, 'the second part is this record: its number and title').toContain('ACH-');
      expect(parts[1]!).toContain('TEST A very long made-up');
      await expect(back).toBeVisible();
    }

    // (3) No evidence once, as the chip; the tab says Evidence (0); no Evidence figure
    await expect(page.getByText('No evidence', { exact: true }), 'No evidence is said once').toHaveCount(1);
    await expect(page.locator('[data-record-header] [data-tabs]')).toContainText('Evidence (0)');
    await expect(page.locator('[data-record-header]'), 'no separate Evidence figure').not.toContainText(/Evidence\s*0/);
    await page.getByRole('link', { name: /Evidence \(0\)/ }).click();
    await hydrated(page);
    await expect(page.getByRole('button', { name: 'Add evidence' })).toBeVisible();
    await expect(page.getByText('No evidence yet'), 'the empty tab does not say it again').toHaveCount(0);
    await expect(page.getByText('No evidence', { exact: true }), 'still once').toHaveCount(1);
  });

  test(`${label}: Clear filters shows only while a filter is on, the month has its own x, an empty list can be cleared`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    const row = page.locator('[data-achievement-filters]');
    const clearRow = row.getByRole('button', { name: 'Clear filters' });
    const clearMonth = page.locator('[data-clear-month]');

    const [cat] = await sql<{ code: string }>(
      `select c.code from perf.achievement_category c
       where c.active and c.deleted_at is null and c.required_ref_system_id is null and not c.has_deal_value
         and not c.sets_prospect order by c.code limit 1`,
    );
    const made = await callAs(page.context(), 'achievement_log', {
      p_values: {
        category: cat!.code,
        title: 'TEST one made-up achievement',
        happened_on: new Date().toISOString().slice(0, 10),
      },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const anyClear = page.getByRole('button', { name: 'Clear filters' });

    await page.goto('/kpis/achievements');
    await hydrated(page);
    await expect(clearRow, 'no filter, no Clear filters').toHaveCount(0);
    await expect(clearMonth, 'no month, no x').toHaveCount(0);

    // results showing with a filter on: the row button stays, last in the row, and it is the only one
    await page.goto('/kpis/achievements?mine=1');
    await hydrated(page);
    await expect(page.locator('[data-achievement-list]')).toBeVisible();
    await expect(clearRow).toBeVisible();
    const last = await row.evaluate((el) => (el.lastElementChild as HTMLElement).textContent);
    expect(last, 'Clear filters is the last thing in the filter row').toBe('Clear filters');
    await expect(anyClear, 'with results, Clear filters shows once').toHaveCount(1);

    // nothing matches: only the button inside the empty box shows; the row one hides
    await page.goto('/kpis/achievements?mine=1&month=2000-01');
    await hydrated(page);
    await expect(
      page.getByText('No achievements match these filters'),
      'an empty filtered list says why',
    ).toBeVisible();
    await expect(page.locator('[data-achievement-list]')).toHaveCount(0);
    await expect(clearRow, 'the row button hides while the empty box is up').toHaveCount(0);
    await expect(anyClear, 'with nothing matching, Clear filters shows once').toHaveCount(1);
    await expect(page.locator('[data-clear-filters]')).toBeVisible();
    await expect(clearMonth).toBeVisible();
    await clearMonth.click();
    await expect(page, 'the x clears the month and keeps Mine').toHaveURL(/mine=1/);
    await expect(page).not.toHaveURL(/month=/);
    await expect(clearRow, 'Mine is still a filter').toBeVisible();

    // the empty state's own button clears every filter
    await page.goto('/kpis/achievements?mine=1&month=2000-01');
    await hydrated(page);
    await page.locator('[data-clear-filters]').click();
    await expect(page).toHaveURL(/\/kpis\/achievements$/);
    await expect(anyClear).toHaveCount(0);
  });
}
