/**
 * Landing 47 in the browser · the small fix round, done as a person does it, measured, not read from the code:
 *  1  THE BOARD — a card carried straight across to a SHORT column (an empty one is a few lines tall beside a long
 *     one) is taken, though the pointer is below that column's own box: with a mouse on a PC, and with a real finger
 *     (touch events, not a mouse at phone width) on the card's grip on a phone. Its status changes. While a card is
 *     carried the short column is drawn the board's full height, so the lane under the card is seen marked.
 *  2  "@" — typing a bare "@" in a comment lists the record's people AT ONCE (it used to wait for two letters); one
 *     letter narrows the list; the writer is never offered; a pick is written into the comment and the list closes,
 *     and the words typed after the picked name open no list (a "No match" box used to sit under the comment);
 *     on a phone each row is a 44 px target and a tap picks; "see you @ 5" offers nobody. The same on a My day note,
 *     where the list holds only the colleagues who can see the note.
 *  3  HAND OVER, as the task's Responsible — a team member and a manager, on a PC and on a phone: the button beside
 *     Responsible and the ⋯ menu each open the Hand over dialog, with the task's number, the people picker (never the
 *     Responsible themself), the reason box and its count; sent from a phone, the task changes hands.
 * Every value is made up. Sabotage: tests/sabotage/landing-47.mjs.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { hydrated, seedTask, sideways, staffAs, tag, type Staff } from './support/landing-34';
import { personAs, type RoleKey } from './support/landing-32';
import { callAs, signIn, sql } from './support/stack';

test.describe.configure({ timeout: 240_000 });

const PC = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

/** A PC with a mouse, or a phone with a finger (a touch screen: taps and touch events, as a real phone sends them). */
async function openAs(browser: Browser, person: { email: string }, device: 'pc' | 'phone', from: string) {
  const context = await browser.newContext(
    device === 'phone'
      ? { viewport: PHONE, deviceScaleFactor: 1, hasTouch: true, isMobile: true }
      : { viewport: PC, deviceScaleFactor: 1 },
  );
  const page = await context.newPage();
  await signIn(page, person.email, from);
  await hydrated(page);
  return { context, page };
}

/** A made-up person in the first one's team, under a name no other test's people share. */
async function teammate(of: Staff, name: string, role: Exclude<RoleKey, 'none'> = 'member'): Promise<Staff> {
  const p = await personAs(role);
  await sql(`update core.person set team_id = $2, full_name_en = $3 where id = $1`, [p.id, of.teamId, name]);
  return { ...p, name, teamId: of.teamId };
}
async function renamed(person: Staff, name: string): Promise<Staff> {
  await sql(`update core.person set full_name_en = $2 where id = $1`, [person.id, name]);
  return { ...person, name };
}

const ownerOf = async (number: string) =>
  (await sql<{ owner_id: string }>(`select owner_id from work.task where number = $1`, [number]))[0]!.owner_id;
const meaningOf = async (number: string) =>
  (
    await sql<{ meaning: string }>(
      `select s.meaning from work.task t join work.task_status s on s.id = t.status_id where t.number = $1`,
      [number],
    )
  )[0]!.meaning;

/** The board scrolls sideways while the pointer is this near its edge (`EDGE_PX` in board-drag.ts). */
const BOARD_EDGE_PX = 56;

/**
 * Where to carry a card to reach a column from a card lower down: level with the column, clear of the board's two
 * scrolling strips, and at height `y` — the height of the card that was picked up. Null while the column is not there.
 */
async function laneAim(page: Page, column: Locator, y: number): Promise<{ x: number; y: number } | null> {
  const b = await column.boundingBox();
  const frame = await page.locator('[data-task-board]').boundingBox();
  if (!b || !frame) return null;
  const left = Math.max(b.x, frame.x + BOARD_EDGE_PX + 8);
  const right = Math.min(b.x + b.width, frame.x + frame.width - BOARD_EDGE_PX - 8);
  if (right - left < 16) return null;
  return { x: (left + right) / 2, y };
}

/** One finger on the screen, as the browser's own touch input (it becomes pointer events of type "touch"). */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const at = (p: { x: number; y: number }) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
  let here = { x: 0, y: 0 };
  return {
    down: async (p: { x: number; y: number }) => {
      here = p;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(p) });
    },
    move: async (p: { x: number; y: number }, steps = 6) => {
      const from = here;
      for (let i = 1; i <= steps; i++) {
        const next = { x: from.x + ((p.x - from.x) * i) / steps, y: from.y + ((p.y - from.y) * i) / steps };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(next) });
        await page.waitForTimeout(16);
      }
      here = p;
    },
    up: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

test('1 — the board: a card carried straight across to a short column is taken, by a mouse and by a finger', async ({
  browser,
}) => {
  const person = await staffAs('member');
  const word = tag();
  // four cards make Not started a long column; In progress beside it is empty — a few lines tall
  const numbers: string[] = [];
  for (const [i, name] of ['alpha', 'beta', 'gamma', 'delta'].entries())
    numbers.push(await seedTask(person, `Made-up ${word} ${name}`, { offset: i + 1 }));
  const where = `/tasks?view=owned&q=${encodeURIComponent(word)}&layout=board`;

  // ---- a PC, with a mouse: the lowest card, carried sideways at its own height
  const pc = await openAs(browser, person, 'pc', where);
  const col = (page: Page, k: string) => page.locator(`[data-board-column="${k}"]`);
  await expect(col(pc.page, 'not_started')).toHaveAttribute('data-count', '4');
  await expect(col(pc.page, 'in_progress')).toHaveAttribute('data-count', '0');
  const low = pc.page.locator('[data-board-column="not_started"] [data-board-card]').last();
  const lowNumber = (await low.getAttribute('data-board-card'))!;
  await low.scrollIntoViewIfNeeded();
  const from = (await low.locator('[data-board-card-number]').boundingBox())!;
  const y = from.y + from.height / 2;
  const target = col(pc.page, 'in_progress');
  const box = (await target.boundingBox())!;
  expect(y, 'the card is picked up lower than the short column reaches').toBeGreaterThan(box.y + box.height + 8);
  await pc.page.mouse.move(from.x + from.width / 2, y);
  await pc.page.mouse.down();
  await pc.page.mouse.move(from.x + from.width / 2 + 12, y, { steps: 3 });
  await expect(pc.page.locator('[data-board-ghost]'), 'the card is being carried').toBeVisible();
  const aim = (await laneAim(pc.page, target, y))!;
  await pc.page.mouse.move(aim.x, aim.y, { steps: 8 });
  await expect(target, 'a short column takes a card held below its own box (a mouse)').toHaveAttribute(
    'data-drop-target',
    '',
  );
  // and the eye sees it: while a card is carried the short column stands the board's full height, marked
  const carried = (await target.boundingBox())!;
  expect(
    carried.y + carried.height,
    'while a card is carried a short column is drawn down to where the card is held',
  ).toBeGreaterThan(y);
  // between two columns, and off the board, nothing is marked
  const next = (await col(pc.page, 'blocked').boundingBox())!;
  await pc.page.mouse.move((box.x + box.width + next.x) / 2, y, { steps: 3 });
  await expect(pc.page.locator('[data-drop-target]'), 'the gap between two columns takes nothing').toHaveCount(0);
  const board = (await pc.page.locator('[data-task-board]').boundingBox())!;
  await pc.page.mouse.move(aim.x, board.y + board.height + 30, { steps: 3 });
  await expect(pc.page.locator('[data-drop-target]'), 'below the board nothing is marked').toHaveCount(0);
  await pc.page.mouse.move(aim.x, aim.y, { steps: 3 });
  await expect(target).toHaveAttribute('data-drop-target', '');
  await pc.page.mouse.up();
  await expect(pc.page.locator('[data-board-ghost]')).toHaveCount(0);
  await expect
    .poll(() => meaningOf(lowNumber), 'the card dropped below the short column changed its status (a mouse)')
    .toBe('in_progress');
  await expect(col(pc.page, 'in_progress')).toHaveAttribute('data-count', '1');
  await expect(pc.page, 'a drag is not a click: the board is still open').toHaveURL(/layout=board/);
  await pc.context.close();

  // ---- a phone, with a finger on the grip: Blocked is the short column now (In progress holds one card)
  const phone = await openAs(browser, person, 'phone', where);
  const page = phone.page;
  await expect(col(page, 'not_started')).toHaveAttribute('data-count', '3');
  const card = page.locator('[data-board-column="not_started"] [data-board-card]').last();
  const number = (await card.getAttribute('data-board-card'))!;
  await card.scrollIntoViewIfNeeded();
  const grip = (await card.locator('[data-board-grip]').boundingBox())!;
  expect(Math.min(grip.width, grip.height), 'the grip is a 44 px target').toBeGreaterThanOrEqual(44);
  const touch = await finger(page);
  const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  const atRest = (await col(page, 'done').boundingBox())!;
  expect(start.y, 'the finger is lower than the short column reaches').toBeGreaterThan(atRest.y + atRest.height + 8);
  const frame = (await page.locator('[data-task-board]').boundingBox())!;
  await touch.down(start);
  await touch.move({ x: start.x + 6, y: start.y }, 2);
  await expect(page.locator('[data-board-ghost]'), 'a finger on the grip carries the card').toBeVisible();
  const done = col(page, 'done');
  // towards the board's edge: it scrolls, and the far column comes under the finger
  let onIt = false;
  for (let i = 0; i < 80 && !onIt; i++) {
    const to = await laneAim(page, done, start.y);
    if (to) {
      await touch.move(to, 4);
      await page.waitForTimeout(150);
      onIt = (await done.getAttribute('data-drop-target')) === '';
      continue;
    }
    await touch.move({ x: frame.x + frame.width - 10, y: start.y }, 2);
    await page.waitForTimeout(100);
  }
  await expect(done, 'a short column takes a card held below its own box (a finger)').toHaveAttribute(
    'data-drop-target',
    '',
  );
  const lane = (await done.boundingBox())!;
  expect(
    lane.y + lane.height,
    'on a phone too the short column is drawn down to where the card is held',
  ).toBeGreaterThan(start.y);
  await touch.up();
  await expect(page.locator('[data-board-ghost]')).toHaveCount(0);
  const rested = (await done.boundingBox())!;
  expect(rested.height, 'once the card is let go the columns are their own height again').toBeLessThan(lane.height);
  // Done asks nothing here (the task has no open steps): the status changes
  await expect
    .poll(() => meaningOf(number), {
      message: 'the card dropped below the short column changed its status (a finger)',
      timeout: 20_000,
    })
    .toBe('done');
  await expect(page.locator(`[data-board-column="done"] [data-board-card="${number}"]`)).toBeVisible();
  expect(await sideways(page), 'the page does not scroll sideways on a phone').toBeLessThanOrEqual(0);
  await phone.context.close();
});

test('2 — a bare @ lists the people at once: a task comment on a PC and a phone, and a My day note', async ({
  browser,
}) => {
  const word = tag();
  const owner = await renamed(await staffAs('member'), `Qz${word} Owner`);
  const mate = await teammate(owner, `Qz${word} Mate`);
  const number = await seedTask(owner, `Made-up ${word} at`, { offset: 2 });

  // ---- a PC
  const pc = await openAs(browser, owner, 'pc', `/tasks/${number}?tab=discussion`);
  let page = pc.page;
  let box = page.locator('[data-comments] textarea[name="comment"]');
  const people = page.locator('[data-suggest] [data-suggest-item="person"]');
  await box.click();
  await box.pressSequentially('Made-up look ');
  await expect(page.locator('[data-suggest]'), 'no list before an @').toHaveCount(0);
  await box.pressSequentially('@');
  await expect(people.first(), 'a bare @ lists people at once').toBeVisible();
  expect(await people.count(), 'the list holds people').toBeGreaterThan(0);
  await box.pressSequentially('Q');
  // one letter narrows the list to the names with a part that starts with it (a full run holds many made-up people,
  // so the list is read as a whole — the one person is looked for by name further down)
  await expect(people.first(), 'one letter still lists people').toBeVisible();
  await expect(people.filter({ hasText: owner.name }), 'the writer is never offered').toHaveCount(0);
  for (const name of await people.allInnerTexts())
    expect(name.toLowerCase(), 'every name offered has a part that starts with the letter').toMatch(/(^|\s)q/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-suggest]'), 'Escape closes the list').toHaveCount(0);
  await box.pressSequentially('z');
  // (two letters go to the search, which shows eight: a full run holds more made-up people than that under "Qz")
  await expect(people.first(), 'two letters and more are searched, as before').toBeVisible();
  await box.pressSequentially(word);
  await expect(people.filter({ hasText: mate.name }), 'the search finds the person by name').toBeVisible();
  await page.keyboard.press('Enter');
  await expect(box, 'the pick is written into the comment').toHaveValue(`Made-up look @${mate.name} `);
  await expect(page.locator('[data-suggest]'), 'the list closes on a pick').toHaveCount(0);
  // the words after a picked name are the comment: they open no list, and no "No match" box
  await box.pressSequentially('please look');
  await page.waitForTimeout(700);
  await expect(
    page.locator('[data-suggest], [data-suggest-none], [data-suggest-busy]'),
    'the words after a picked name open no list',
  ).toHaveCount(0);
  await expect(box).toHaveValue(`Made-up look @${mate.name} please look`);
  await page.locator('[data-comment-add]').click();
  await expect(
    page.locator(`[data-comment] [data-mention="${mate.id}"]`),
    'the mention links to the person',
  ).toHaveText(`@${mate.name}`);
  // an @ that is not a name being started offers nobody
  await box.click();
  await box.pressSequentially('see you @ 5');
  await expect(page.locator('[data-suggest]'), '"@ 5" offers nobody').toHaveCount(0);
  await pc.context.close();

  // ---- a phone: the same, by taps
  const phone = await openAs(browser, owner, 'phone', `/tasks/${number}?tab=discussion`);
  page = phone.page;
  box = page.locator('[data-comments] textarea[name="comment"]');
  await box.tap();
  await box.pressSequentially('@');
  const rows = page.locator('[data-suggest] [data-suggest-item="person"]');
  await expect(rows.first(), 'a bare @ lists people at once on a phone').toBeVisible();
  await box.pressSequentially(`Qz${word}`);
  const row = rows.filter({ hasText: mate.name });
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height, 'a row is a 44 px target on a phone').toBeGreaterThanOrEqual(44);
  await row.tap();
  await expect(box, 'a tap picks the person on a phone').toHaveValue(`@${mate.name} `);
  await expect(page.locator(`[data-picked-person="${mate.id}"]`)).toBeVisible();
  expect(await sideways(page), 'nothing scrolls sideways on a phone').toBeLessThanOrEqual(0);
  await phone.context.close();

  // ---- a My day note: the list holds the colleagues who can see the note, and nobody else
  const stranger = await teammate(owner, `Qz${word} Stranger`);
  const note = await openAs(browser, owner, 'pc', '/my-day');
  page = note.page;
  const made = await callAs(note.context, 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up ${word} note` },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  await page.goto(`/my-day/notes/${(made.body as { id: string }).id}`);
  await hydrated(page);
  await page.getByLabel('Who sees it').click();
  await page.getByRole('option', { name: 'Named colleagues' }).click();
  await page.getByLabel('Add a colleague').click();
  await page.getByRole('option', { name: mate.name }).click();
  await page.locator('[data-note-save]').click();
  await expect(page.locator('[data-note-page] [data-visibility="person"]')).toBeVisible();
  box = page.locator('[data-comments] textarea[name="comment"]');
  await box.click();
  await box.pressSequentially('@');
  const noted = page.locator('[data-suggest] [data-suggest-item="person"]');
  await expect(noted, 'on a note a bare @ lists exactly who can see it').toHaveText([new RegExp(mate.name)]);
  await expect(
    noted.filter({ hasText: stranger.name }),
    'a colleague who cannot see the note is not listed',
  ).toHaveCount(0);
  await note.context.close();
});

test('3 — hand over, as the task’s Responsible: the dialog opens from both doors, on a PC and on a phone', async ({
  browser,
}) => {
  const word = tag();
  for (const role of ['member', 'manager'] as const) {
    const owner = await renamed(await staffAs(role), `Qh${word} ${role} Owner`);
    const mate = await teammate(owner, `Qh${word} ${role} Mate`);
    const number = await seedTask(owner, `Made-up ${word} ${role} handover`, { offset: 2 });
    for (const device of ['pc', 'phone'] as const) {
      const says = `a ${role} who is the Responsible, on a ${device}`;
      const { context, page } = await openAs(browser, owner, device, `/tasks/${number}`);
      const form = page.locator('[data-delegate]');
      const dialog = page.getByRole('dialog');
      const press = (l: Locator) => (device === 'phone' ? l.tap() : l.click());

      // ---- the button beside Responsible
      const open = page.locator('[data-hand-over-open]');
      await expect(open, `Hand over is offered beside Responsible — ${says}`).toBeVisible();
      await open.scrollIntoViewIfNeeded();
      await press(open);
      await expect(dialog, `the Hand over dialog opens from the button — ${says}`).toBeVisible();
      await expect(dialog, 'the dialog names the task').toContainText(`Hand over ${number}`);
      await expect(form.locator('textarea[name="reason"]'), 'the reason box is there').toBeVisible();
      await expect(form.locator('[data-reason-count]')).toHaveText('0 of 120 characters');
      await press(form.getByRole('combobox'));
      await expect(
        page.getByRole('option', { name: mate.name, exact: true }),
        'a teammate can be picked',
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: owner.name, exact: true }),
        'the Responsible is not offered themself',
      ).toHaveCount(0);
      await page.keyboard.press('Escape');
      await press(dialog.getByRole('button', { name: 'Cancel' }));
      await expect(dialog, 'Cancel closes it').toHaveCount(0);
      expect(await ownerOf(number), 'nothing was handed over by opening and closing').toBe(owner.id);

      // ---- the ⋯ menu
      await press(page.locator('[data-task-more]').first());
      const item = page.locator('[data-menu-delegate]');
      await expect(item, `the ⋯ menu offers Hand over — ${says}`).toBeVisible();
      await press(item);
      await expect(dialog, `the Hand over dialog opens from the ⋯ menu — ${says}`).toBeVisible();
      await expect(form, 'it is the same form').toBeVisible();
      const inside = (await dialog.boundingBox())!;
      const screen = page.viewportSize()!;
      expect(inside.x, 'the dialog is on the screen').toBeGreaterThanOrEqual(0);
      expect(inside.x + inside.width, 'the dialog is not wider than the screen').toBeLessThanOrEqual(screen.width);

      if (device === 'phone') {
        // ---- sent from a phone: the task changes hands, and the history says why
        await press(form.getByRole('combobox'));
        await press(page.getByRole('option', { name: mate.name, exact: true }));
        await form.locator('textarea[name="reason"]').fill(`Made-up ${word}: on leave`);
        await press(form.locator('[data-hand-over-send]'));
        await expect(toast(page, `Handed over to ${mate.name}`)).toBeVisible();
        await expect.poll(() => ownerOf(number), `the task changed hands — ${says}`).toBe(mate.id);
        await expect(dialog, 'the dialog closes once sent').toHaveCount(0);
        await page.reload();
        await hydrated(page);
        await expect(page.locator('[data-handovers] [data-handover-reason]')).toHaveText(`Made-up ${word}: on leave`);
        await expect(open, 'the former Responsible is no longer offered Hand over').toHaveCount(0);
        expect(await sideways(page), 'the page does not scroll sideways on a phone').toBeLessThanOrEqual(0);
      } else {
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }
      await context.close();
    }
  }
});
