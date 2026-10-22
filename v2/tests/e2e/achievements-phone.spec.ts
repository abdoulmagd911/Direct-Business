/**
 * The Achievements list on a phone (the owner's screenshots, the Architect's order of 22 Oct), at 375 and 320 px, and
 * at 1,440 px for the same page: a long title is cut with an ellipsis inside its card, never past either edge, and the
 * page never scrolls sideways; the month box says what it is ("Month") and what it holds when empty ("Any month"),
 * never only dashes; Backfilled, Past work and Needs owner are switches with a one-line meaning, on or off, that reach
 * the address. Every value is made up.
 * Sabotage: tests/sabotage/achievements.mjs "list-row-centres-its-title", "month-box-is-only-dashes",
 * "list-switches-explain-nothing".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** Commercial's plan for this Riyadh year with its starting categories — opened once, whichever spec comes first. */
async function plan() {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري') on conflict (code) do nothing`,
  );
  await sql(
    `do $$
     declare
       d uuid := (select id from core.department where code = 'commercial');
       y int := extract(year from now() at time zone 'Asia/Riyadh')::int;
       p uuid;
     begin
       if perf.plan_of(d, y) is null then
         begin
           insert into perf.plan (department_id, year, name) values (d, y, 'Made-up plan ' || y) returning id into p;
           perform perf.categories_seed(p);
         exception when unique_violation then null;
         end;
       end if;
     end $$`,
  );
}

test.beforeAll(plan);

const TITLES = [
  'TEST Corporate Client 16Oct',
  'TEST Negotiated 12% lower group rate',
  'TEST A very long made-up achievement title that keeps going well past what a phone card can hold on one line',
  'TEST Unbroken' + 'x'.repeat(90),
];

for (const [label, width, height] of [
  ['phone 375', 375, 800],
  ['phone 320', 320, 700],
  ['desk 1440', 1440, 900],
] as const) {
  test(`${label}: a long title is cut inside its card, the month box and the three switches say what they are`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    // the category that needs no reference or deal value, found in the plan this spec opened
    const [cat] = await sql<{ code: string }>(
      `select c.code from perf.achievement_category c
       where c.active and c.deleted_at is null and c.required_ref_system_id is null and not c.has_deal_value
         and not c.sets_prospect order by c.code limit 1`,
    );
    expect(cat, 'the plan has a category that needs nothing extra').toBeTruthy();
    const tag = Math.random().toString(36).slice(2, 7);
    const titles = TITLES.map((t) => `${t} ${tag}`);
    // logged through the app's own door, as the signed-in admin
    const ctx = page.context();
    for (const title of titles) {
      const r = await callAs(ctx, 'achievement_log', {
        p_values: { category: cat!.code, title, happened_on: new Date().toISOString().slice(0, 10) },
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    await page.goto('/kpis/achievements?mine=1');
    await hydrated(page);

    // (1) every card keeps its title inside both edges, start-aligned, with an ellipsis where it is cut
    for (const title of titles) {
      const row = page.locator('[data-achievement-row]', { hasText: title });
      await expect(row).toHaveCount(1);
      const found = await row.evaluate((li) => {
        const card = li.getBoundingClientRect();
        const t = li.querySelector('span.truncate') as HTMLElement;
        const r = t.getBoundingClientRect();
        return {
          left: r.left - card.left,
          right: card.right - r.right,
          cut: t.scrollWidth > t.clientWidth,
          ellipsis: getComputedStyle(t).textOverflow,
        };
      });
      expect(found.left, `${title}: starts inside the card's left edge`).toBeGreaterThanOrEqual(0);
      expect(found.left, `${title}: starts at the card's padding, not centred`).toBeLessThanOrEqual(20);
      expect(found.right, `${title}: ends inside the card's right edge`).toBeGreaterThanOrEqual(0);
      if (found.cut) expect(found.ellipsis, `${title}: a cut title ends in an ellipsis`).toBe('ellipsis');
    }
    const sideways = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      main: (() => {
        const el = document.querySelector('[data-page]') as HTMLElement;
        return el.scrollWidth - el.clientWidth;
      })(),
    }));
    expect(sideways.page, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
    expect(sideways.main, 'nor does the page area').toBeLessThanOrEqual(0);

    // (2) the month box is labelled, and says what it holds while empty
    const month = page.locator('[data-month-filter]');
    await expect(month, 'the month box is labelled').toContainText('Month');
    await expect(month, 'an empty month box says Any month, not only dashes').toContainText('Any month');
    await month.locator('input').fill('2026-10');
    await expect(page).toHaveURL(/month=2026-10/);
    await expect(page.locator('[data-month-filter]'), 'a chosen month hides the hint').not.toContainText('Any month');
    await page.goto('/kpis/achievements');
    await hydrated(page);

    // (3) the three switches say what they are and mean, and reach the address
    for (const [key, name, meaning] of [
      ['backfilled', 'Backfilled', 'Added later from earlier records'],
      ['past', 'Past work', 'From before the app went live'],
      ['needsOwner', 'Needs owner', 'No owner is named yet'],
    ] as const) {
      const row = page.locator(`[data-achievement-switch="${key}"]`);
      await expect(row, `${name} has a name`).toContainText(name);
      await expect(row, `${name} says what it means`).toContainText(meaning);
      await expect(row.getByRole('switch'), `${name} starts off`).toHaveAttribute('aria-checked', 'false');
    }
    await page.locator('[data-achievement-switch="backfilled"]').getByRole('switch').click();
    await expect(page).toHaveURL(/backfilled=1/);
    await expect(
      page.locator('[data-achievement-switch="backfilled"]').getByRole('switch'),
      'Backfilled is on, and shows it',
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-achievement-switch="past"]').getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
}
