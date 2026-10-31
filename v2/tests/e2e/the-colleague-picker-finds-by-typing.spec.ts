/**
 * The colleague picker of a note shared with named colleagues: the person types a name and the list narrows to the names
 * that fit; one press adds a name and the box clears for the next; a name already chosen is not offered again; a name that
 * fits no one says so. On a phone every name is a 44 px target and nothing spills sideways. At 375 and 1,440 px. Every
 * value is made up. Sabotages: tests/sabotage/colleague-picker.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [375, 1440]) {
  test(`the colleague picker narrows as the person types and adds several names — at ${width} px`, async ({ page }) => {
    const author = await makePerson({});
    const first = await makePerson({});
    const second = await makePerson({});
    const other = await makePerson({});
    const nameOf = async (id: string) =>
      (await sql<{ name: string }>(`select full_name_en as name from core.person where id = $1`, [id]))[0]!.name;
    const [firstName, secondName, otherName] = [
      await nameOf(first.id),
      await nameOf(second.id),
      await nameOf(other.id),
    ];
    const t = Math.random().toString(36).slice(2, 8);
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [author.id, `cp_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [author.id, team!.id]);

    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, author.email, '/my-day');
    await hydrated(page);
    const made = await callAs(page.context(), 'note_capture', {
      p_kind: 'sticky',
      p_values: { title: `Made-up ${t} to share` },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await page.goto(`/my-day/notes/${(made.body as { id: string }).id}`);
    await hydrated(page);
    await page.getByLabel('Who sees it').click();
    await page.getByRole('option', { name: 'Named colleagues' }).click();

    const search = page.locator('[data-people-search]');
    const hit = (id: string) => page.locator(`[data-people-hit="${id}"]`);
    // typing the end of a name (its code) shows that colleague and not the others
    await search.fill(firstName.slice(-8));
    await expect(hit(first.id), 'the name that fits is offered').toBeVisible();
    await expect(hit(second.id), 'a name that does not fit is not').toHaveCount(0);
    expect(
      await hit(first.id).evaluate((e) => Math.round(e.getBoundingClientRect().height * 10) / 10),
      'a name is a 44 px target on a phone and compact on a wide screen',
    ).toBeGreaterThanOrEqual(width < 700 ? 43.5 : 0);
    await hit(first.id).click();
    await expect(search, 'the box clears for the next name').toHaveValue('');
    await expect(page.locator('[data-people-hits]'), 'the list closes after a pick').toHaveCount(0);

    // the next one: the first is no longer offered
    await search.fill(secondName.slice(-8));
    await expect(hit(second.id)).toBeVisible();
    await hit(second.id).click();
    await search.click();
    await expect(hit(first.id), 'a name already chosen is not offered again').toHaveCount(0);
    await expect(hit(second.id)).toHaveCount(0);
    await expect(hit(other.id), 'the others are still offered').toBeVisible();
    await expect(page.locator('[data-shared-person]'), 'both are on the list').toHaveCount(2);

    // a name that fits no one says so
    await search.fill('zzzqqq');
    await expect(page.locator('[data-people-hits]'), 'no colleague with that name').toContainText(
      'No colleague with that name',
    );
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'nothing spills sideways',
    ).resolves.toBe(true);
  });
}
