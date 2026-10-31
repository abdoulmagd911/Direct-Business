/**
 * G (26 Oct), V524 (several): a note's author shares it with named colleagues from the note's page. Who sees it: Named
 * colleagues, then each colleague by name from Add a colleague, then Save. Each colleague opens the note and reads it,
 * and finds themselves on its list as "You" (QA-594); the author's own teammate finds nothing there. The colleague's
 * bell says who shared it and the note's title. At 1280 px and 375 px. Every value is made up.
 * Sabotage: supabase/tests/sabotage/a-shared-note-reaches-its-authors-team.sql (the read rule), and
 * tests/sabotage/note-share.mjs (the page).
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [1280, 375]) {
  test(`a note shared with named colleagues is theirs to read and no one else's — at ${width} px`, async ({
    page,
    browser,
  }) => {
    const author = await makePerson({});
    const named = await makePerson({});
    const second = await makePerson({});
    const mate = await makePerson({});
    const t = Math.random().toString(36).slice(2, 8);
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [author.id, `share_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id in ($1, $3)`, [author.id, team!.id, mate.id]);
    const nameOf = async (id: string) =>
      (await sql<{ name: string }>(`select full_name_en as name from core.person where id = $1`, [id]))[0]!.name;
    const namedName = await nameOf(named.id);
    const secondName = await nameOf(second.id);

    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, author.email, '/my-day');
    await hydrated(page);
    const title = `Made-up words for one colleague ${t}`;
    const made = await callAs(page.context(), 'note_capture', { p_kind: 'sticky', p_values: { title } });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const id = (made.body as { id: string }).id;
    await page.goto(`/my-day/notes/${id}`);
    await hydrated(page);

    await page.getByLabel('Who sees it').click();
    await page.getByRole('option', { name: 'Named colleagues' }).click();
    await page.getByLabel('Add a colleague').click();
    await page.getByRole('option', { name: namedName }).click();
    await page.getByLabel('Add a colleague').click();
    await page.getByRole('option', { name: secondName }).click();
    await expect(page.locator('[data-shared-person]'), 'both colleagues are on the list').toHaveCount(2);
    await page.locator('[data-note-save]').click();
    await expect(
      page.locator('[data-note-page] [data-visibility="person"]'),
      'the note says it is shared with named colleagues',
    ).toBeVisible();

    const theirs = await browser.newContext();
    const seen = await theirs.newPage();
    await seen.setViewportSize({ width, height: 1000 });
    await signIn(seen, named.email, `/my-day/notes/${id}`);
    await hydrated(seen);
    await expect(seen.locator('[data-note-page]'), 'the named colleague opens it').toBeVisible();
    await expect(seen.getByRole('heading', { level: 1 })).toContainText('Made-up words');
    await expect(seen.locator('[data-shared-with]'), 'the colleague finds themselves on the list as You').toContainText(
      'You',
    );
    await expect(seen.locator('[data-shared-with]'), 'beside the other colleague by name').toContainText(secondName);
    await seen.locator('[data-bell]').click();
    await expect(seen.locator('[data-notifications-panel]'), 'the bell says who shared which note').toContainText(
      `${await nameOf(author.id)} shared a note with you: ${title}`,
    );
    await theirs.close();

    const also = await browser.newContext();
    const two = await also.newPage();
    await two.setViewportSize({ width, height: 1000 });
    await signIn(two, second.email, `/my-day/notes/${id}`);
    await hydrated(two);
    await expect(two.locator('[data-note-page]'), 'the second colleague opens it too').toBeVisible();
    await also.close();

    const other = await browser.newContext();
    const not = await other.newPage();
    await not.setViewportSize({ width, height: 1000 });
    await signIn(not, mate.email, `/my-day/notes/${id}`);
    await hydrated(not);
    await expect(not.locator('[data-note-page]'), "the author's teammate finds nothing").toHaveCount(0);
    await other.close();
  });
}
