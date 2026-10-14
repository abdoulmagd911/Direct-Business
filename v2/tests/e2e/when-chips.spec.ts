/**
 * Productivity stage 2, PR 1 — the When chips in Quick capture and the Follow up entry of the sheet.
 * A Reminder opens with Tomorrow chosen and one line saying the result ("Wed 14 Oct · 09:00"); Pick a day shows Day,
 * Time and five time chips; Save needs no further tap. A door that opens the sheet with a record (the Follow up button
 * on a record page) gets the same sheet tied to it: the record is named, there is no kind or visibility menu, the time
 * is left out (a follow-up is kept for a day) and Save makes the follow-up. A time that has passed is refused in words
 * and the sheet stays. At 375 and 1,440 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const tag = () => Math.random().toString(36).slice(2, 8);

async function personWithTeam() {
  const me = await makePerson({ admin: true });
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `wc_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  return { me, t };
}

/** Riyadh's today, tomorrow (next working day) and next Sunday, written the way the result line writes them. */
async function days() {
  const [r] = await sql<{
    today: string;
    tomorrow: string;
    line_tomorrow: string;
    line_sunday: string;
    sunday: string;
    mins: number;
  }>(
    `select core.riyadh_today()::text as today,
            core.next_working_day(core.riyadh_today())::text as tomorrow,
            to_char(core.next_working_day(core.riyadh_today()), 'Dy FMDD Mon YYYY') as line_tomorrow,
            (core.riyadh_today() + (7 - extract(dow from core.riyadh_today())::int))::text as sunday,
            to_char(core.riyadh_today() + (7 - extract(dow from core.riyadh_today())::int), 'Dy FMDD Mon YYYY') as line_sunday,
            (extract(hour from (now() at time zone 'Asia/Riyadh'))::int * 60 + extract(minute from (now() at time zone 'Asia/Riyadh'))::int) as mins`,
  );
  return r!;
}

const openReminder = async (page: Page) => {
  await page.locator('[data-capture-open]').click();
  await page.locator('[data-quick-kind="reminder"]').click();
  await expect(page.locator('[data-when]')).toBeVisible();
};

for (const width of [375, 1440]) {
  test(`a Reminder opens with Tomorrow chosen and says the result; Pick a day shows Day, Time and five time chips — at ${width} px`, async ({
    page,
  }) => {
    const { me, t } = await personWithTeam();
    const d = await days();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await openReminder(page);

    await expect(
      page.locator('[data-when-chip="tomorrow"]'),
      'Tomorrow is chosen when the sheet opens',
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-when-result]'), 'one line saying the result').toHaveText(
      `${d.line_tomorrow} · 09:00`,
    );
    await page.locator('[data-when-chip="next_week"]').click();
    await expect(page.locator('[data-when-result]'), 'Next week is the next Sunday').toHaveText(
      `${d.line_sunday} · 09:00`,
    );
    if (width < 700) {
      for (const chip of ['tomorrow', 'next_week', 'pick']) {
        const b = (await page.locator(`[data-when-chip="${chip}"]`).boundingBox())!;
        expect(b.height, `${chip} is a 44 px target`).toBeGreaterThanOrEqual(43.5);
      }
    }
    // Later today is offered while enough of the day is left, never after it
    if (d.mins < 16 * 60) await expect(page.locator('[data-when-chip="later_today"]')).toBeVisible();
    if (d.mins > 17 * 60 + 35) await expect(page.locator('[data-when-chip="later_today"]')).toHaveCount(0);

    // Pick a day: Day, Time, five time chips
    await page.locator('[data-when-chip="pick"]').click();
    await expect(page.locator('[data-when-day]')).toBeVisible();
    await expect(page.locator('[data-when-time-field]')).toBeVisible();
    await expect(page.locator('[data-when-time]')).toHaveText(['08:00', '09:00', '12:00', '15:00', '17:00']);
    const [pickDay] = await sql<{ later: string; line: string }>(
      `select (core.riyadh_today() + 3)::text as later, to_char(core.riyadh_today() + 3, 'Dy FMDD Mon YYYY') as line`,
    );
    const { later, line } = pickDay!;
    await page.locator('[data-when-day]').fill(later);
    await page.locator('[data-when-time="15:00"]').click();
    await expect(page.locator('[data-when-result]')).toHaveText(`${line} · 15:00`);

    await page.locator('[data-quick-text]').fill(`Call back ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Reminder captured')).toBeVisible();
    const [row] = await sql<{ at: string }>(
      `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as at
         from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
      [me.id, `Call back ${t}`],
    );
    expect(row?.at, 'the reminder is set at the Riyadh day and time chosen').toBe(`${later} 15:00`);
  });
}

test('the default Tomorrow saves with no further tap, at nine Riyadh time on the next working day', async ({
  page,
}) => {
  const { me, t } = await personWithTeam();
  const d = await days();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await openReminder(page);
  await page.locator('[data-quick-text]').fill(`Plain ${t}`);
  await page.locator('[data-quick-save]').click();
  await expect(toast(page, 'Reminder captured')).toBeVisible();
  const [row] = await sql<{ at: string }>(
    `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as at
       from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
    [me.id, `Plain ${t}`],
  );
  expect(row?.at).toBe(`${d.tomorrow} 09:00`);
});

test('a time that has passed is refused in words and the sheet stays', async ({ page }) => {
  const { me, t } = await personWithTeam();
  const d = await days();
  test.skip(d.mins < 9 * 60, 'before nine in Riyadh, 08:00 today has not passed');
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await openReminder(page);
  await page.locator('[data-when-chip="pick"]').click();
  await page.locator('[data-when-day]').fill(d.today);
  await page.locator('[data-when-time="08:00"]').click();
  await expect(page.locator('[data-when-result]'), 'the line says so').toContainText('That time has passed');
  await page.locator('[data-quick-text]').fill(`Late ${t}`);
  await page.locator('[data-quick-save]').click();
  await expect(toast(page, /in the future/)).toBeVisible();
  await expect(page.locator('[data-quick-capture]'), 'a failed save keeps the sheet').toBeVisible();
  const [kept] = await sql<{ n: number }>(
    `select count(*)::int as n from my.note where person_id = $1 and title = $2`,
    [me.id, `Late ${t}`],
  );
  expect(kept?.n, 'and nothing was kept').toBe(0);
});

for (const width of [375, 1440]) {
  test(`a door that opens the sheet with a record gets a Follow up: the record is named, no kind or visibility menu, a private timed reminder — at ${width} px`, async ({
    page,
  }) => {
    const { me, t } = await personWithTeam();
    const d = await days();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const org = `Test Org ${t}`;
    const made = await callAs(page.context(), 'partner_create', {
      p_partner: { trade_name_en: org, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const id = (made.body as { id: string }).id;

    // what the Follow up button on a record page calls
    await page.evaluate(
      ([entity, recordId, label]) =>
        window.dispatchEvent(
          new CustomEvent('quick-capture:open', {
            detail: { kind: 'reminder', about: { entity, id: recordId, label } },
          }),
        ),
      ['partner', id, org],
    );
    const sheet = page.locator('[data-quick-capture]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-quick-about]'), 'the record is named').toContainText(org);
    await expect(sheet.locator('[data-quick-kind]'), 'no kind menu').toHaveCount(0);
    await expect(sheet.locator('[data-quick-visibility]'), 'no visibility menu').toHaveCount(0);
    await expect(sheet.locator('[data-when-chip="tomorrow"]')).toHaveAttribute('aria-checked', 'true');
    await sheet.locator('[data-when-chip="pick"]').click();
    await expect(sheet.locator('[data-when-day]')).toBeVisible();
    await expect(sheet.locator('[data-when-time-field]'), 'a follow-up keeps its time').toBeVisible();
    await expect(sheet.locator('[data-when-time]')).toHaveCount(5);
    await sheet.locator('[data-when-chip="tomorrow"]').click();

    await sheet.locator('[data-quick-save]').click();
    await expect(toast(page, 'Follow-up set')).toBeVisible();
    await expect(sheet).toHaveCount(0);
    const [row] = await sql<{ about_table: string; visibility: string; at: string; title: string }>(
      `select n.title, n.about_table, n.visibility, to_char(r.remind_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as at
         from my.note n join core.reminder r on r.note_id = n.id
        where n.about_id = $1 and n.person_id = $2 and n.deleted_at is null`,
      [id, me.id],
    );
    expect(row?.about_table, 'a follow-up about the client').toBe('partner.partner');
    expect(row?.visibility, 'private, Only me').toBe('private');
    expect(row?.title, 'a neutral title, never the record’s name (QA-560)').toBe('Follow-up');
    expect(row?.at, 'at the day and time chosen').toBe(`${d.tomorrow} 09:00`);
    expect(page.url(), 'and the person is still where they were').toMatch(/\/my-day$/);
  });
}
