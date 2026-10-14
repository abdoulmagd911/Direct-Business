/**
 * Productivity Stage 2, builder B2's half — the Reminder's "When" in Quick capture and the reminders and follow-ups in
 * My day's Today block. When: Tomorrow chosen with the result written under the chips ("Wed 14 Oct · 09:00"); Pick a day
 * shows Day, Time and five time chips and the line follows; Save needs no further tap and stores Riyadh time. Today: a
 * reminder due today shows with a one-tap done that ends it (and Undo is offered); a follow-up on a record says
 * "Follow up: <record>". At 375 and 1,440 px, no sideways scroll, 44 px targets; Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);
const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function openReminderSheet(page: Page, wide: boolean) {
  await page.locator(wide ? '[data-create]' : '[data-create-floating]').click();
  await page.locator('[data-create-item="capture"]').click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
  await page.locator('[data-quick-kind="reminder"]').click();
}

for (const width of [375, 1440]) {
  test(`a Reminder asks When with chips, Tomorrow chosen, the result written out, and saves Riyadh time — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    const t = tag();
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, me.email, '/clients');
    await hydrated(page);
    await openReminderSheet(page, wide);

    await expect(page.locator('[data-quick-when-choice="tomorrow"]'), 'Tomorrow is chosen').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('[data-quick-when-choice="next"]')).toBeVisible();
    await expect(page.locator('[data-quick-when-choice="pick"]')).toBeVisible();
    await expect(page.locator('[data-quick-when-line]'), 'the result is written out').toHaveText(
      /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · 09:00$/,
    );
    await expect(page.locator('input[type="datetime-local"]'), 'the raw field is gone').toHaveCount(0);
    for (const c of ['tomorrow', 'next', 'pick'])
      expect(
        (await page.locator(`[data-quick-when-choice="${c}"]`).boundingBox())!.height,
        'a chip is a 44 px target',
      ).toBeGreaterThanOrEqual(44);

    await page.locator('[data-quick-when-choice="pick"]').click();
    await expect(page.locator('[data-quick-day]')).toBeVisible();
    await expect(page.locator('[data-quick-time]')).toBeVisible();
    await expect(page.locator('[data-quick-time-chip]')).toHaveCount(5);
    await page.locator('[data-quick-time-chip="15:00"]').click();
    await expect(page.locator('[data-quick-when-line]')).toContainText('15:00');
    expect(await noSideways(page), 'no sideways scroll').toBe(true);

    await page.locator('[data-quick-text]').fill(`Call Sahab Tech ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(page.locator('[data-quick-capture]')).toHaveCount(0);
    const [r] = await sql<{ local: string }>(
      `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'HH24:MI') as local
         from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
      [me.id, `Call Sahab Tech ${t}`],
    );
    expect(r?.local, 'the time picked is Riyadh time').toBe('15:00');
  });
}

test('a reminder due today shows in Today and one tap ends it', async ({ page }) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'note_capture', {
    p_kind: 'reminder',
    p_values: { title: `Send the Dune Foods file ${t}`, remind_at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  // bring it to this Riyadh day without waiting for the clock
  await sql(
    `update core.reminder r set remind_at = core.clock() + interval '2 minutes'
       from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  await page.reload();
  await hydrated(page);
  const row = page.locator('[data-today-reminder]', { hasText: `Send the Dune Foods file ${t}` });
  await expect(row).toBeVisible();
  expect((await row.locator('[data-reminder-done]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await row.locator('[data-reminder-done]').click();
  await expect(row).toHaveCount(0);
  const [gone] = await sql<{ n: number }>(
    `select count(*)::int as n from core.reminder r join my.note n on n.id = r.note_id
      where n.person_id = $1 and n.title = $2 and r.deleted_at is null`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  expect(gone!.n, 'one tap ended the reminder').toBe(0);
});

test('a follow-up on a client shows in Today as "Follow up: <client>"', async ({ page }) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // the follow-up is seeded in the database: the door that makes one (api.follow_up) is builder A's and is tested in SQL (FUP-01)
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `s2_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const org = `Waha Foods ${t}`;
  const client = await callAs(page.context(), 'partner_create', {
    p_partner: { trade_name_en: org, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(client.status, JSON.stringify(client.body)).toBe(200);
  const clientId = (client.body as { id: string }).id;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, type_id, work_type, partner_id,
                            created_by, due_on, about_table, about_id)
     values ($1, 'Follow-up', $2, $3, (select department_id from core.team where id = $3),
             (select id from work.task_status where is_default and deleted_at is null),
             (select id from work.task_type where key = 'follow_up' and deleted_at is null), 'client', $4,
             $2, core.riyadh_today(), 'partner.partner', $4)`,
    [`TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`, me.id, team!.id, clientId],
  );
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-today-block]')).toContainText(`Follow up: ${org}`);
});
