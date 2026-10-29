/**
 * D (26 Oct): an open task past its due day tells its owner once, and the bell says "<task> is overdue", not "is coming
 * due". The notice is put straight into the bell here (the daily job that makes it is PAST-03's). Every value is made up.
 * Sabotage: tests/sabotage/open-items.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('an overdue task says "is overdue" in its owner\'s bell', async ({ page }) => {
  const me = await makePerson();
  const tag = Math.random().toString(36).slice(2, 8);
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `od_${tag}`, `Test Team ${tag}`, `فريق اختبار ${tag}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  const number = `TSK-1999-${Date.now()}`;
  const [task] = await sql<{ id: string }>(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on)
     values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
             (select id from work.task_status where is_default and deleted_at is null limit 1), 'internal', $3,
             core.riyadh_today() - 3)
     returning id`,
    [number, `Made-up late call ${tag}`, me.id, team!.id],
  );
  await sql(
    `select notify.push($1, 'alert_due_tomorrow', 'work.task', $2, 'alert.overdue',
                        jsonb_build_object('number', $3::text, 'title', $4::text))`,
    [me.id, task!.id, number, `Made-up late call ${tag}`],
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-bell]').click();
  await expect(page.locator('[data-notifications-panel]'), 'the bell says it is overdue').toContainText(
    `${number} · Made-up late call ${tag} is overdue`,
  );
});
