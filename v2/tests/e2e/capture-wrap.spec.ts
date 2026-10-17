/**
 * Productivity stage 1, PR 2 — Quick capture from anywhere and Wrap up v2.
 * Quick capture: the Create menu (wide), the phone + and Ctrl K open one sheet on whatever page the person is on; Note,
 * Idea, Checklist and Reminder (a Reminder asks "when"); Only me is chosen; one tap files it and the person is still on
 * the same page. Wrap up: today's tasks and captures, each Done or Not done (Tomorrow already chosen, Next week, Drop);
 * one Save moves the lot as one request, one Undo puts it all back. The morning after, the Today block says what was
 * carried over. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const tag = () => Math.random().toString(36).slice(2, 8);

/**
 * What the Tomorrow choice is called today in Riyadh: "Tomorrow", or the day's own name ("Sunday") from a Thursday, a
 * Friday or a Saturday, when the next working day is not tomorrow. The unit tests pin the fixed dates; the browser specs
 * follow whichever day they run on.
 */
async function tomorrowWord() {
  const [d] = await sql<{ name: string | null }>(
    `select case when core.next_working_day(core.riyadh_today()) = core.riyadh_today() + 1 then null
                 else trim(to_char(core.next_working_day(core.riyadh_today()), 'FMDay')) end as name`,
  );
  return d!.name;
}

async function personWithTeam() {
  const me = await makePerson({ admin: true });
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `cw_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  const make = async (title: string, offset: number) => {
    const number = `TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`;
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

/** Opens the sheet the way the screen size offers it: the top bar's Create on a wide screen, the + on a phone. */
async function openSheet(page: Page, wide: boolean) {
  // the last toast sits over the phone's + for its 5 seconds (a toast under the pointer waits; a finger leaves)
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 9000 });
  await page.locator(wide ? '[data-create]' : '[data-create-bar]').click();
  await page.locator('[data-create-item="capture"]').click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
}

for (const width of [375, 1440]) {
  test(`Quick capture from another page files a note, an idea, a checklist and a reminder and leaves the person where they were — at ${width} px`, async ({
    page,
  }) => {
    const { me, t } = await personWithTeam();
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, me.email, '/clients');
    await hydrated(page);
    const where = page.url();

    await openSheet(page, wide);
    await expect(page.locator('[data-quick-visibility="private"]'), 'Only me is chosen').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('[data-when]'), 'a plain note does not ask when').toHaveCount(0);
    await page.locator('[data-quick-text]').fill(`Plain note ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Note saved')).toBeVisible();
    await expect(page.locator('[data-quick-capture]')).toHaveCount(0);
    expect(page.url(), 'one tap saves and the person is still where they were').toBe(where);
    const [note] = await sql<{ visibility: string; idea: boolean }>(
      `select visibility, idea from my.note where person_id = $1 and title = $2`,
      [me.id, `Plain note ${t}`],
    );
    expect(note, 'filed').toBeTruthy();
    expect(note!.visibility, 'private').toBe('private');

    await openSheet(page, wide);
    await page.locator('[data-quick-kind="idea"]').click();
    await page.locator('[data-quick-text]').fill(`Idea ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Idea saved')).toBeVisible();
    const [idea] = await sql<{ idea: boolean }>(`select idea from my.note where person_id = $1 and title = $2`, [
      me.id,
      `Idea ${t}`,
    ]);
    expect(idea!.idea, 'marked as an idea').toBe(true);

    await openSheet(page, wide);
    await page.locator('[data-quick-kind="checklist"]').click();
    await page.locator('[data-quick-text]').fill(`Packing ${t}\nPassports\nChargers`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Checklist saved')).toBeVisible();
    const [list] = await sql<{ n: number }>(
      `select jsonb_array_length(items)::int as n from my.note where person_id = $1 and title = $2`,
      [me.id, `Packing ${t}`],
    );
    expect(list!.n, 'every further line is an item').toBe(2);

    await openSheet(page, wide);
    await page.locator('[data-quick-kind="reminder"]').click();
    await expect(page.locator('[data-when]'), 'a reminder asks when').toBeVisible();
    await page.locator('[data-quick-text]').fill(`Call back ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Reminder saved')).toBeVisible();
    const [rem] = await sql<{ n: number }>(
      `select count(*)::int as n from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
      [me.id, `Call back ${t}`],
    );
    expect(rem!.n, 'the reminder is set').toBe(1);
    expect(page.url()).toBe(where);
  });
}

test('Ctrl K offers Capture and opens the same sheet', async ({ page }) => {
  const { me } = await personWithTeam();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, me.email, '/clients');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('option', { name: 'Create · Capture', exact: true }).click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
});

test('Wrap up moves the day in one request: Done, Tomorrow by default, Next week, Drop — and one Undo puts it all back', async ({
  page,
}) => {
  const { me, t, make } = await personWithTeam();
  const late = await make(`Late task ${t}`, -1);
  const due = await make(`Due task ${t}`, 0);
  const third = await make(`Third task ${t}`, 0);
  const named = await tomorrowWord(); // null on a weekday: the word stays "Tomorrow"
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-wrap-open]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-wrap-item]', { hasText: `Late task ${t}` })).toBeVisible();
  const rowOf = (title: string) => dialog.locator('[data-wrap-item]', { hasText: title });
  // each move says the day it lands on, in the one date format (W-daily 13), the database's own days
  const [lands] = await sql<{ tomorrow: string; next_week: string }>(
    `select to_char(core.next_working_day(core.riyadh_today()), 'FMDD Mon YYYY') as tomorrow,
            to_char(my.next_week_day(core.riyadh_today()), 'FMDD Mon YYYY') as next_week`,
  );
  await expect(
    rowOf(`Due task ${t}`).locator('[data-wrap-lands-on="tomorrow"]'),
    'Tomorrow shows its date',
  ).toContainText(lands!.tomorrow);
  await expect(
    rowOf(`Due task ${t}`).locator('[data-wrap-lands-on="next_week"]'),
    'Next week shows its date in the same format as Tomorrow',
  ).toContainText(lands!.next_week);
  await expect(
    rowOf(`Due task ${t}`).locator('[data-wrap-move="tomorrow"]'),
    'Tomorrow is already chosen',
  ).toHaveAttribute('aria-checked', 'true');
  // at 375 px Tomorrow, Next week and Drop stay on one line, and each of the first two names the day it lands on
  const tops = await rowOf(`Due task ${t}`)
    .locator('[data-wrap-move]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops, 'three choices').toHaveLength(3);
  expect(new Set(tops).size, 'on one line').toBe(1);
  const clipped = await rowOf(`Due task ${t}`)
    .locator('[data-wrap-move]')
    .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(clipped, 'no choice is cut off by the year in its date').toBe(0);
  await expect(
    rowOf(`Due task ${t}`).locator('[data-wrap-move="tomorrow"]'),
    'Tomorrow is called by its day when the next working day is not tomorrow',
  ).toContainText(named ?? 'Tomorrow');
  await expect(
    dialog.locator('[data-wrap-save]'),
    'Save says what it will do, rows left alone going to tomorrow',
  ).toHaveText(`Save · 3 to ${named ?? 'tomorrow'}`);
  await rowOf(`Late task ${t}`).locator('[data-wrap-state="done"]').click();
  await rowOf(`Third task ${t}`).locator('[data-wrap-move="next_week"]').click();
  await expect(dialog.locator('[data-wrap-save]')).toHaveText(
    `Save · 1 to ${named ?? 'tomorrow'}, 1 next week, 1 done`,
  );
  await dialog.locator('[data-wrap-save]').click();
  await expect(toast(page, 'Day wrapped up')).toBeVisible();
  const state = async () =>
    sql<{ number: string; due_on: string; closed: boolean }>(
      `select number, due_on::text, (closed_at is not null) as closed from work.task where number = any($1) order by number`,
      [[late, due, third]],
    );
  const after = await state();
  const by = (n: string) => after.find((r) => r.number === n)!;
  expect(by(late).closed, 'Done closes it').toBe(true);
  const [days] = await sql<{ tomorrow: string; today: string }>(
    `select core.next_working_day(core.riyadh_today())::text as tomorrow, core.riyadh_today()::text as today`,
  );
  expect(by(due).due_on, 'Tomorrow is the next working day').toBe(days!.tomorrow);
  expect(by(third).due_on > days!.tomorrow, 'Next week is later still').toBe(true);

  await toast(page, 'Day wrapped up').getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(
      async () =>
        (await state())
          .map((r) => `${r.closed}:${r.due_on === days!.today}`)
          .sort()
          .join('|'),
      { message: 'one Undo puts all three back' },
    )
    .toContain('false:true');
  const back = await state();
  expect(back.find((r) => r.number === late)!.closed, 'the Done is undone').toBe(false);
  expect(back.find((r) => r.number === due)!.due_on, 'the move is undone').toBe(days!.today);
});

test('the morning after, the Today block says what was carried over', async ({ page }) => {
  const { me, t, make } = await personWithTeam();
  const number = await make(`Carried task ${t}`, 0);
  await sql(
    `insert into my.carry (person_id, entity_table, entity_id, choice, wrapped_on, carried_from, carried_to, created_by)
     select $1, 'work.task', id, 'tomorrow', core.riyadh_today() - 1, core.riyadh_today() - 1, core.riyadh_today(), $1
     from work.task where number = $2`,
    [me.id, number],
  );
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('[data-today-carried]')).toHaveText('Carried over from yesterday (1)');
});

test('a Save refused because a task changed hands names it, keeps the other choices and saves the rest on one more tap', async ({
  page,
}) => {
  const { me, t, make } = await personWithTeam();
  const lost = await make(`Lost task ${t}`, 0);
  const kept = await make(`Kept task ${t}`, 0);
  const other = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-wrap-open]').click();
  const dialog = page.getByRole('dialog');
  const rowOf = (title: string) => dialog.locator('[data-wrap-item]', { hasText: title });
  await expect(rowOf(`Lost task ${t}`)).toBeVisible();
  await rowOf(`Kept task ${t}`).locator('[data-wrap-move="next_week"]').click();

  // while the dialog is open, the task changes hands
  await sql(`update work.task set owner_id = $2 where number = $1`, [lost, other.id]);
  await dialog.locator('[data-wrap-save]').click();

  await expect(toast(page, 'Only your own items can be wrapped up')).toBeVisible();
  await expect(dialog.locator('[data-wrap-gone]'), 'the row that left is named').toContainText(lost);
  await expect(rowOf(`Lost task ${t}`), 'and is out of the list').toHaveCount(0);
  await expect(
    rowOf(`Kept task ${t}`).locator('[data-wrap-move="next_week"]'),
    'the other choice is kept',
  ).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.locator('[data-wrap-save]')).toHaveText('Save · 1 next week');
  const [still] = await sql<{ due_on: string; today: string }>(
    `select due_on::text, core.riyadh_today()::text as today from work.task where number = $1`,
    [kept],
  );
  expect(still!.due_on, 'a refused Save changes nothing').toBe(still!.today);

  await dialog.locator('[data-wrap-save]').click();
  await expect(toast(page, 'Day wrapped up')).toBeVisible();
  const [moved] = await sql<{ later: boolean }>(
    `select due_on > core.riyadh_today() as later from work.task where number = $1`,
    [kept],
  );
  expect(moved!.later, 'one more tap saved the rest').toBe(true);
});

for (const width of [375, 1440]) {
  test(`QA-570: a day with nothing to wrap up shows the message and a Close button, never a button that does nothing — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await page.locator('[data-wrap-open]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Nothing left to wrap up today');
    await expect(dialog.locator('[data-wrap-save]'), 'no Wrap up today button is drawn').toHaveCount(0);
    await expect(dialog.locator('button[disabled]'), 'and no disabled button of any kind').toHaveCount(0);
    const close = dialog.locator('[data-wrap-close]');
    await expect(close).toHaveText('Close');
    if (width < 700)
      expect((await close.boundingBox())!.height, 'a 44 px target on a phone').toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(dialog).toHaveCount(0);
  });
}
