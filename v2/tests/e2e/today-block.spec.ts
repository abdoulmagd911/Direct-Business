/**
 * Productivity stage 1 — the Today block at the top of My day (Me tab): my tasks as Overdue (with its count), Today and
 * Next; a row has a done tick (with Undo), the title, the client chip and the due day, and a tap on it opens the task;
 * with nothing due it says "Nothing due today". Phone first: at 375 and 1,440 px, no sideways scroll, the tick and the
 * row are 44 px high at least. Arabic and English read the same catalog words. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

async function personWithTasks() {
  const me = await makePerson({ admin: true });
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `td_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  const make = async (title: string, offset: number) => {
    const number = `TSK-1999-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await sql(
      `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on)
       values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
               (select id from work.task_status where is_default and deleted_at is null), 'internal', $3,
               core.riyadh_today() + $5::int)`,
      [number, title, me.id, team!.id, offset],
    );
    return number;
  };
  return { me, t, make };
}

for (const width of [375, 1440]) {
  test(`the Today block sorts my tasks into its four boxes, stars one, ticks one done with Undo and opens one — at ${width} px`, async ({
    page,
  }) => {
    const { me, t, make } = await personWithTasks();
    const late = await make(`Late task ${t}`, -2);
    const due = await make(`Due task ${t}`, 0);
    await make(`Soon task ${t}`, 1);
    await make(`Later task ${t}`, 5);
    await page.setViewportSize({ width, height: width === 375 ? 800 : 1000 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const org = `Test Org ${t}`;
    const made = await callAs(page.context(), 'partner_create', {
      p_partner: { trade_name_en: org, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await sql(`update work.task set partner_id = $2, work_type = 'client', starred = true where number = $1`, [
      late,
      (made.body as { id: string }).id,
    ]);
    await page.reload();
    await hydrated(page);
    const block = page.locator('[data-today-block]');
    await expect(block.locator(`[data-today-task="${late}"]`), 'the client chip').toContainText(org);
    await expect(block).toBeVisible();
    // the card is titled Today and its groups never just that (QA-564): the four boxes of V661 — starred and overdue is Do now
    await expect(block.locator('h2')).toHaveText('Today');
    await expect(block.locator('h3'), 'the boxes, in order, with the empty ones left out').toHaveText([
      /^Do now\s*1$/,
      /^Quick or hand off\s*2$/,
      /^Later\s*1$/,
    ]);
    expect(await block.getByText('Today', { exact: true }).count(), 'the word Today is the card title only').toBe(1);
    await expect(block.locator('[data-today-group="do_now"]')).toContainText(`Late task ${t}`);
    await expect(block.locator('[data-today-group="quick"]')).toContainText(`Due task ${t}`);
    await expect(block.locator('[data-today-group="later"]')).toContainText(`Later task ${t}`);
    // the star is a 44 px target, on for the starred task and off for the others
    const star = block.locator(`[data-today-task="${late}"] button[data-star]`);
    await expect(star).toHaveAttribute('data-star', 'on');
    const starBox = await star.boundingBox();
    expect(starBox!.width, 'the star is a 44 px target').toBeGreaterThanOrEqual(44);
    expect(starBox!.height).toBeGreaterThanOrEqual(44);
    // starring a task that is due today moves it from Quick or hand off to Do now
    await block.locator(`[data-today-task="${due}"] button[data-star]`).click();
    await expect(block.locator('[data-today-group="do_now"]'), 'a starred, urgent task joins Do now').toContainText(
      `Due task ${t}`,
    );
    await expect(block.locator('[data-today-task]').first().locator('[data-done-tick]')).toBeVisible();
    const tick = await block.locator('[data-done-tick]').first().boundingBox();
    expect(tick!.width, 'the tick is a 44 px target').toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);

    // the check marks it done, with Undo
    await block.locator(`[data-today-task="${late}"] [data-done-tick]`).click();
    await page.locator('[data-confirm-action]').click(); // the Mark done? box (V641)
    const toast = page.locator('[data-sonner-toast][data-front="true"]');
    await expect(toast).toBeVisible();
    await expect(block.locator(`[data-today-task="${late}"]`), 'done leaves the list').toHaveCount(0);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(block.locator(`[data-today-task="${late}"]`), 'Undo brings it back').toHaveCount(1);

    // a tap on the row opens the task
    await block.locator(`[data-today-task="${late}"] [data-today-open]`).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${late}$`));
  });
}

test('with nothing due the block says so', async ({ page }) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('[data-today-block]')).toContainText('Nothing due today');
});
