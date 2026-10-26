/**
 * G (26 Oct): a note's author shares it with one named colleague from the note's page. Who sees it: One colleague,
 * then the colleague by name, then Save. That colleague opens the note and reads it; the author's own teammate finds
 * nothing there. At 1280 px and 375 px. Every value is made up.
 * Sabotage: supabase/tests/sabotage/a-shared-note-reaches-its-authors-team.sql (the read rule), and
 * tests/sabotage/note-share.mjs (the page).
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [1280, 375]) {
  test(`a note shared with one colleague is theirs to read and no one else's — at ${width} px`, async ({
    page,
    browser,
  }) => {
    const author = await makePerson({});
    const named = await makePerson({});
    const mate = await makePerson({});
    const t = Math.random().toString(36).slice(2, 8);
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [author.id, `share_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id in ($1, $3)`, [author.id, team!.id, mate.id]);
    const namedName = (
      await sql<{ name: string }>(`select full_name_en as name from core.person where id = $1`, [named.id])
    )[0]!.name;

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
    await page.getByRole('option', { name: 'One colleague' }).click();
    await page.getByLabel('Shared with').click();
    await page.getByRole('option', { name: namedName }).click();
    await page.locator('[data-note-save]').click();
    await expect(
      page.locator('[data-note-page] [data-visibility="person"]'),
      'the note says it is shared with one',
    ).toBeVisible();

    const theirs = await browser.newContext();
    const seen = await theirs.newPage();
    await seen.setViewportSize({ width, height: 1000 });
    await signIn(seen, named.email, `/my-day/notes/${id}`);
    await hydrated(seen);
    await expect(seen.locator('[data-note-page]'), 'the named colleague opens it').toBeVisible();
    await expect(seen.getByRole('heading', { level: 1 })).toContainText('Made-up words');
    await theirs.close();

    const other = await browser.newContext();
    const not = await other.newPage();
    await not.setViewportSize({ width, height: 1000 });
    await signIn(not, mate.email, `/my-day/notes/${id}`);
    await hydrated(not);
    await expect(not.locator('[data-note-page]'), "the author's teammate finds nothing").toHaveCount(0);
    await other.close();
  });
}
