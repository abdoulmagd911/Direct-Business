import { expect, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './stack';

/** Every visible tappable thing under 44 px high, described so a failure names it. */
export const small = (page: Page) =>
  page.evaluate(() => {
    const tappable =
      'a[href], button, summary, [role=button], [role=tab], [role=link], [role=menuitem], [role=checkbox], [role=switch], [role=option], input:not([type=hidden]):not(.sr-only), select, textarea';
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(tappable))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || (r.height >= 43.5 && r.width >= 43.5)) continue;
      if (el.closest('[data-inline-link]') || (el.tagName === 'A' && el.closest('p'))) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const words = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
      found.push(`${Math.round(r.width)} x ${Math.round(r.height)} px: <${el.tagName.toLowerCase()}> ${words}`);
    }
    return Array.from(new Set(found));
  });

export async function seed(page: Page) {
  const me = await makePerson({ admin: true });
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [me.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
    [me.id],
  );
  await signIn(page, me.email, '/my-day');
  const ctx = page.context();
  const name = `Test Org Tap ${Math.random().toString(36).slice(2, 8)}`;
  const org = await callAs(ctx, 'partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(org.status, JSON.stringify(org.body)).toBe(200);
  const clientId = (org.body as { id: string }).id;
  const task = await callAs(ctx, 'task_create', { p_values: { title: `Made-up tap ${name}`, partner_id: clientId } });
  expect(task.status, JSON.stringify(task.body)).toBe(200);
  const { number } = task.body as { number: string };
  await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [number]);
  return { me, clientId, number };
}

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** The walk both languages share: every page and everything a finger opens from them, all that is small reported at once. */
export async function walk(page: Page, me: { id: string }, clientId: string, number: string): Promise<string[]> {
  const pages = [
    '/my-day',
    '/tasks',
    `/tasks/${number}`,
    '/clients',
    `/clients/${clientId}`,
    '/suppliers',
    '/finance',
    '/profile',
    '/people',
    `/people/${me.id}`,
    '/reports',
    '/achievements',
    '/projects',
    '/kpis',
    '/settings/org',
    '/activity',
  ];
  const bad: string[] = [];
  const measure = async (where: string) => bad.push(...(await small(page)).map((x) => `${where} — ${x}`));
  for (const path of pages) {
    await page.goto(path);
    await hydrated(page).catch(() => undefined);
    await measure(path);
  }
  // what a finger opens from a client's page and from My day
  await page.goto(`/clients/${clientId}`);
  await hydrated(page);
  await page.locator('[data-activity-log]').first().click();
  await expect(page.locator('[data-activity-form]')).toBeVisible();
  await measure('Log activity');
  await page.keyboard.press('Escape');
  await page.locator('[data-partner-more]').click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  await measure('the ⋯ menu');
  await page.keyboard.press('Escape');
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-bell]').click();
  await expect(page.locator('[data-notifications-panel]')).toBeVisible();
  await measure('the bell');
  return bad;
}

/**
 * QA-580: a short reminder title on My day's Today list starts right after the tick — the words sit at the start edge of
 * their link (left in English, right in Arabic), not centred in it. Returns the gap in px between the link's start edge
 * and its first letter, and the link's width.
 */
export async function reminderStartGap(page: Page, personId: string, title: string) {
  const ctx = page.context();
  const made = await callAs(ctx, 'note_capture', {
    p_kind: 'reminder',
    p_values: { title, remind_at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  await sql(
    `update core.reminder r set remind_at = core.clock() + interval '2 minutes'
       from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
    [personId, title],
  );
  await page.goto('/my-day');
  await hydrated(page);
  const link = page.locator('[data-today-reminder]', { hasText: title }).locator('a[data-today-open]');
  await expect(link).toBeVisible();
  return link.evaluate((a) => {
    const box = a.getBoundingClientRect();
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode() as Text;
    const range = document.createRange();
    range.selectNodeContents(text);
    const word = range.getBoundingClientRect();
    const rtl = getComputedStyle(a).direction === 'rtl';
    return { gap: Math.round((rtl ? box.right - word.right : word.left - box.left) * 10) / 10, width: box.width };
  });
}

/** QA-584: the widths in px of the note-title links on My day's notes list for notes with these (short) titles. */
export async function noteLinkWidths(page: Page, titles: string[]) {
  for (const title of titles) {
    const made = await callAs(page.context(), 'note_capture', {
      p_kind: 'sticky',
      p_values: { title, visibility: 'private' },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
  }
  await page.goto('/my-day');
  await hydrated(page);
  const out: Record<string, { width: number; height: number }> = {};
  for (const title of titles) {
    const link = page.locator('[data-my-note]', { hasText: title }).locator('a[data-note-open]').first();
    await expect(link).toBeVisible();
    const box = await link.evaluate((a) => {
      const r = a.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    out[title] = box;
  }
  return out;
}
