/**
 * Landing 57 — the owner's review of 26 Nov ("Tasks do not work or show as I expect"), in the browser, against made-up
 * people of their own: a manager opens Tasks on Team and an empty My work sends them back there; a member still opens
 * on My work, sees open tasks only, and Show done brings the finished one back and puts it away again. Every value is
 * made up ("Made-up task …").
 * Sabotage: tests/sabotage/landing-57-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { hydrated, seedTask, signedInAs, staffAs, tag } from './support/landing-34';

const tab = (page: Page, name: string) => page.locator('nav[data-tabs] a', { hasText: name }).first();
const rowOf = (page: Page, number: string) => page.locator(`[data-task-row="${number}"]`);

test('Tasks opens where the work is: Team for a manager, open tasks first, Show done for the rest', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const manager = await staffAs('manager');
  const member = await staffAs('member');
  const word = tag();
  const openTask = await seedTask(member, `Made-up open task ${word}`, { offset: 3 });
  const doneTask = await seedTask(member, `Made-up done task ${word}`, {
    offset: 0,
    doneOn: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }),
  });

  // ------------------------------------------------------------------ the manager opens on Team
  const m = await signedInAs(browser, manager, '/tasks');
  try {
    const mp = m.page;
    await hydrated(mp);
    await expect(mp).toHaveURL(/\/tasks$/);
    await expect(tab(mp, 'Team'), 'a manager opens on Team').toHaveAttribute('aria-current', 'page');
    await expect(tab(mp, 'My work')).not.toHaveAttribute('aria-current', 'page');

    // their own My work is empty: it says where the work is, and one press goes back to Team
    await tab(mp, 'My work').click();
    await expect(mp).toHaveURL(/\/tasks\?view=my_work$/);
    await expect(
      mp.getByText("Nothing is yours yet. Your team's tasks are under Team."),
      'an empty My work says where the work is',
    ).toBeVisible();
    await mp.locator('[data-empty-open-team]').click();
    await expect(mp, 'Open Team goes to the bare list, which is Team').toHaveURL(/\/tasks$/);
    await expect(tab(mp, 'Team')).toHaveAttribute('aria-current', 'page');
  } finally {
    await m.context.close();
  }

  // ------------------------------------------------------------------ the member: open tasks, then Show done
  const w = await signedInAs(browser, member, '/tasks');
  try {
    const wp = w.page;
    await hydrated(wp);
    await expect(tab(wp, 'My work'), 'a member still opens on My work').toHaveAttribute('aria-current', 'page');
    await expect(rowOf(wp, openTask), 'the open task is listed').toBeVisible();
    await expect(rowOf(wp, doneTask), 'the done task is put away').toHaveCount(0);
    const showDone = wp.locator('[data-task-show-done]');
    await expect(showDone, 'Show done says how many are put away').toHaveText('Show done (1)');

    await showDone.click();
    await expect(wp).toHaveURL(/\/tasks\?done=1$/);
    await expect(rowOf(wp, doneTask), 'Show done lists the done task').toBeVisible();
    await expect(rowOf(wp, openTask)).toBeVisible();
    await expect(showDone).toHaveText('Hide done');

    await showDone.click();
    await expect(wp).toHaveURL(/\/tasks$/);
    await expect(rowOf(wp, doneTask), 'Hide done puts it away again').toHaveCount(0);

    // the board keeps its Done column with the task in it
    await wp.goto('/tasks?layout=board');
    await hydrated(wp);
    await expect(
      wp.locator(`[data-board-column="done"] [data-board-card="${doneTask}"]`),
      'the board keeps the done task',
    ).toBeVisible();
  } finally {
    await w.context.close();
  }
});
