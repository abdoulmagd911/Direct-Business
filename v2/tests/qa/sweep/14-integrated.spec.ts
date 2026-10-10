/**
 * The integrated pass the Architect asked for on #147 (2 Oct, 12:23 UTC): once #151, #147 and #150 are on v2/main,
 * one walk through the work loop with the pilot's access levels (the deferred modules at none on the member and manager
 * roles, V517) and Arabic off, at 1440 and 390:
 *   a task made from a note · a task from a next step (#141) · an achievement from a task · the Past work grid for
 *   tasks and achievements · KPIs reading the achievements · the numbers (TSK-, ACH-) · My day and the employee view.
 * A step whose screen or door is not on the build is NOT BUILT, never FAIL. Kept out of the full sweep (it changes role
 * levels, then puts them back): run with QA_INTEGRATED=1 tests/qa/sweep/run.sh -- --grep "integrated pass".
 * Made-up people and values only (seed.mjs).
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiAs, fx, hydrated, info, notBuilt, said, signIn, sql, user, verdict } from './lib';
import { V2_DIR } from './paths.mjs';

const AREA = 'integrated';
const DEFERRED = ['finance', 'kpis', 'pipeline', 'projects', 'overview', 'reports', 'appraisal'];
const PILOT_ROLES = ['member', 'manager'];
const REASON = 'QA integrated pass: made up';
const TSK = /\bTSK-\d{4}-\d{3,}\b/;
const ACH = /\bACH-\d{4}-\d{3,}\b/;
type Where = { screen?: string; user?: string; detail?: string };
const check = (expected: string, w: Where, ok: boolean) => verdict({ area: AREA, ...w, check: expected }, ok);
const gap = (what: string, w: Where = {}) => notBuilt({ area: AREA, ...w, check: what });
const has = (...parts: string[]) => existsSync(join(V2_DIR, 'src', ...parts));
const mainText = async (page: Page) =>
  (
    (await page
      .getByRole('main')
      .innerText()
      .catch(() => '')) ?? ''
  ).replace(/\s+/g, ' ');

async function menuLinks(page: Page, phone: boolean): Promise<string[]> {
  if (phone) {
    const more = page.getByRole('button', { name: /More/ }).last();
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  const hrefs = await page
    .locator('nav a[href], [role=dialog] a[href]')
    .evaluateAll((as) => [...new Set(as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))]);
  await page.keyboard.press('Escape').catch(() => undefined);
  return hrefs;
}

test.describe.configure({ mode: 'serial' });

test('integrated pass: the work loop with the pilot levels — notes, tasks, achievements, numbers, My day', async ({
  page,
}) => {
  test.setTimeout(900_000);
  if (!has('modules', 'tasks', 'screens', 'QuickAdd.tsx'))
    return gap('the integrated pass needs the Tasks screens (#147) on the build');
  const tag = `${fx().tag}${Math.random().toString(36).slice(2, 5)}`;
  const admin = await apiAs('admin');
  const roles = await sql<{ id: string; key: string }>(`select id::text, key from core.role where key = any($1)`, [
    PILOT_ROLES,
  ]);
  const before = await sql<{ role_id: string; page_key: string; level: string }>(
    `select role_id::text, page_key, level::text from core.role_page_level
      where role_id = any($1::uuid[]) and page_key = any($2) and deleted_at is null`,
    [roles.map((r) => r.id), DEFERRED],
  );
  // one made-up home team for the pilot people (a task needs one: task.team_required)
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, 'فريق اختبار' from core.person where id = $1 returning id::text`,
    [user('member').id, `qa_i_${tag}`, `Test Team ${tag}`],
  );
  await sql(`update core.person set team_id = $2 where id = any($1::uuid[])`, [
    [user('member').id, user('manager').id],
    team!.id,
  ]);
  const [tasksLevel] = await sql<{ level: string }>(`select authz.level_of($1, 'tasks')::text as level`, [
    user('member').id,
  ]);
  info({
    area: AREA,
    check: `Tasks for a pilot member stays at ${tasksLevel?.level} here: whether stage 0 opens it is QA-236 (pilot row 7)`,
  });
  for (const r of roles)
    for (const p of DEFERRED) {
      const a = await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: 'none', p_reason: REASON });
      if (!a.ok) info({ area: AREA, check: `set ${r.key} · ${p} to none: ${said(a)}` });
    }

  try {
    // ---------------------------------------------------------------- My day, the employee view, a task and its number
    for (const persona of PILOT_ROLES) {
      await page.context().clearCookies();
      await signIn(page, persona, '/my-day');
      await hydrated(page);
      for (const width of [1440, 390]) {
        const phone = width < 600;
        const at = (s: string) => ({ screen: `${s} @${width}`, user: persona });
        await page.setViewportSize({ width, height: phone ? 844 : 1000 });
        await page.goto('/my-day');
        await hydrated(page);
        const day = await mainText(page);
        check(
          'My day opens with its day and Capture',
          { ...at('/my-day'), detail: day.slice(0, 120) },
          /Capture/.test(day),
        );
        const links = await menuLinks(page, phone);
        const deferred = links.filter((l) => DEFERRED.some((d) => l === `/${d}` || l.startsWith(`/${d}/`)));
        check(
          'the employee view: My day, Tasks and Clients, no deferred module',
          { ...at('menu'), detail: links.join(' ') },
          ['/my-day', '/tasks'].every((l) => links.includes(l)) &&
            links.some((l) => l.startsWith('/clients') || l.startsWith('/partners')) &&
            deferred.length === 0,
        );

        // quick add a task; it lands in My work with its TSK- number, and its record shows the number
        const title = `Test task ${persona} ${width} ${tag}`;
        await page.goto('/tasks');
        await hydrated(page);
        await page.locator('[data-add-task]').first().click();
        const form = page.locator('form[data-quick-add]');
        await form.locator('input[name="title"]').fill(title);
        await form.locator('button[type="submit"]').click();
        // the saved task (the toast also names it, so the list's own row is what is waited for)
        let made: { number: string } | undefined;
        for (let i = 0; i < 30 && !made; i++) {
          [made] = await sql<{ number: string }>(`select number from work.task where title = $1`, [title]);
          if (!made) await page.waitForTimeout(500);
        }
        const row = page.locator(`[data-task-row="${made?.number ?? 'none'}"]`);
        const listed = await row
          .waitFor({ timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        check(
          'a task added from Tasks is listed in My work with a TSK- number',
          { ...at('/tasks'), detail: `listed ${listed}; number ${made?.number ?? 'none'}` },
          listed && TSK.test(made?.number ?? ''),
        );
        if (listed && made) {
          // the row links to the record by its number; the record is opened by that address
          const linked = await row.locator(`a[href="/tasks/${made.number}"]`).count();
          await page.goto(`/tasks/${made.number}`);
          await hydrated(page);
          const rec = await mainText(page);
          check(
            "the task's row links to its record, and the record shows its number and title",
            { ...at(`/tasks/${made.number}`), detail: `row links ${linked}; ${rec.slice(0, 120)}` },
            linked > 0 && rec.includes(made.number) && rec.includes(title) && !/My work/.test(rec.slice(0, 60)),
          );
          // an achievement from a task: an action on the task's record
          const fromTask = await page
            .getByRole('button', { name: /achievement/i })
            .or(page.getByRole('link', { name: /achievement/i }))
            .count();
          if (fromTask === 0)
            gap('an achievement from a task: the task record offers no achievement action', at('/tasks/:number'));
          else info({ area: AREA, ...at('/tasks/:number'), check: `the task record offers an achievement action` });
        }
      }
    }

    // ---------------------------------------------------------------- a task made from a note (desktop, the member)
    await page.context().clearCookies();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page, 'member', '/my-day');
    await hydrated(page);
    const member = await apiAs('member');
    const cap = await member('note_capture', {
      p_kind: 'sticky',
      p_values: { title: `Test note: chase the rate sheet ${tag}`, visibility: 'private' },
    });
    if (!cap.ok) gap(`a task made from a note: note_capture ${said(cap)}`, { user: 'member' });
    else {
      const noteId = (cap.data as { id: string }).id;
      await page.goto(`/my-day/notes/${noteId}`);
      await hydrated(page);
      await page.locator('[data-turn-into]').click();
      const kinds = await page
        .locator('[data-turn-kind]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-turn-kind') ?? ''));
      await page.keyboard.press('Escape');
      const door = await member('note_turn_into', { p_note: noteId, p_kind: 'task', p_values: { title: 'probe' } });
      if (!kinds.includes('task'))
        gap('a task made from a note: Turn into offers no Task', {
          screen: '/my-day/notes/:id',
          user: 'member',
          detail: `offered ${kinds.join(', ')}; the door: ${door.ok ? 'answers' : `${door.key} ${door.detail ?? ''}`}`,
        });
      else {
        // offered: the menu path is exercised by the screen's own tests; here the record and its number
        const [t] = await sql<{ number: string }>(
          `select t.number from my.note_link l join work.task t on t.id = l.entity_id
            where l.note_id = $1 and l.entity_table = 'work.task' and l.deleted_at is null`,
          [noteId],
        );
        check(
          'a task made from a note is a task with its TSK- number, linked to the note',
          { screen: '/my-day/notes/:id', user: 'member', detail: t?.number ?? said(door) },
          TSK.test(t?.number ?? ''),
        );
      }
    }

    // ---------------------------------------------------------------- a next step makes a task (#141, V197; the member)
    const alpha = fx().orgs.alpha;
    const step = `Test next step: send the made-up offer ${tag}`;
    const due = new Date(`${fx().today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 3);
    const stepOn = due.toISOString().slice(0, 10);
    await page.goto(`/clients/${alpha.id}`);
    await hydrated(page);
    const logButton = page.locator('[data-activity-log]').first();
    if ((await logButton.count()) === 0)
      gap('a next step makes a task: the client record offers no Log activity', {
        screen: '/clients/:id',
        user: 'member',
      });
    else {
      await logButton.click();
      const form = page.locator('[data-activity-form]');
      await form.getByLabel('Type').click();
      await page.getByRole('option', { name: 'Call' }).click();
      const outcome = form.getByLabel('Outcome');
      if (await outcome.isEnabled()) {
        await outcome.click();
        await page.getByRole('option').first().click();
      }
      await form.getByLabel('Next step', { exact: true }).fill(step);
      await form.getByLabel('Next step on').fill(stepOn);
      await page.locator('[data-activity-save]').click();
      type Made = { number: string | null; due_on: string | null; owner: string | null; origin: string | null };
      const made = async () =>
        (
          await sql<Made>(
            `select t.number, t.due_on::text, t.owner_id::text as owner, t.origin
               from core.note n left join work.task t on t.id = n.next_step_task_id
              where n.next_step = $1 and n.deleted_at is null`,
            [step],
          )
        )[0];
      await expect
        .poll(async () => (await made())?.number ?? '', { timeout: 15_000 })
        .toMatch(TSK)
        .catch(() => undefined);
      const t = await made();
      check(
        'a next step logged on a client makes its author a task: a TSK- number, the step’s day, origin next_step',
        { screen: '/clients/:id → Log activity', user: 'member', detail: t ? JSON.stringify(t) : 'no activity saved' },
        TSK.test(t?.number ?? '') &&
          t?.due_on === stepOn &&
          t?.owner === user('member').id &&
          t?.origin === 'next_step',
      );
      if (t?.number) {
        await page.goto('/tasks');
        await hydrated(page);
        const row = page.locator(`[data-task-row="${t.number}"]`);
        await row.waitFor({ timeout: 10_000 }).catch(() => undefined);
        check(
          'the next step’s task is listed in Tasks · My work',
          { screen: '/tasks', user: 'member', detail: t.number },
          (await row.count()) > 0,
        );
      }
    }

    // ---------------------------------------------------------------- the Past work grid (tasks mode, #150)
    await page.goto('/tasks');
    await hydrated(page);
    const pastLink = await page.locator('a[href="/tasks?view=past"]').count();
    await page.goto('/tasks?view=past');
    await hydrated(page);
    const grid = page.locator('[data-past-work-grid="tasks"]');
    if ((await grid.count()) === 0)
      gap('the Past work grid for tasks (#150)', { screen: '/tasks?view=past', user: 'member' });
    else {
      check('Tasks offers the Past work view', { screen: '/tasks', user: 'member' }, pastLink > 0);
      // three made-up rows from the Commercial quarterly for Q3 2026; the third is dated after the quarter's report day
      const rows = [
        [`Test past one ${tag}`, '14/07/2026', 'Done'],
        [`Test past two ${tag}`, '21/08/2026', 'Done'],
        [`Test past late ${tag}`, '25/12/2030', 'Done'],
      ].map((r) => r.join('\t'));
      const calls: string[] = [];
      page.on('request', (r) => {
        if (r.url().includes('/rpc/backfill_tasks')) calls.push(r.method());
      });
      await grid.getByLabel('Source report').click();
      await page.getByRole('option', { name: 'Commercial quarterly' }).click();
      await grid.getByLabel('Which report').click();
      await page.getByRole('option', { name: 'Q3 2026' }).click();
      await grid.locator('[data-past-work-paste]').fill(['Title\tDate\tStatus', ...rows].join('\n'));
      // the grid checks names and saved keys before it settles; wait for its summary to say so
      await expect(grid.locator('[data-past-work-summary]'))
        .toContainText(/2 rows ready/, { timeout: 15_000 })
        .catch(() => undefined);
      const summary = (
        await grid
          .locator('[data-past-work-summary]')
          .innerText()
          .catch(() => '')
      ).trim();
      check(
        'the grid reads the paste: two rows ready, the one dated in the future refused',
        { screen: '/tasks?view=past', user: 'member', detail: summary },
        /2 rows ready/.test(summary) && /1 refused/.test(summary),
      );
      await grid.locator('[data-past-work-save]').click();
      await page.waitForTimeout(3_000);
      const saved = await sql<{ number: string; past: boolean }>(
        `select number, work.task_is_past(t) as past from work.task t where title like $1 order by number`,
        [`Test past % ${tag}`],
      );
      check(
        'saved as one request: the ready rows only, each with a TSK- number, all past work',
        {
          screen: '/tasks?view=past',
          user: 'member',
          detail: `${calls.length} call(s); ${saved.map((r) => `${r.number}${r.past ? '' : ' (live!)'}`).join(', ')}`,
        },
        calls.length === 1 && saved.length === 2 && saved.every((r) => r.past && TSK.test(r.number)),
      );
      await page.goto('/tasks?view=past');
      await hydrated(page);
      const inPast = await page.locator('li[data-task-row]', { hasText: `Test past` }).count();
      await page.goto('/tasks');
      await hydrated(page);
      const inMyWork = await page.locator('li[data-task-row]', { hasText: `Test past` }).count();
      check(
        'past work is listed under Past work, never in My work',
        { screen: '/tasks', user: 'member', detail: `Past work ${inPast}, My work ${inMyWork}` },
        inPast >= 2 && inMyWork === 0,
      );
      // the phone: the view opens without sideways scroll
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/tasks?view=past');
      await hydrated(page);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(
        'Past work at 390: no sideways scroll',
        { screen: '/tasks?view=past @390', user: 'member', detail: `${wide}px` },
        wide <= 1,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    gap("the Past work grid for achievements (the grid's achievements mode, after #105)", {
      screen: '/kpis/achievements',
    });

    // ---------------------------------------------------------------- KPIs, achievements and their ACH- numbers
    await page.goto('/kpis');
    await hydrated(page);
    const pilotKpis = await mainText(page);
    check(
      'KPIs read as no access for a pilot member (deferred)',
      { screen: '/kpis', user: 'member', detail: pilotKpis.slice(0, 100) },
      /do not have access|not available to you/i.test(pilotKpis),
    );
    if (!has('app', '(app)', 'kpis', 'achievements', 'page.tsx')) gap('achievements (#151) on the build');
    else {
      const dept = user('admin');
      const [d] = await sql<{ id: string }>(`select department_id::text as id from core.person where id = $1`, [
        dept.id,
      ]);
      const year = Number(fx().today.slice(0, 4));
      const opened = await admin('plan_open', { p_department: d!.id, p_year: year });
      if (!opened.ok && !/exists|held|already/i.test(opened.key ?? ''))
        info({ area: AREA, check: `plan_open ${year}: ${said(opened)}` });
      const logged = await admin('achievement_log', {
        p_values: { category: 'PROBLEM', title: `Test achievement ${tag}`, happened_on: fx().today },
      });
      const number = (logged.data as { number?: string } | null)?.number ?? '';
      check(
        'an achievement is logged with its ACH- number',
        { screen: 'api.achievement_log', user: 'admin', detail: logged.ok ? number : said(logged) },
        logged.ok && ACH.test(number),
      );
      await page.context().clearCookies();
      await signIn(page, 'admin', '/kpis/achievements');
      await hydrated(page);
      const list = await mainText(page);
      check(
        'the achievements list shows it with its number',
        { screen: '/kpis/achievements', user: 'admin', detail: list.slice(0, 160) },
        !!number && list.includes(number),
      );
      // an achievement from a note (V379, V381; QA-517): Turn into offers it to KPIs Own or Full, one request makes it with
      // its ACH- number, and the two link both ways
      const cap = await admin('note_capture', {
        p_kind: 'sticky',
        p_values: { title: `Test note: a made-up win ${tag}`, visibility: 'private' },
      });
      if (!cap.ok) gap(`an achievement from a note: note_capture ${said(cap)}`, { user: 'admin' });
      else {
        const noteId = (cap.data as { id: string }).id;
        await page.goto(`/my-day/notes/${noteId}`);
        await hydrated(page);
        await page.locator('[data-turn-into]').click();
        const kinds = await page
          .locator('[data-turn-kind]')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-turn-kind') ?? ''));
        await page.keyboard.press('Escape');
        if (!kinds.includes('achievement'))
          gap('an achievement from a note: Turn into offers no Achievement', {
            screen: '/my-day/notes/:id',
            user: 'admin',
            detail: `offered ${kinds.join(', ')}`,
          });
        else {
          const made = await admin('note_turn_into', {
            p_note: noteId,
            p_kind: 'achievement',
            p_values: { category: 'PROBLEM' },
          });
          const a = (made.data as { id?: string; number?: string } | null) ?? {};
          check(
            'a note turned into an achievement has its ACH- number',
            { screen: '/my-day/notes/:id', user: 'admin', detail: made.ok ? a.number : said(made) },
            made.ok && ACH.test(a.number ?? ''),
          );
          if (a.id) {
            await page.goto(`/my-day/notes/${noteId}`);
            await hydrated(page);
            const chip = page.locator(`[data-note-links] a[href="/kpis/achievements/${a.id}"]`);
            await page.goto(`/kpis/achievements/${a.id}`);
            await hydrated(page);
            const back = await page.locator('[data-from-note]').count();
            await page.goto(`/my-day/notes/${noteId}`);
            await hydrated(page);
            check(
              'the note and the achievement link both ways (the chip opens it, From note leads back)',
              { screen: '/my-day/notes/:id ↔ /kpis/achievements/:id', user: 'admin' },
              (await chip.count()) > 0 && back > 0,
            );
          }
        }
      }
      await page.goto('/kpis');
      await hydrated(page);
      const kpis = await mainText(page);
      if (/Being built/i.test(kpis))
        gap('KPIs reading the achievements: /kpis is still "Being built"', { screen: '/kpis', user: 'admin' });
      else if (/\/kpis\/achievements(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search))
        gap(
          'KPIs reading the achievements: /kpis opens the achievements list (V605); the KPI page itself is not built',
          {
            screen: '/kpis → /kpis/achievements',
            user: 'admin',
          },
        );
      else
        check(
          'KPIs read the achievements (the count or the logged one is shown)',
          { screen: '/kpis', user: 'admin', detail: kpis.slice(0, 160) },
          /achievement/i.test(kpis),
        );
    }
  } finally {
    for (const r of roles)
      for (const p of DEFERRED) {
        const was = before.find((b) => b.role_id === r.id && b.page_key === p);
        if (was)
          await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: was.level, p_reason: REASON });
        else
          await sql(
            `update core.role_page_level set deleted_at = now(), delete_reason = $3
              where role_id = $1 and page_key = $2 and deleted_at is null`,
            [r.id, p, REASON],
          );
      }
  }
  expect(user('admin').id).toBeTruthy();
});
