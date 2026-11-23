/**
 * Landing 33 in the browser · the task features (B1–B5), walked as people would, measured, not read from the code:
 *  B1  a comment thread on a task: comment, see it with its author and time, mark one as THE DECISION (pinned on top),
 *      move the mark, take it off; link a comment to a partner and open the partner from it in one tap.
 *  B2  type "@" and pick a person: they are mentioned (a link to them), told, and become a HELPER — the task is under
 *      their Helping on My day and on Tasks; the Responsible does not change.
 *  B3  hand over: only the Responsible is offered it; an empty reason turns the field red with the decided words, the
 *      button stays live and nothing moves; a reason holds 120 characters; the history says who had it, when and why;
 *      a manager is not offered another person's task; a deputy has the task under Helping and may mark it done.
 *  B4  steps: add, tick, the progress on the task, on the list and on the board; a done step says its day and who;
 *      Today's three says "From your own task lists" with its three source lines on a phone as on a PC, and the streak.
 *  B5  board: drag a card to another column and its status changes; the counts follow; Blocked asks its reason; the
 *      list shows the same tasks under the same filters; a viewer's card does not drag; a phone drags by the grip.
 *  Arabic: the same decision, hand-over words and drag, right to left. Six roles: who may write, decide and move
 *  (admin, head and manager move any card; a member only their own; the Viewer role and a person with no role have
 *  no level on Tasks, so they see no task at all).
 * Every value is made up. Sabotage: tests/sabotage/landing-33.mjs.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { shot } from './helpers';
import { readsArabic, withArabicOn } from './support/arabic';
import { doorOf, hydrated, seedTask, sideways, staffAs, tag, type Staff } from './support/landing-34';
import { smallWords } from './support/look';
import { personAs, type RoleKey } from './support/landing-32';
import { signIn, sql } from './support/stack';

test.describe.configure({ timeout: 240_000 });

const PC = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

async function openAs(
  browser: Browser,
  person: { email: string },
  size: { width: number; height: number },
  from: string,
) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await signIn(page, person.email, from);
  await hydrated(page);
  return { context, page };
}

/** A second made-up person in the first one's team, so each sees the other's tasks. */
async function teammate(of: Staff, role: Exclude<RoleKey, 'none'> = 'member'): Promise<Staff> {
  const p = await personAs(role);
  await sql(`update core.person set team_id = $2 where id = $1`, [p.id, of.teamId]);
  return { ...p, teamId: of.teamId };
}

const taskId = async (number: string) =>
  (await sql<{ id: string }>(`select id from work.task where number = $1`, [number]))[0]!.id;
const ownerOf = async (number: string) =>
  (await sql<{ owner_id: string }>(`select owner_id from work.task where number = $1`, [number]))[0]!.owner_id;
const statusOf = async (number: string) =>
  (
    await sql<{ meaning: string; blocked: boolean }>(
      `select s.meaning, t.blocked_reason is not null as blocked
         from work.task t join work.task_status s on s.id = t.status_id where t.number = $1`,
      [number],
    )
  )[0]!;

/** The board scrolls sideways while the pointer is this near its edge (`EDGE_PX` in board-drag.ts). */
const BOARD_EDGE_PX = 56;

/**
 * Where to point at a column: the middle of the part of it that is on the board AND outside the board's two edge
 * strips. Pointing inside a strip keeps the board scrolling, so the column slides out from under a still pointer.
 * Null while no such part is on the screen.
 */
async function aimAt(page: Page, column: Locator): Promise<{ x: number; y: number } | null> {
  const b = await column.boundingBox();
  const frame = await page.locator('[data-task-board]').boundingBox();
  if (!b || !frame) return null;
  const left = Math.max(b.x, frame.x + BOARD_EDGE_PX + 8);
  const right = Math.min(b.x + b.width, frame.x + frame.width - BOARD_EDGE_PX - 8);
  if (right - left < 16) return null;
  return { x: (left + right) / 2, y: b.y + Math.min(b.height / 2, 120) };
}

/** Carry a board card to a column with the mouse: press on the card (or its grip), move in steps, let go. */
async function dragCard(page: Page, number: string, toColumn: string, by: 'card' | 'grip' = 'card') {
  const card = page.locator(`[data-board-card="${number}"]`);
  const from = by === 'grip' ? card.locator('[data-board-grip]') : card.locator('[data-board-card-number]');
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const target = page.locator(`[data-board-column="${toColumn}"]`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
  await expect(page.locator('[data-board-ghost]'), 'the card is being carried').toBeVisible();
  // the column may be off the screen: carry the card to the board's edge until the column is under it
  for (let i = 0; i < 40; i++) {
    const b = await target.boundingBox();
    const w = page.viewportSize()!.width;
    const aim = await aimAt(page, target);
    if (aim) {
      await page.mouse.move(aim.x, aim.y, { steps: 6 });
      // the board may still be scrolling from the edge (on a phone above all): the column is under the card only
      // once it says so — otherwise it is measured again and the card carried to it again
      await page.waitForTimeout(150);
      if ((await target.getAttribute('data-drop-target')) === '') break;
      continue;
    }
    const frame = (await page.locator('[data-task-board]').boundingBox())!;
    const right = b ? b.x > w / 2 : true;
    await page.mouse.move(right ? frame.x + frame.width - 10 : frame.x + 10, frame.y + 100, { steps: 2 });
    await page.waitForTimeout(120);
  }
  await expect(target, 'the column under the card is marked').toHaveAttribute('data-drop-target', '');
  // The board may still be scrolling from the edge when the column comes under the card (on a phone above all):
  // measured again and pointed at once more just before the drop, so the card lands where the test aimed it.
  await page.waitForTimeout(150);
  const at = await aimAt(page, target);
  expect(at, 'the column is on the board, clear of its scrolling edges').not.toBeNull();
  await page.mouse.move(at!.x, at!.y, { steps: 2 });
  await expect(target, 'the column is still under the card at the drop').toHaveAttribute('data-drop-target', '');
  await page.mouse.up();
  await expect(page.locator('[data-board-ghost]')).toHaveCount(0);
}

test('B1 · B2 — a comment thread with one pinned decision, a linked record, and a mention that hands the task to help', async ({
  browser,
}) => {
  const owner = await staffAs('member');
  const mate = await teammate(owner);
  const word = tag();
  const number = await seedTask(owner, `Made-up ${word} thread`, { offset: 2 });
  const { context, page } = await openAs(browser, owner, PC, `/tasks/${number}?tab=discussion`);
  const orgName = `Made Up ${word} Linked Org`;
  const made = await doorOf(context)<{ id: string }>('partner_create', {
    p_partner: { trade_name_en: orgName, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const org = { id: made.id, name: orgName };
  const comments = page.locator('[data-comments]');
  const box = comments.locator('textarea[name="comment"]');

  // ---- comment, and see it with its author and its time
  await box.fill(`Made-up ${word} option A`);
  await comments.locator('[data-comment-add]').click();
  await expect(toast(page, 'Comment added')).toBeVisible();
  const first = comments.locator('[data-comment]', { hasText: `Made-up ${word} option A` });
  await expect(first.locator('[data-comment-author]')).toHaveText(owner.name);
  await expect(first.locator('[data-comment-time]')).not.toBeEmpty();
  await box.fill(`Made-up ${word} option B`);
  await comments.locator('[data-comment-add]').click();
  const second = comments.locator('[data-comment]', { hasText: `Made-up ${word} option B` });
  await expect(second).toBeVisible();

  // ---- THE decision: pinned on top; marking another moves it; unmarking clears it
  await expect(comments.locator('[data-decision]'), 'no decision yet').toHaveCount(0);
  await first.locator('[data-comment-decide]').click();
  await expect(toast(page, 'Marked as the decision')).toBeVisible();
  const pinned = comments.locator('[data-decision]');
  await expect(pinned, 'the decision is pinned').toContainText(`Made-up ${word} option A`);
  await expect(pinned.locator('[data-decision-by]')).toContainText(owner.name);
  const pinTop = (await pinned.boundingBox())!.y;
  const listTop = (await comments.locator('[data-comment]').first().boundingBox())!.y;
  expect(pinTop, 'the pinned decision stands above the thread').toBeLessThan(listTop);
  await second.locator('[data-comment-decide]').click();
  await expect(pinned, 'marking another comment moves the mark').toContainText(`Made-up ${word} option B`);
  await expect(comments.locator('[data-decision]')).toHaveCount(1);
  await expect(comments.locator('[data-comment-is-decision]'), 'one comment wears the mark').toHaveCount(1);
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-decision]'), 'the decision is still pinned after a reload').toContainText(
    `Made-up ${word} option B`,
  );
  await page.screenshot({ path: shot('landing-33-decision-1280-en') });
  await page.locator('[data-decision-unmark]').click();
  await expect(page.locator('[data-decision]'), 'unmarking leaves no decision').toHaveCount(0);

  // ---- link a record, and open it from the comment in one tap
  await page.locator('[data-comment-link-open]').click();
  await page.locator('[data-link-search] input').fill(org.name.slice(0, 22));
  await page.locator('[data-suggest-item="partner"]', { hasText: org.name }).click();
  await expect(page.locator('[data-picked-link="partner"]')).toContainText(org.name);
  await box.fill(`Made-up ${word} about the partner`);
  await page.locator('[data-comment-add]').click();
  const linked = page.locator('[data-comment]', { hasText: `Made-up ${word} about the partner` });
  const chip = linked.locator('[data-comment-link="partner"] a');
  await expect(chip).toContainText(org.name);
  await expect(chip).toHaveAttribute('href', `/partners/${org.id}`);

  // ---- @mention: type @, pick a person; they are a link, told, and a helper — never the Responsible
  await box.click();
  // (all but the last two letters: a full run holds hundreds of made-up people named alike, and the list shows eight)
  await box.pressSequentially(`Made-up ${word} look @${mate.name.slice(0, -2)}`);
  const option = page.locator('[data-suggest-item="person"]', { hasText: mate.name });
  await expect(option, 'typing @ offers the person').toBeVisible();
  await page.keyboard.press('Enter');
  await expect(box, 'the pick is written into the comment').toHaveValue(`Made-up ${word} look @${mate.name} `);
  await expect(page.locator('[data-mention-hint]')).toContainText('added as a helper');
  await page.locator('[data-comment-add]').click();
  const mention = page.locator(`[data-comment] [data-mention="${mate.id}"]`);
  await expect(mention, 'the mention links to the person').toHaveAttribute('href', `/people/${mate.id}`);
  await expect(mention).toHaveText(`@${mate.name}`);
  expect(await ownerOf(number), 'the Responsible is unchanged').toBe(owner.id);
  await expect
    .poll(async () => {
      const [r] = await sql<{ n: number }>(
        `select count(*)::int as n from notify.notification
          where person_id = $1 and kind = 'mentioned' and entity_id = $2`,
        [mate.id, await taskId(number)],
      );
      return r!.n;
    }, 'the person is told once')
    .toBe(1);

  // open the linked partner from the comment
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/partners/${org.id}`));
  await context.close();

  // ---- the person mentioned: the task is under Helping, on My day and on Tasks, on a PC and on a phone
  for (const size of [PC, PHONE]) {
    const theirs = await openAs(browser, mate, size, '/my-day');
    await expect(
      theirs.page.locator('[data-today-group="helping"]', { hasText: `Made-up ${word} thread` }),
      `My day lists it under Helping at ${size.width}`,
    ).toBeVisible();
    await theirs.page.goto('/tasks?view=helping');
    await hydrated(theirs.page);
    await expect(theirs.page.locator('[data-task-rows]')).toContainText(`Made-up ${word} thread`);
    expect(await sideways(theirs.page), `nothing scrolls sideways at ${size.width}`).toBeLessThanOrEqual(0);
    expect(await smallWords(theirs.page), `nothing under 12 px at ${size.width}`).toEqual([]);
    await theirs.context.close();
  }
});

test('B3 — hand over: a reason every time, only your own task, the history, and a deputy who acts', async ({
  browser,
}) => {
  const owner = await staffAs('member');
  const mate = await teammate(owner);
  const manager = await teammate(owner, 'manager');
  const word = tag();
  const number = await seedTask(owner, `Made-up ${word} handover`, { offset: 2 });
  const { context, page } = await openAs(browser, owner, PC, `/tasks/${number}`);

  // ---- an empty reason: red field, the decided words, a live button, nothing handed over
  await page.locator('[data-hand-over-open]').click();
  const form = page.locator('[data-delegate]');
  await form.getByRole('combobox').click();
  await page.getByRole('option', { name: mate.name, exact: true }).click();
  const send = form.locator('[data-hand-over-send]');
  await send.click();
  await expect(form.getByRole('alert'), 'an empty reason is refused in the owner’s words').toHaveText(
    'Give a reason. Every hand-over needs one.',
  );
  const reason = form.locator('textarea[name="reason"]');
  await expect(reason, 'the field is marked as wrong').toHaveAttribute('aria-invalid', 'true');
  await expect(send, 'the button stays live').toBeEnabled();
  expect(await ownerOf(number), 'nothing was handed over').toBe(owner.id);
  await page.screenshot({ path: shot('landing-33-hand-over-reason-1280-en') });

  // ---- a reason holds 120 characters, no more
  await reason.fill('x'.repeat(140));
  expect((await reason.inputValue()).length, 'the reason stops at 120 characters').toBe(120);
  await reason.fill(`Made-up ${word}: on leave next week`);
  await expect(form.getByRole('alert'), 'the error leaves once a reason is typed').toHaveCount(0);
  await send.click();
  await expect(toast(page, `Handed over to ${mate.name}`)).toBeVisible();
  await expect.poll(() => ownerOf(number), 'the task moved').toBe(mate.id);

  // ---- the history: who had it, who has it, why
  await page.reload();
  await hydrated(page);
  const history = page.locator('[data-handovers] [data-handover]');
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText(`${owner.name} → ${mate.name}`);
  await expect(history.first().locator('[data-handover-reason]')).toHaveText(`Made-up ${word}: on leave next week`);
  await expect(
    page.locator('[data-hand-over-open]'),
    'the former Responsible is no longer offered Hand over',
  ).toHaveCount(0);
  await context.close();

  // ---- O-3: a manager is not offered another person's task
  const boss = await openAs(browser, manager, PC, `/tasks/${number}`);
  await expect(boss.page.locator('[data-responsible]')).toContainText(mate.name);
  await expect(boss.page.locator('[data-hand-over-open]'), 'a manager is not offered a team member’s task').toHaveCount(
    0,
  );
  await boss.page.locator('[data-task-more]').first().click();
  await expect(boss.page.locator('[data-menu-delegate]')).toHaveCount(0);
  await boss.page.keyboard.press('Escape');
  await boss.context.close();

  // ---- the new Responsible names a deputy; the deputy has it under Helping and marks it done
  const now = await openAs(browser, mate, PC, `/tasks/${number}`);
  await expect(now.page.locator('[data-hand-over-open]'), 'the Responsible is offered Hand over').toBeVisible();
  await now.page.locator('[data-deputy-picker]').getByRole('combobox', { name: 'Change the deputy' }).click();
  await now.page.getByRole('option', { name: owner.name, exact: true }).click();
  await expect(toast(now.page, `${owner.name} is now the deputy on ${number}`)).toBeVisible();
  await expect(now.page.locator('[data-helper-deputy]'), 'the helpers list marks the deputy').toBeVisible();
  await now.context.close();

  const deputy = await openAs(browser, owner, PHONE, '/tasks?view=helping');
  await expect(deputy.page.locator('[data-task-rows]'), 'the deputy has it under Helping').toContainText(
    `Made-up ${word} handover`,
  );
  await deputy.page.goto(`/tasks/${number}`);
  await hydrated(deputy.page);
  await expect(deputy.page.locator('[data-hand-over-open]'), 'the deputy cannot hand over').toHaveCount(0);
  await deputy.page.locator('[data-mark-done]').first().click();
  await expect.poll(async () => (await statusOf(number)).meaning, 'the deputy marks it done').toBe('done');
  expect(await ownerOf(number), 'the Responsible still owns it').toBe(mate.id);
  expect(await sideways(deputy.page)).toBeLessThanOrEqual(0);
  expect(await smallWords(deputy.page), 'nothing under 12 px on the task page').toEqual([]);
  await deputy.context.close();
});

test('B4 — steps with their own done state and day; progress on the task, the list and the board; Today’s three and the streak', async ({
  browser,
}) => {
  const person = await staffAs('member');
  const word = tag();
  const number = await seedTask(person, `Made-up ${word} steps`, { offset: 1, starred: true });
  const { context, page } = await openAs(browser, person, PC, `/tasks/${number}?tab=items`);

  // ---- add two steps (one with a date), tick one
  const add = page.locator('[data-add-item]');
  await add.locator('[name="item"]').fill(`Made-up ${word} call`);
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator(`[data-item="Made-up ${word} call"]`)).toBeVisible();
  await add.locator('[name="item"]').fill(`Made-up ${word} send`);
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-checklist] [data-item]')).toHaveCount(2);
  await page.locator(`[data-item="Made-up ${word} call"]`).getByRole('checkbox').click();
  const done = page.locator(`[data-item="Made-up ${word} call"] [data-item-done]`);
  await expect(done, 'a done step says its day and who').toContainText(person.name);
  await expect(done).toContainText('Done');
  await expect(page.locator('[data-open-items]'), 'the task counts its open steps').toHaveAttribute(
    'data-open-items',
    '1',
  );

  // ---- the progress on the list and on the board
  await page.goto(`/tasks?view=owned&q=${encodeURIComponent(word)}`);
  await hydrated(page);
  await expect(page.locator('[data-task-rows] [data-task-steps]')).toHaveAttribute('data-task-steps', '1/2');
  await expect(page.locator('[data-task-rows] [data-task-steps]')).toContainText('1 of 2 steps');
  await page.locator('[data-layouts] [data-layout="board"]').click();
  await expect(page.locator(`[data-board-card="${number}"] [data-task-steps]`)).toHaveAttribute(
    'data-task-steps',
    '1/2',
  );

  // ---- My day: Today's three from the person's own lists, the three source lines, the streak — PC and phone
  for (const size of [PC, PHONE]) {
    await page.setViewportSize(size);
    await page.goto('/my-day');
    await hydrated(page);
    const three = page.locator('[data-todays-three]');
    await expect(three.locator('[data-three-own]'), `at ${size.width}`).toHaveText('From your own task lists');
    await expect(three.locator('[data-three-source]'), `the three source lines at ${size.width}`).toHaveCount(3);
    for (const g of ['important', 'short', 'maintenance'])
      await expect(three.locator(`[data-three-source="${g}"]`), `${g} at ${size.width}`).toBeVisible();
    await expect(three.locator('[data-three-group="important"]')).toContainText(`Made-up ${word} steps`);
    await expect(three.locator('[data-streak]'), `the streak line at ${size.width}`).toBeVisible();
    expect(await sideways(page), `nothing scrolls sideways at ${size.width}`).toBeLessThanOrEqual(0);
    expect(await smallWords(page), `nothing under 12 px at ${size.width}`).toEqual([]);
  }
  const pc = await (async () => {
    await page.setViewportSize(PC);
    await page.goto('/my-day');
    await hydrated(page);
    return page.locator('[data-three-sources]').innerText();
  })();
  await page.setViewportSize(PHONE);
  await page.goto('/my-day');
  await hydrated(page);
  expect(
    (await page.locator('[data-three-sources]').innerText()).replace(/\s+/g, ' '),
    'the phone says the same source words as the PC',
  ).toBe(pc.replace(/\s+/g, ' '));
  await page.screenshot({ path: shot('landing-33-todays-three-390-en') });
  await context.close();
});

test('B5 — the board: drag a card to another column and its status changes; the list holds the same tasks', async ({
  browser,
}) => {
  const person = await staffAs('member');
  const word = tag();
  const a = await seedTask(person, `Made-up ${word} alpha`, { offset: 1 });
  const b = await seedTask(person, `Made-up ${word} beta`, { offset: 2 });
  const c = await seedTask(person, `Made-up ${word} gamma`, { offset: null });
  const where = `/tasks?view=owned&q=${encodeURIComponent(word)}&layout=board`;
  const { context, page } = await openAs(browser, person, PC, where);
  const col = (k: string) => page.locator(`[data-board-column="${k}"]`);
  await expect(col('not_started')).toHaveAttribute('data-count', '3');
  await expect(col('in_progress')).toHaveAttribute('data-count', '0');
  await expect(page.locator(`[data-board-card="${a}"]`), 'a card names its Responsible').toContainText(person.name);
  await expect(page.locator(`[data-board-card="${a}"] [data-task-due]`)).toBeVisible();

  // ---- drag to In progress: the status changes, the counts follow
  await dragCard(page, a, 'in_progress');
  await expect.poll(async () => (await statusOf(a)).meaning, 'the drop changed the card’s status').toBe('in_progress');
  await expect(toast(page, 'In progress')).toBeVisible();
  await expect(col('in_progress'), 'the count of the column it joined').toHaveAttribute('data-count', '1');
  await expect(col('not_started'), 'and of the one it left').toHaveAttribute('data-count', '2');
  await expect(col('in_progress').locator(`[data-board-card="${a}"]`)).toBeVisible();
  await expect(page, 'a drag is not a click: the board is still open').toHaveURL(/layout=board/);

  // ---- drag to Blocked: it asks its reason first
  await dragCard(page, b, 'blocked');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect((await statusOf(b)).blocked, 'nothing moves before the reason').toBe(false);
  await dialog.locator('textarea').fill(`Made-up ${word}: waiting on the partner`);
  await dialog.getByRole('button', { name: 'Block' }).click();
  await expect.poll(async () => (await statusOf(b)).blocked).toBe(true);
  await expect(col('blocked')).toHaveAttribute('data-count', '1');
  await expect(col('blocked').locator(`[data-board-card="${b}"] [data-task-pill]`), 'one pill per card').toHaveCount(1);
  await page.screenshot({ path: shot('landing-33-board-drag-1280-en') });

  // ---- a card dropped where it already is changes nothing
  const before = await sql<{ n: number }>(`select count(*)::int as n from work.task_status_change where task_id = $1`, [
    await taskId(c),
  ]);
  const cBox = (await page.locator(`[data-board-card="${c}"] [data-board-card-number]`).boundingBox())!;
  await page.mouse.move(cBox.x + 5, cBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(cBox.x + 30, cBox.y + 30, { steps: 4 });
  await page.mouse.up();
  const after = await sql<{ n: number }>(`select count(*)::int as n from work.task_status_change where task_id = $1`, [
    await taskId(c),
  ]);
  expect(after[0]!.n, 'no status change is written').toBe(before[0]!.n);

  // ---- the list: the same tasks, the same filter, the place kept
  await page.locator('[data-layouts] [data-layout="list"]').click();
  await expect(page).toHaveURL(new RegExp(`view=owned.*q=${word}|q=${word}.*view=owned`));
  await expect(page.locator('[data-task-rows] a', { hasText: `Made-up ${word}` })).toHaveCount(3);
  await page.locator('[data-layouts] [data-layout="board"]').click();
  await expect(page.locator('[data-board-card]')).toHaveCount(3);
  await expect(
    page.locator('[data-layouts] [data-layout="calendar"]'),
    'the calendar is still offered, untouched',
  ).toBeVisible();
  await context.close();

  // ---- a phone: the card is carried by its grip; the page never scrolls sideways
  const phone = await openAs(browser, person, PHONE, where);
  await expect(phone.page.locator(`[data-board-card="${c}"] [data-board-grip]`)).toBeVisible();
  const grip = (await phone.page.locator(`[data-board-card="${c}"] [data-board-grip]`).boundingBox())!;
  expect(Math.min(grip.width, grip.height), 'the grip is a 44 px target').toBeGreaterThanOrEqual(44);
  await dragCard(phone.page, c, 'in_progress', 'grip');
  // the screen shows the card in its new column first; the write behind it may take a moment on a busy runner
  await expect(
    phone.page.locator(`[data-board-column="in_progress"] [data-board-card="${c}"]`),
    'the card sits in its new column on a phone',
  ).toBeVisible();
  await expect
    .poll(async () => (await statusOf(c)).meaning, { message: 'the grip carried the card on a phone', timeout: 20_000 })
    .toBe('in_progress');
  expect(await sideways(phone.page), 'the page does not scroll sideways on a phone').toBeLessThanOrEqual(0);
  expect(await smallWords(phone.page), 'nothing under 12 px on the board on a phone').toEqual([]);
  await phone.context.close();

  // ---- a teammate who is not the Responsible sees the card and drags nothing (a member moves only their own)
  const other = await teammate(person);
  const read = await openAs(browser, other, PC, `/tasks?view=team&q=${encodeURIComponent(word)}&layout=board`);
  await expect(read.page.locator(`[data-board-card="${a}"]`)).toBeVisible();
  await expect(
    read.page.locator('[data-board-card][data-draggable]'),
    'another member’s cards do not drag',
  ).toHaveCount(0);
  await expect(read.page.locator('[data-board-grip]')).toHaveCount(0);
  await read.context.close();
});

test('Arabic — the decision, the hand-over words and the drag, right to left, on a PC and a phone', async ({
  browser,
}) => {
  const owner = await staffAs('member');
  const mate = await teammate(owner);
  const word = tag();
  const number = await seedTask(owner, `Made-up ${word} arabic`, { offset: 2 });
  await withArabicOn(owner.id, 'made up: landing 33 in Arabic', async () => {
    await readsArabic(owner.id);
    const { context, page } = await openAs(browser, owner, PC, `/tasks/${number}?tab=discussion`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // the decision
    await page.locator('textarea[name="comment"]').fill(`Made-up ${word} قرار`);
    await page.locator('[data-comment-add]').click();
    await page
      .locator('[data-comment]', { hasText: `Made-up ${word} قرار` })
      .locator('[data-comment-decide]')
      .click();
    await expect(page.locator('[data-decision]')).toContainText('القرار');
    // an Arabic name is found by "@"
    await sql(`update core.person set full_name_ar = $2 where id = $1`, [mate.id, `سارة ${word}`]);
    const box = page.locator('textarea[name="comment"]');
    await box.click();
    await box.pressSequentially(`@سارة ${word.slice(0, 3)}`);
    await expect(page.locator('[data-suggest-item="person"]', { hasText: `سارة ${word}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await box.fill('');
    await page.screenshot({ path: shot('landing-33-decision-1280-ar') });
    expect(await smallWords(page), 'nothing under 12 px on the Arabic thread').toEqual([]);

    // the hand-over's words
    await page.goto(`/tasks/${number}`);
    await hydrated(page);
    await page.locator('[data-hand-over-open]').click();
    const form = page.locator('[data-delegate]');
    await form.getByRole('combobox').click();
    await page.getByRole('option').first().click();
    await form.locator('[data-hand-over-send]').click();
    await expect(form.getByRole('alert')).toHaveText('اذكر السبب. كل تسليم يحتاج إلى سبب.');
    await expect(form.locator('[data-hand-over-send]')).toBeEnabled();
    expect(await ownerOf(number)).toBe(owner.id);
    await page.keyboard.press('Escape');

    // the board, right to left: the first column stands on the right; a card drags to the next
    await page.goto(`/tasks?view=owned&q=${encodeURIComponent(word)}&layout=board`);
    await hydrated(page);
    const xs = await page
      .locator('[data-board-column]')
      .evaluateAll((cols) => cols.map((c) => c.getBoundingClientRect().x));
    expect(xs[0]!, 'in Arabic the first column is the right-most').toBeGreaterThan(xs[1]!);
    await dragCard(page, number, 'in_progress');
    await expect.poll(async () => (await statusOf(number)).meaning).toBe('in_progress');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    expect(await smallWords(page), 'nothing under 12 px on the Arabic board').toEqual([]);
    await context.close();

    const phone = await openAs(browser, owner, PHONE, '/my-day');
    await expect(phone.page.locator('[data-three-source]'), 'the three source lines on an Arabic phone').toHaveCount(3);
    expect(await sideways(phone.page)).toBeLessThanOrEqual(0);
    expect(await smallWords(phone.page), 'nothing under 12 px on an Arabic phone').toEqual([]);
    await phone.page.screenshot({ path: shot('landing-33-my-day-390-ar') });
    await phone.context.close();
  });
});

test('six roles — who may comment and decide, who may move a card, and who sees nothing', async ({ browser }) => {
  const owner = await staffAs('member');
  const word = tag();
  const number = await seedTask(owner, `Made-up ${word} roles`, { offset: 2 });
  const first = await openAs(browser, owner, PC, `/tasks/${number}?tab=discussion`);
  await first.page.locator('textarea[name="comment"]').fill(`Made-up ${word} first word`);
  await first.page.locator('[data-comment-add]').click();
  await expect(first.page.locator('[data-comment]')).toHaveCount(1);
  await first.context.close();

  for (const role of ['admin', 'head', 'manager', 'member'] as const) {
    const person = await teammate(owner, role);
    const { context, page } = await openAs(browser, person, PC, `/tasks/${number}?tab=discussion`);
    await expect(page.locator('[data-comment]'), `${role} reads the thread`).toHaveCount(1);
    await expect(page.locator('[data-add-comment]'), `${role} may comment`).toHaveCount(1);
    await expect(page.locator('[data-comment-decide]'), `${role} may mark the decision`).toHaveCount(1);
    await expect(page.locator('[data-hand-over-open]'), `${role} is not the Responsible`).toHaveCount(0);
    await page.goto(`/tasks?view=team&q=${encodeURIComponent(word)}&layout=board`);
    await hydrated(page);
    // Full on Tasks (admin, head, manager) moves any card; a member moves only their own
    const moves = role !== 'member';
    await expect(page.locator(`[data-board-card="${number}"]`), `${role} sees the card`).toBeVisible();
    await expect(
      page.locator(`[data-board-card="${number}"][data-draggable]`),
      `${role} ${moves ? 'may' : 'may not'} drag the card`,
    ).toHaveCount(moves ? 1 : 0);
    await context.close();
  }

  // the Viewer role has no level on Tasks (the roles as they stand): no thread, no card, nothing to write
  const viewer = await teammate(owner, 'viewer');
  const read = await openAs(browser, viewer, PC, `/tasks/${number}?tab=discussion`);
  await expect(read.page.locator('[data-comments]'), 'a viewer sees no task thread').toHaveCount(0);
  await expect(read.page.locator('[data-add-comment]')).toHaveCount(0);
  await read.context.close();

  const nobody = await personAs('none');
  const out = await openAs(browser, nobody, PC, `/tasks/${number}`);
  await expect(out.page.locator('[data-comments]'), 'someone with no role sees no task').toHaveCount(0);
  await expect(out.page.locator('[data-board-card]')).toHaveCount(0);
  await out.context.close();
});
