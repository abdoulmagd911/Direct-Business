/**
 * Landing 35, item 4 (the owner's sweep of 21 Nov): Today's three fills 3 + 3 + 3. A person with nine own open tasks
 * and NOT ONE starred or due soon — the case that read 0 + 0 + 3 — sees three tasks in each group: a group short of
 * three is topped up from the person's other own open tasks (Important with the longest overdue, Short with the next
 * due days), no task twice, and a second load draws the same nine. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);
const GROUPS = ['important', 'short', 'maintenance'] as const;

async function drawn(page: Page) {
  const out: Record<string, string[]> = {};
  for (const g of GROUPS)
    out[g] = await page
      .locator(`[data-todays-three] [data-three-group="${g}"] [data-three-row]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-three-row') ?? ''));
  return out;
}

test('nine own open tasks, none starred and none due soon, still read 3 + 3 + 3 — the same on a second load', async ({
  page,
}) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `t3_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  const make = async (title: string, offset: number | null) => {
    const number = `TSK-1998-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await sql(
      `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on)
       values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
               (select id from work.task_status where is_default and deleted_at is null), 'internal', $3,
               case when $5::int is null then null else core.riyadh_today() + $5::int end)`,
      [number, title, me.id, team!.id, offset],
    );
    return number;
  };
  // three long overdue, three due well ahead, three with no due day: by the rule alone all nine are Maintenance
  const overdue = [await make(`Old A ${t}`, -30), await make(`Old B ${t}`, -20), await make(`Old C ${t}`, -10)];
  const ahead = [await make(`Ahead A ${t}`, 10), await make(`Ahead B ${t}`, 20), await make(`Ahead C ${t}`, 30)];
  const undated = [
    await make(`Undated A ${t}`, null),
    await make(`Undated B ${t}`, null),
    await make(`Undated C ${t}`, null),
  ];
  undated.sort();

  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('[data-todays-three]'), "Today's three is on My day").toBeVisible();
  for (const g of GROUPS)
    await expect(
      page.locator(`[data-todays-three] [data-three-group="${g}"] [data-three-row]`),
      `${g} is filled to three`,
    ).toHaveCount(3);
  const first = await drawn(page);
  expect(first.important, 'Important is topped up with the longest overdue').toEqual(overdue);
  expect(first.short, 'Short is topped up with the next due days ahead').toEqual(ahead);
  expect(first.maintenance, 'Maintenance is what is left').toEqual(undated);
  expect(new Set(GROUPS.flatMap((g) => first[g]!)).size, 'no task is drawn twice').toBe(9);

  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-todays-three] [data-three-row]'), 'nine again').toHaveCount(9);
  expect(await drawn(page), 'a second load draws the same nine in the same places').toEqual(first);
});
