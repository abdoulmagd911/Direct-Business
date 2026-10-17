/**
 * The top search finds more than organisations (the supervisor's relay of 17 Oct): a task the reader may see is found
 * by its title and opens at its number, at 375 and 1,440 px. A member of another department finds nothing of it — the
 * same row rule as the task's own page (LINK-02). Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "search-box-shows-no-tasks".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => `ferro${Math.random().toString(36).slice(2, 7)}`;

for (const width of [375, 1440]) {
  test(`search finds a task by its title and opens it — at ${width} px`, async ({ page, browser }) => {
    const member = await makePerson();
    const t = tag();
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [member.id, `st_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    const made = await callAs(page.context(), 'task_create', { p_values: { title: `Made-up ${t} visa pack` } });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const { id, number } = made.body as { id: string; number: string };

    await page.locator('[data-search]').click();
    await page.locator('[data-command-palette]').getByPlaceholder('Go to a page or search…').fill(t);
    const row = page.locator(`[data-palette-task="${id}"]`);
    await expect(row, 'the task is found by its title').toBeVisible();
    await expect(row).toContainText(number);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${number}$`));

    // someone in another department finds nothing of it
    const [dept] = await sql<{ id: string }>(
      `insert into core.department (code, name_en, name_ar) values ('test_far_desk', 'Test Far Desk', 'قسم بعيد')
       on conflict (code) do update set name_en = excluded.name_en returning id`,
    );
    const far = await makePerson();
    await sql(`update core.person set department_id = $2 where id = $1`, [far.id, dept!.id]);
    const other = await browser.newPage();
    await other.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(other, far.email, '/my-day');
    await hydrated(other);
    await other.locator('[data-search]').click();
    await other.locator('[data-command-palette]').getByPlaceholder('Go to a page or search…').fill(t);
    await expect(other.locator('[data-command-palette]').getByText('Nothing matches')).toBeVisible();
    await expect(other.locator('[data-palette-task]'), 'another department finds nothing of it').toHaveCount(0);
    await other.close();
  });
}
