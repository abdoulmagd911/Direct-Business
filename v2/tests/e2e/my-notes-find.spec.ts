/**
 * Every captured item can be found on My day (the Architect's ruling V641, the owner's live test of 17 Oct), at 375 and
 * 1,440 px. One item of each kind — note, idea, checklist, reminder, meeting — is saved. The four that are notes are
 * among My notes at once, each naming its kind; the reminder is under Reminders and is found among My notes by its
 * kind. Narrowing My notes to a kind lists that kind alone, and the Team and Workspace views, which show only what
 * others chose to share, say so when empty. Searching for them is Builder A's search PR. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [375, 1440]) {
  test(`one of each kind is found on My day, named and filterable by kind, and the shared views say when empty — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson();
    const t = tag();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    const [d] = await sql<{ day: string }>(`select (core.riyadh_today() + 3)::text as day`);
    const capture = async (kind: string, values: Record<string, unknown>) => {
      const r = await callAs(page.context(), 'note_capture', {
        p_kind: kind,
        p_values: { visibility: 'private', ...values },
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      return (r.body as { id: string }).id;
    };
    const ids = {
      note: await capture('sticky', { title: `Plain note ${t}` }),
      idea: await capture('idea', { title: `Idea for a newsletter ${t}` }),
      checklist: await capture('checklist', {
        title: `Launch list ${t}`,
        items: [{ text: `First step ${t}`, done: false }],
      }),
      reminder: await capture('reminder', { title: `Call the hotel ${t}`, remind_at: `${d!.day}T10:00:00+03:00` }),
      meeting: await capture('meeting', { title: `Weekly sync ${t}` }),
    };

    // at once: the four notes are among My notes, each naming its kind; the reminder is under Reminders
    await page.goto('/my-day');
    await hydrated(page);
    const mine = page.locator('[data-block="me"]');
    for (const kind of ['note', 'idea', 'checklist', 'meeting'] as const) {
      const row = mine.locator(`[data-my-note="${ids[kind]}"]`);
      await expect(row, `${kind}: listed among My notes`).toBeVisible();
      await expect(row.locator(`[data-note-captured-as="${kind}"]`), `${kind}: it names its kind`).toBeVisible();
    }
    await expect(page.locator('[data-reminders]'), 'the reminder is under Reminders').toContainText(
      `Call the hotel ${t}`,
    );

    // narrowed to Idea: the idea alone
    await mine.locator('[data-kind-option="idea"]').click();
    await expect(page).toHaveURL(/kind=idea/);
    await expect(mine.locator('[data-my-note]'), 'the Idea filter lists one row').toHaveCount(1);
    await expect(mine.locator(`[data-my-note="${ids.idea}"]`)).toContainText(`Idea for a newsletter ${t}`);

    // narrowed to Reminder: the reminder is found among My notes by its kind
    await mine.locator('[data-kind-option="reminder"]').click();
    await expect(page).toHaveURL(/kind=reminder/);
    await expect(mine.locator(`[data-my-note="${ids.reminder}"] [data-note-captured-as="reminder"]`)).toBeVisible();

    // a kind with nothing says so, and All brings the lot back
    await mine.locator('[data-kind-option="note"]').click();
    await expect(mine.locator(`[data-my-note="${ids.note}"]`)).toBeVisible();
    await mine.locator('[data-kind-option="all"]').click();
    await expect(mine.locator(`[data-my-note="${ids.idea}"]`)).toBeVisible();
    await expect(mine.locator(`[data-my-note="${ids.checklist}"]`)).toBeVisible();

    // the shared views say so when nothing is shared
    await page.goto('/my-day?tab=team');
    await hydrated(page);
    await expect(page.locator('[data-block="team"]')).toContainText('Nothing shared with your team yet.');
    await page.goto('/my-day?tab=workspace');
    await hydrated(page);
    await expect(page.locator('[data-block="workspace"]')).toContainText('Nothing shared with everyone yet.');
  });
}
