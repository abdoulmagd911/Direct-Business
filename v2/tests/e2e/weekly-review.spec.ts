/**
 * Productivity stage 3 — the Thursday weekly review (V632), at /my-day/week: my own week on one screen. Done, Slipped
 * (with how often each item was carried), Due next week and My notes this week, each with its count; a row opens its
 * task or note. Phone first: at 375 and 1,440 px, no sideways scroll, every row a 44 px target. A week with nothing in
 * it says so once. A private note is its author's alone (V454): a colleague who is an admin sees nothing of it.
 * Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

async function personWithTeam() {
  const me = await makePerson();
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `wr_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  /** A task of mine due `due` (SQL, Riyadh days); closed as Done when `done`. */
  const make = async (title: string, due: string, done = false) => {
    const number = `TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    await sql(
      `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on,
                              closed_at, closed_by)
       values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
               (select id from work.task_status where deleted_at is null
                  and case when $5::boolean then meaning = 'done' else is_default end limit 1),
               'internal', $3, ${due}, case when $5::boolean then now() end, case when $5::boolean then $3::uuid end)`,
      [number, title, me.id, team!.id, done],
    );
    const [row] = await sql<{ id: string }>(`select id from work.task where number = $1`, [number]);
    return { number, id: row!.id };
  };
  return { me, t, make };
}

for (const width of [375, 1440]) {
  test(`the weekly review shows my done, slipped, next and notes, and opens a row — at ${width} px`, async ({
    page,
  }) => {
    const { me, t, make } = await personWithTeam();
    await make(`Finished call ${t}`, 'core.riyadh_today()', true);
    const late = await make(`Late visit ${t}`, 'core.riyadh_today() - 9');
    const moved = await make(`Moved quote ${t}`, 'core.riyadh_today()');
    await make(`Next week offer ${t}`, 'my.week_start(core.riyadh_today()) + 8');
    await page.setViewportSize({ width, height: width === 375 ? 800 : 1000 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const note = await callAs(page.context(), 'note_capture', {
      p_kind: 'idea',
      p_values: { title: `Private idea ${t}` },
    });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
    const wrap = await callAs(page.context(), 'wrap_up', {
      p_items: [{ kind: 'task', id: moved.id, choice: 'tomorrow' }],
    });
    expect(wrap.status, JSON.stringify(wrap.body)).toBe(200);

    await page.goto('/my-day/week');
    await hydrated(page);
    const review = page.locator('[data-weekly-review]');
    await expect(review).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Weekly review');
    const section = (s: string) => review.locator(`[data-review-section="${s}"]`);
    await expect(section('done')).toContainText(`Finished call ${t}`);
    await expect(section('done').locator('[data-review-count]')).toHaveText('1');
    await expect(section('slipped')).toContainText(`Late visit ${t}`);
    await expect(section('slipped')).toContainText(`Moved quote ${t}`);
    await expect(
      section('slipped').locator(`[data-review-id="${moved.id}"] [data-review-times="1"]`),
      'how often it was carried',
    ).toHaveText('Carried once');
    await expect(section('next')).toContainText(`Next week offer ${t}`);
    await expect(section('notes')).toContainText(`Private idea ${t}`);

    const row = await section('slipped').locator(`[data-review-id="${late.id}"] a`).boundingBox();
    expect(row!.height, 'a row is a 44 px target').toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);

    await section('slipped').locator(`[data-review-id="${late.id}"] a`).click();
    await page.waitForURL(new RegExp(`/tasks/${late.number}$`));
  });
}

test('a week with nothing in it says so once', async ({ page }) => {
  const me = await makePerson();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day/week');
  await hydrated(page);
  await expect(page.locator('[data-state="empty"]')).toHaveText('Nothing done, slipped or due this week yet');
  await expect(page.locator('[data-review-section]')).toHaveCount(0);
});

test('a private note on my review is not on an admin colleague’s (V454)', async ({ browser }) => {
  const { me, t } = await personWithTeam();
  const admin = await makePerson({ admin: true });
  const mine = await browser.newPage();
  await signIn(mine, me.email, '/my-day');
  await hydrated(mine);
  const note = await callAs(mine.context(), 'note_capture', {
    p_kind: 'idea',
    p_values: { title: `Secret plan ${t}` },
  });
  expect(note.status, JSON.stringify(note.body)).toBe(200);
  await mine.goto('/my-day/week');
  await expect(mine.locator('[data-review-section="notes"]')).toContainText(`Secret plan ${t}`);

  const theirs = await browser.newPage();
  await signIn(theirs, admin.email, '/my-day/week');
  await hydrated(theirs);
  await expect(theirs.locator('h1')).toHaveText('Weekly review');
  await expect(theirs.locator('main')).not.toContainText(`Secret plan ${t}`);
  await mine.close();
  await theirs.close();
});
