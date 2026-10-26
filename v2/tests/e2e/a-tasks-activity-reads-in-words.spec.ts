/**
 * B (26 Oct): a task's Activity tab reads in words.
 * - People by name, never an id ("Owner: <name> → <name>").
 * - Days as "2 Nov 2026", never "2026-11-02".
 * - A line when a helper is added, naming them.
 * - A line when the reader sets a follow-up on it, with its time. Only its author sees that line.
 * - Undo on the reader's own newest action only.
 * At 1280 px and 375 px. Every value is made up.
 * Sabotages: tests/sabotage/activity-in-words.mjs; supabase/tests/sabotage/history-shows-every-follow-up.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [1280, 375]) {
  test(`a task's Activity tab says who and when in words, with Undo on the reader's newest action only — at ${width} px`, async ({
    page,
    browser,
  }) => {
    const owner = await makePerson({ admin: true });
    const mate = await makePerson({});
    const t = Math.random().toString(36).slice(2, 8);
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [owner.id, `hist_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id in ($1, $3)`, [owner.id, team!.id, mate.id]);
    const ownerName = (
      await sql<{ name: string }>(`select full_name_en as name from core.person where id = $1`, [owner.id])
    )[0]!.name;
    const mateName = (
      await sql<{ name: string }>(`select full_name_en as name from core.person where id = $1`, [mate.id])
    )[0]!.name;

    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, owner.email, '/my-day');
    await hydrated(page);
    const ctx = page.context();
    const made = await callAs(ctx, 'task_create', {
      p_values: { title: `Made-up history ${t}`, due_on: '2026-10-30' },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const { id, number } = made.body as { id: string; number: string };
    expect((await callAs(ctx, 'task_helpers_set', { p_id: id, p_people: [mate.id] })).status).toBe(200);
    const moved = await callAs(ctx, 'task_update', { p_id: id, p_values: { due_on: '2026-11-02' }, p_version: 1 });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    const given = await callAs(ctx, 'tasks_assign', { p_ids: [id], p_owner: mate.id });
    expect(given.status, JSON.stringify(given.body)).toBe(200);
    const follow = await callAs(ctx, 'note_capture', {
      p_kind: 'reminder',
      p_values: {
        title: 'Follow-up',
        visibility: 'private',
        remind_at: '2026-10-28T09:00:00+03:00',
        about: { entity: 'task', id },
      },
    });
    expect(follow.status, JSON.stringify(follow.body)).toBe(200);

    await page.goto(`/tasks/${number}?tab=activity`);
    await hydrated(page);
    const rows = page.locator('[data-history-row]');
    await expect(rows.first()).toBeVisible();
    const all = (await rows.allInnerTexts()).join('\n');
    expect(all, 'no id is ever shown').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    expect(all, 'no raw date is ever shown').not.toMatch(/\d{4}-\d{2}-\d{2}/);
    await expect(page.locator('[data-history-field="due_on"]'), 'days in words').toHaveText(
      'Due on: 30 Oct 2026 → 2 Nov 2026',
    );
    await expect(rows.filter({ hasText: 'Helper added' }), 'a helper added is a line, by name').toContainText(mateName);
    await expect(page.locator('[data-history-field="owner_id"]'), 'people by name').toHaveText(
      `Owner: ${ownerName} → ${mateName}`,
    );
    const followRow = rows.filter({ hasText: 'Follow-up added' });
    await expect(followRow, 'the follow-up set is a line, with its time').toContainText('28 Oct 2026');
    await expect(page.locator('[data-undo-request]'), "Undo only on the reader's newest action").toHaveCount(1);
    await expect(rows.first().locator('[data-undo-request]'), 'which is the newest line').toHaveCount(1);
    await expect(rows.first()).toContainText('Follow-up added');
    expect(all).toContain(ownerName);

    // the helper sees the task's history without the owner's follow-up, and no Undo for what they did not do
    const other = await browser.newContext();
    const seen = await other.newPage();
    await seen.setViewportSize({ width, height: 1000 });
    await signIn(seen, mate.email, `/tasks/${number}?tab=activity`);
    await hydrated(seen);
    await expect(seen.locator('[data-history-row]').first()).toBeVisible();
    await expect(
      seen.locator('[data-history-row]', { hasText: 'Follow-up added' }),
      "another's follow-up is private",
    ).toHaveCount(0);
    await expect(seen.locator('[data-undo-request]'), 'no Undo on what the reader did not do').toHaveCount(0);
    await other.close();
  });
}
