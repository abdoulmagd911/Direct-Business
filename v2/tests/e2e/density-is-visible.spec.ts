/**
 * V644 (1): Density is visible. Compact makes the rows of the list screens (My day, Tasks) shorter from 640 px up, and
 * tightens their spacing on a phone, where nothing falls under 44 px (V643). Measured as the height of one row at each
 * setting. Every value is made up. Sabotages: tests/sabotage/density.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, sql } from './support/stack';
import { seed, small } from './support/taps';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

async function rowHeights(page: Page, personId: string, density: 'comfortable' | 'compact', note: string) {
  await sql(
    `insert into core.person_profile (person_id, created_by, density) values ($1, $1, $2)
     on conflict (person_id) do update set density = excluded.density`,
    [personId, density],
  );
  await page.context().addCookies([{ name: 'v2.density', value: density, url: new URL(page.url()).origin }]);
  await page.goto('/my-day');
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-density', density);
  const high = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => e.getBoundingClientRect().height);
  const myDayTask = await high('[data-today-task]');
  const myDayNote = await high(`[data-my-note]:has-text("${note}")`);
  await page.goto('/tasks');
  await hydrated(page);
  const tasksRow = await high('[data-task-row]');
  return { myDayTask, myDayNote, tasksRow, tapsUnder44: density === 'compact' ? await small(page) : [] };
}

for (const [width, wide] of [
  [1440, true],
  [375, false],
] as const) {
  test(`Compact makes the My day and Tasks rows tighter than Comfortable — at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { me } = await seed(page);
    const note = `Dense note ${Math.random().toString(36).slice(2, 8)}`;
    const made = await callAs(page.context(), 'note_capture', {
      p_kind: 'sticky',
      p_values: { title: note, visibility: 'private' },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);

    const roomy = await rowHeights(page, me.id, 'comfortable', note);
    const tight = await rowHeights(page, me.id, 'compact', note);
    const gain = wide ? 12 : 4;
    for (const [name, a, b] of [
      ['a My day task row', roomy.myDayTask, tight.myDayTask],
      ['a My day note row', roomy.myDayNote, tight.myDayNote],
      ['a Tasks list row', roomy.tasksRow, tight.tasksRow],
    ] as const) {
      expect(a - b, `Compact makes ${name} at least ${gain} px shorter (${a} → ${b})`).toBeGreaterThanOrEqual(gain);
    }
    if (!wide) expect(tight.tapsUnder44, 'on a phone nothing is under 44 px in Compact').toEqual([]);
  });
}
