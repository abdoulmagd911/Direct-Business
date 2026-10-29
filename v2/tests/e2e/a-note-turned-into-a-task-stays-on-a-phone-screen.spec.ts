/**
 * K (26 Oct): a note turned into a task on a phone. Once the task is made, the note page shows a "turned into" chip with
 * the task's number and title. A long title used to widen the note page past the screen, so the note's fields and
 * Save ran off the right edge. The chip now keeps to its row and cuts its words short, and the page never grows wider
 * than the screen: at 375 px, at 375 px right to left, and at 1280 px. Every value is made up.
 * Sabotage: tests/sabotage/note-to-task.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

/** Whatever in the page ends past the screen's edge (fixed bars aside). */
const pastTheEdge = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>('main *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed';
      })
      .map((e) => `${e.tagName.toLowerCase()} ${(e.textContent ?? '').trim().slice(0, 30)}`)
      .slice(0, 5);
  });

for (const [width, rtl] of [
  [375, false],
  [375, true],
  [1280, false],
] as const) {
  test(`a note with a long title, turned into a task, keeps the note page on the screen — at ${width} px${rtl ? ', right to left' : ''}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const me = await makePerson({});
    const t = tag();
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [me.id, `k_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
    if (rtl) await context.addCookies([{ name: 'v2.dir', value: 'rtl', url: baseURL! }]);
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    const title = `Call the made-up supplier about the long weekend booking and the extra rooms ${t}`;
    const r = await callAs(page.context(), 'note_capture', {
      p_kind: 'checklist',
      p_values: { title, visibility: 'private', items: [{ text: 'A made-up first step', done: false }] },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    await page.goto(`/my-day/notes/${(r.body as { id: string }).id}`);
    await hydrated(page);
    expect(await pastTheEdge(page), 'before: nothing runs past the screen').toEqual([]);

    await page.locator('[data-turn-into]').click();
    await page.locator('[data-turn-kind="task"]').click();
    const form = page.locator('[data-quick-add]');
    await expect(form.getByLabel('Title')).toHaveValue(title);
    await form.locator('[data-quick-add-save]').click();

    const chip = page.locator('[data-note-links] [data-turned-into="task"]');
    await expect(chip, 'the note says it became a task').toBeVisible();
    await expect(chip, 'its full words are kept for whoever points at it').toHaveAttribute('title', new RegExp(t));
    expect(await pastTheEdge(page), 'after: the note page, its fields and Save stay on the screen').toEqual([]);
    const b = (await page.locator('[data-note-save]').boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= width, "the note's Save is on the screen").toBe(true);
  });
}
