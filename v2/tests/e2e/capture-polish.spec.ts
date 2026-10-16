/**
 * Capture polish (the Architect's rulings of 16 Oct), at 375 and 1,440 px. A checklist note's card on My day counts the
 * action items of the task it became — closing them on the task moves the card (it kept saying 1/2). The note page
 * draws no "Turned into" label before the note has become anything, and says its kind and who sees it once. The save
 * message names the kind: "Checklist saved". Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [375, 1440]) {
  test(`the save message names the kind, the note page has no Turned into before a conversion and a checklist card counts its task's items — at ${width} px`, async ({
    page,
  }) => {
    const member = await makePerson();
    const t = tag();
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [member.id, `cp_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, member.email, '/my-day');
    await hydrated(page);

    // the save message names the kind
    await page.locator(wide ? '[data-create]' : '[data-create-bar]').click();
    await page.locator('[data-create-item="capture"]').click();
    await page.locator('[data-quick-kind="checklist"]').click();
    await page.locator('[data-quick-text]').fill(`Launch list ${t}\nFirst step ${t}\nSecond step ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Checklist saved')).toBeVisible();

    const [note] = await sql<{ id: string }>(`select id from my.note where person_id = $1 and title = $2`, [
      member.id,
      `Launch list ${t}`,
    ]);

    // before any conversion: no Turned into label, and the kind and its kind is said once
    await page.goto(`/my-day/notes/${note!.id}`);
    await hydrated(page);
    await expect(page.locator('[data-note-links]'), 'nothing to say it became yet').toHaveCount(0);
    await expect(page.getByText('Turned into', { exact: true }), 'no Turned into label').toHaveCount(0);
    await expect(
      page.locator('[data-note-page]').getByText('Checklist', { exact: true }),
      'the kind, once',
    ).toHaveCount(1);

    // the card on My day counts its own rows until the note becomes a task, then the task's items
    await page.goto('/my-day');
    await hydrated(page);
    const card = page.locator(`[data-my-note="${note!.id}"] [data-note-count]`);
    await expect(card).toHaveText('0/2');
    const made = await callAs(page.context(), 'note_turn_into', {
      p_note: note!.id,
      p_kind: 'task',
      p_values: { action_items: true },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const ids = (made.body as { action_item_ids: string[] }).action_item_ids;
    expect(ids).toHaveLength(2);
    await page.reload();
    await hydrated(page);
    await expect(card, 'a task made, none of its items closed').toHaveText('0/2');
    for (const id of ids) {
      const r = await callAs(page.context(), 'action_item_done', { p_id: id, p_done: true });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    await page.reload();
    await hydrated(page);
    await expect(card, "the task's items are all closed: the card says so").toHaveText('2/2');

    // after the conversion the note page says what it became
    await page.goto(`/my-day/notes/${note!.id}`);
    await hydrated(page);
    await expect(page.locator('[data-note-links]')).toContainText('Turned into');
  });
}
