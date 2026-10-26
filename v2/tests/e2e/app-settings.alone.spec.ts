/**
 * The admin's App settings reach every screen (QA-207, V182, V214; ACC-090, ACC-091, ACC-129): the default start page,
 * theme and density a person without their own gets, and the language switch once Arabic is on. Each changes a setting
 * of the whole app, which every other spec running at the same moment would see — so these run alone, after all the
 * others (playwright.config.ts, the `alone` project). Every value is made up.
 *
 * QA-556 lives here too: New invoice is offered at the three doors (the desktop Create menu, Ctrl K and the phone's
 * phone's Create) to a person with Full on Finance, who lands on /finance/new, and to nobody with Finance at View — each in
 * English and in Arabic. It needs Arabic on, so it belongs with the other tests that switch it, in the one file: two
 * files of the `alone` project may run at the same moment, and two of them switching Arabic would meet.
 * Sabotage: tests/sabotage/qa556.mjs "finance-page-not-built".
 *
 * The weekly review in Arabic (V632 Stage 3) lives here for the same reason: it switches Arabic on, and a second `alone`
 * file doing so at the same moment collided on the one setting per date (main b8ad0c3).
 * Sabotage: tests/sabotage/weekly-review.mjs "weekly-review-title-is-the-door-word".
 *
 * The 44 px wide-and-high walk in Arabic (V643) lives here for the same reason.
 * Sabotages: tests/sabotage/tap-sizes.mjs "the-shared-tap-rule-is-gone", "the-tap-rule-forgets-the-width".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { setPrefs } from './helpers';
import { ensureAchievementPlan } from './support/achievement-plan';
import { callAs, makePerson, signIn, sql } from './support/stack';
import { noteLinkWidths, reminderStartGap, seed, walk } from './support/taps';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test("the admin's default start page applies to a person without their own (ACC-091)", async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.default_start_page', '"tasks"'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await signIn(page, member.email, '/');
    await expect(page).toHaveURL(/\/tasks$/);
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.default_start_page'`);
  }
});

test("the admin's default theme and density apply to a person without their own (ACC-090)", async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  // the registry sync (V636) wrote the new Light default dated today; the admin's value below is dated today too, so the
  // sync's row is put away first and the admin's value is the one in force, as it is when an admin changes it later
  await sql(
    `update core.setting set deleted_at = now(), delete_reason = 'made-up test'
      where key = 'app.default_theme' and reason = 'default' and valid_from > date '2000-01-01' and deleted_at is null`,
  );
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by) values
       ('app.default_theme', '"dark"'::jsonb, current_date, 'Made-up reason', $1),
       ('app.default_density', '"compact"'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    // their own choice still wins
    await sql(
      `insert into core.person_profile (person_id, created_by, theme) values ($1, $1, 'light')
       on conflict (person_id) do update set theme = 'light'`,
      [member.id],
    );
    await page.reload();
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  } finally {
    await sql(`update core.setting set deleted_at = now() where key in ('app.default_theme', 'app.default_density')`);
  }
});

test('once Arabic is on, the switch shows and the cookie is honoured (ACC-129)', async ({ page, context }) => {
  const admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await page.goto('/sign-in');
    // the door draws the button twice — in the phone's bar and beside the form on a wide screen — and shows one
    await expect(page.locator('[data-door-language]:visible')).toBeVisible();
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    // the language lives in My profile's Preferences, not in the profile chip's menu (V217, cut 5)
    await page.goto('/profile');
    await hydrated(page);
    await expect(page.locator('main').getByText('Language', { exact: true })).toBeVisible();
    // My profile keeps the language cookie as its own cache, so the cookie choice is tried on another page
    await page.goto('/my-day');
    await hydrated(page);
    await setPrefs(context, { locale: 'ar' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});

// ---- QA-556: New invoice at the three doors, in English and in Arabic

type Words = { top: { create: string }; create: { invoice: string } };
/** The words as the catalogs spell them, so the screen is held to the catalog in each language. */
const catalog = (code: 'en' | 'ar') =>
  JSON.parse(readFileSync(join(process.cwd(), 'messages', `${code}.json`), 'utf8')) as Words;

/** Arabic on for the length of one case, then off again (the setting reaches every screen, which is why this file runs alone). */
async function withArabic(run: () => Promise<void>) {
  const admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: QA-556 specs', $1)`,
    [admin.id],
  );
  try {
    await run();
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
}

for (const code of ['en', 'ar'] as const) {
  const words = catalog(code);
  const create = words.top.create;
  const invoice = words.create.invoice;

  test(`in ${code}: Full on Finance — the desktop Create menu, Ctrl K and the phone + all offer Invoice, which opens /finance/new`, async ({
    page,
    context,
  }) => {
    await withArabic(async () => {
      const admin = await makePerson({ admin: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, admin.email, '/my-day');
      await hydrated(page);
      // the language is chosen after signing in: the sign-in helper types into the English form
      await setPrefs(context, { locale: code });
      await page.goto('/my-day');
      await hydrated(page);
      await expect(page.locator('html')).toHaveAttribute('lang', code);

      // 1 · the desktop Create menu
      await page.locator('[data-create]').click();
      const item = page.locator('[data-create-item="invoice"]');
      await expect(item, 'Create offers Invoice').toBeVisible();
      await expect(item).toHaveText(invoice);
      await item.click();
      await expect(page).toHaveURL(/\/finance\/new$/);
      await hydrated(page);
      await expect(page.locator('[data-new-invoice]')).toBeVisible();

      // 2 · Ctrl K
      await page.goto('/my-day');
      await hydrated(page);
      await page.keyboard.press('Control+k');
      const palette = page.locator('[data-command-palette]');
      await palette.getByRole('combobox').fill(invoice);
      const option = palette.getByRole('option', { name: `${create} · ${invoice}`, exact: true });
      await expect(option, 'Ctrl K offers Invoice').toBeVisible();
      await option.click();
      await expect(page).toHaveURL(/\/finance\/new$/);

      // 3 · the phone's Create
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/my-day');
      await hydrated(page);
      await page.locator('[data-create-bar]').click();
      const phoneItem = page.locator('[data-create-item="invoice"]');
      await expect(phoneItem, 'the + offers Invoice').toBeVisible();
      await phoneItem.click();
      await expect(page).toHaveURL(/\/finance\/new$/);
    });
  });

  test(`in ${code}: View on Finance — no Invoice at any of the three doors, and the other items are still there`, async ({
    page,
    context,
  }) => {
    await withArabic(async () => {
      // a member with Finance at View: Create still offers their other items, never Invoice
      const person = await makePerson();
      await sql(
        `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
         values ($1, 'finance', 'view', 'Made-up: view only on Finance (QA-556)', $1)`,
        [person.id],
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, person.email, '/my-day');
      await hydrated(page);
      await setPrefs(context, { locale: code });
      await page.goto('/my-day');
      await hydrated(page);
      await expect(page.locator('html')).toHaveAttribute('lang', code);

      await page.locator('[data-create]').click();
      await expect(page.locator('[data-create-item="client"]'), 'Create still offers other items').toBeVisible();
      await expect(page.locator('[data-create-item="invoice"]'), 'no Invoice in Create').toHaveCount(0);
      await page.keyboard.press('Escape');

      await page.keyboard.press('Control+k');
      const palette = page.locator('[data-command-palette]');
      await palette.getByRole('combobox').fill(invoice);
      await expect(palette.getByRole('option', { name: `${create} · ${invoice}`, exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/my-day');
      await hydrated(page);
      await page.locator('[data-create-bar]').click();
      await expect(page.locator('[data-create-item="client"]'), 'the + still offers other items').toBeVisible();
      await expect(page.locator('[data-create-item="invoice"]'), 'no Invoice in the +').toHaveCount(0);
    });
  });

  // Create is the bar's last slot on a phone (the architect's ruling of 15 Oct, option C): with six slots at 375 px,
  // each is still a 44 px target and every word fits whole, in each language
  test(`in ${code} at 375 px: an admin's bar holds six slots, Create last, each at least 44 px wide with its label whole`, async ({
    page,
    context,
  }) => {
    await withArabic(async () => {
      const admin = await makePerson({ admin: true });
      await page.setViewportSize({ width: 375, height: 800 });
      await signIn(page, admin.email, '/my-day');
      await hydrated(page);
      await setPrefs(context, { locale: code });
      await page.goto('/my-day');
      await hydrated(page);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      const slots = await page.locator('[data-bottom-bar] > a, [data-bottom-bar] > button').evaluateAll((els) =>
        els.map((el) => {
          const label = [...el.querySelectorAll('span')].at(-1)!;
          return {
            text: label.textContent,
            width: el.getBoundingClientRect().width,
            cut: label.scrollWidth > label.clientWidth,
            create: el.hasAttribute('data-create-bar'),
          };
        }),
      );
      expect(slots.length, 'six slots on a phone').toBe(6);
      expect(slots.at(-1)!.create, 'Create is the last slot').toBe(true);
      expect(slots.at(-1)!.text).toBe(create);
      for (const s of slots) {
        expect(s.width, `${s.text} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
        expect(s.cut, `${s.text} is not cut`).toBe(false);
      }
      // the desktop keeps Create in the top bar
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator('[data-create]')).toBeVisible();
      await expect(page.locator('[data-bottom-bar]')).toBeHidden();
    });
  });
}

// ---- The weekly review in Arabic (V632 Stage 3): right to left at 375 px, in the catalog's own words

type ReviewWords = { pages: { weeklyReview: { title: string; notes: { title: string }; done: { empty: string } } } };

test('in Arabic at 375 px: the weekly review reads right to left in the catalog’s words', async ({ page, context }) => {
  await withArabic(async () => {
    const w = (JSON.parse(readFileSync(join(process.cwd(), 'messages', 'ar.json'), 'utf8')) as ReviewWords).pages
      .weeklyReview;
    const me = await makePerson();
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const note = await callAs(context, 'note_capture', { p_kind: 'sticky', p_values: { title: 'ملاحظة تجريبية' } });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
    await setPrefs(context, { locale: 'ar' });
    await page.goto('/my-day/week');
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText(w.title);
    await expect(page.locator('[data-review-section="notes"] h2')).toContainText(w.notes.title);
    await expect(page.locator('[data-review-section="done"]')).toContainText(w.done.empty);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  });
});

// ---- The Achievements list on a phone, in Arabic (the Architect's order of 22 Oct): the three switches and the month
// box say what they mean in the catalog's words, and nothing scrolls sideways

type FilterWords = {
  pages: {
    achievements: {
      filters: {
        backfilled: string;
        past: string;
        needsOwner: string;
        anyMonth: string;
        month: string;
        meaning: Record<'backfilled' | 'past' | 'needsOwner', string>;
      };
    };
  };
};

test('in Arabic at 375 px: the Achievements list’s switches and month box say what they mean, in the catalog’s words', async ({
  page,
  context,
}) => {
  await withArabic(async () => {
    const f = (JSON.parse(readFileSync(join(process.cwd(), 'messages', 'ar.json'), 'utf8')) as FilterWords).pages
      .achievements.filters;
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    await setPrefs(context, { locale: 'ar' });
    await page.goto('/kpis/achievements');
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-month-filter]')).toContainText(f.month);
    await expect(page.locator('[data-month-filter]')).toContainText(f.anyMonth);
    for (const k of ['backfilled', 'past', 'needsOwner'] as const) {
      const row = page.locator(`[data-achievement-switch="${k}"]`);
      await expect(row).toContainText(f[k]);
      await expect(row).toContainText(f.meaning[k]);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  });
});

// ---- V654, the Achievements record page and list in Arabic at 375 px: the words of the catalog, no trail on a phone

type RecordWords = {
  pages: {
    achievements: {
      noMatch: string;
      backTo: string;
      tabs: { evidence: string };
      actions: { addRef: string };
      marks: { noEvidence: string };
      filters: { clear: string; clearMonth: string };
    };
  };
};

test('in Arabic at 375 px: the Achievements record and list say Clear filters, Add evidence and No evidence in the catalog’s words', async ({
  page,
  context,
}) => {
  await withArabic(async () => {
    const w = (JSON.parse(readFileSync(join(process.cwd(), 'messages', 'ar.json'), 'utf8')) as RecordWords).pages
      .achievements;
    await ensureAchievementPlan();
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    const [cat] = await sql<{ code: string }>(
      `select c.code from perf.achievement_category c
       where c.active and c.deleted_at is null and c.required_ref_system_id is null and not c.has_deal_value
         and not c.sets_prospect order by c.code limit 1`,
    );
    const made = await callAs(context, 'achievement_log', {
      p_values: {
        category: cat!.code,
        title: 'إنجاز تجريبي بعنوان طويل يمتد على عدة أسطر في الهاتف',
        happened_on: new Date().toISOString().slice(0, 10),
      },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await setPrefs(context, { locale: 'ar' });
    await page.goto(`/kpis/achievements/${(made.body as { id: string }).id}`);
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('nav[aria-label="Breadcrumb"]'), 'a phone has no trail').toBeHidden();
    await expect(
      page.getByRole('link', { name: w.backTo, exact: true }),
      'the back arrow has its own name',
    ).toBeVisible();
    await expect(page.getByText(w.marks.noEvidence, { exact: true }), 'No evidence once').toHaveCount(1);
    await expect(page.locator('[data-record-header] [data-tabs]')).toContainText(w.tabs.evidence);
    await expect(page.locator('[data-record-header] [data-tabs]')).toContainText('(');
    await page.getByRole('link', { name: new RegExp(w.tabs.evidence) }).click();
    await hydrated(page);
    await expect(page.getByRole('button', { name: w.actions.addRef })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);

    // a PC: the last crumb keeps its ACH number in view when the title is long and in Latin letters (QA-590)
    const long = await callAs(context, 'achievement_log', {
      p_values: {
        category: cat!.code,
        title: 'TEST A very long made-up achievement title that runs on and on and on for the trail',
        happened_on: new Date().toISOString().slice(0, 10),
      },
    });
    expect(long.status, JSON.stringify(long.body)).toBe(200);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/kpis/achievements/${(long.body as { id: string }).id}`);
    await hydrated(page);
    const seen = await page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]').evaluate((span) => {
      const node = span.firstChild as Text;
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, 3);
      const n = r.getBoundingClientRect();
      const box = span.getBoundingClientRect();
      return { text: node.data.slice(0, 3), inside: n.left >= box.left - 1 && n.right <= box.right + 1 };
    });
    expect(seen.text, 'the crumb starts with the ACH number').toBe('ACH');
    expect(seen.inside, 'the last crumb keeps its ACH number in view').toBe(true);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/kpis/achievements?mine=1&month=2000-01');
    await hydrated(page);
    await expect(
      page.getByRole('button', { name: w.filters.clear }),
      'nothing matches: Clear filters shows once, in the empty box',
    ).toHaveCount(1);
    await expect(page.locator('[data-clear-filters]')).toBeVisible();
    await expect(page.locator('[data-clear-month]')).toHaveAttribute('aria-label', w.filters.clearMonth);
    await expect(page.getByText(w.noMatch)).toBeVisible();
    await page.locator('[data-clear-filters]').click();
    await expect(page).toHaveURL(/\/kpis\/achievements$/);
  });
});

// ---- V657: a task's comments in Arabic, at 375 px

test('in Arabic at 375 px: the Comments tab, the box and the comment say the catalog’s words', async ({
  page,
  context,
}) => {
  await withArabic(async () => {
    const ar = JSON.parse(readFileSync(join(process.cwd(), 'messages', 'ar.json'), 'utf8')) as {
      pages: { tasks: { tabs: { comments: string }; comments: { write: string; add: string; added: string } } };
    };
    const w = ar.pages.tasks;
    const me = await makePerson({ admin: true });
    await sql(
      `insert into core.team (department_id, code, name_en, name_ar, created_by)
       values ((select id from core.department where code = 'commercial'), 'test_cmt_ar', 'Test comments Arabic', 'فريق', $1)
       on conflict (department_id, code) do nothing`,
      [me.id],
    );
    await sql(
      `update core.person set team_id = (select t.id from core.team t where t.code = 'test_cmt_ar') where id = $1`,
      [me.id],
    );
    const number = `TSK-1995-${Math.floor(Math.random() * 90000) + 10000}`;
    await sql(
      `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
       values ($1, 'Made-up Arabic comments task', $2, (select team_id from core.person where id = $2),
               (select department_id from core.person where id = $2),
               (select id from work.task_status where is_default and deleted_at is null), 'internal', $2)`,
      [number, me.id],
    );
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, '/');
    await setPrefs(context, { locale: 'ar' });
    await page.goto(`/tasks/${number}?tab=comments`);
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-record-header] [data-tabs]')).toContainText(w.tabs.comments);
    await page.locator('[data-add-comment] textarea').fill('تعليق تجريبي');
    await expect(page.getByRole('button', { name: w.comments.add })).toBeVisible();
    await page.getByRole('button', { name: w.comments.add }).click();
    await expect(page.locator('[data-comment-body]')).toHaveText('تعليق تجريبي');
    await expect(page.getByText(w.comments.added)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  });
});

// ---- The Architect's ruling V643: the 44 px rule holds in Arabic too — wide AND high, at 375 px, right to left

test('every tappable thing is at least 44 px wide and high on a phone, on every page and in the dialogs and menus — Arabic', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await withArabic(async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    const { me, clientId, number } = await seed(page);
    await sql(`insert into core.person_profile (person_id, created_by, locale) values ($1, $1, 'ar')`, [me.id]);
    await page.context().addCookies([{ name: 'v2.locale', value: 'ar', url: new URL(page.url()).origin }]);
    await page.goto('/my-day');
    await expect(page.locator('html'), 'the Arabic walk is in Arabic, right to left').toHaveAttribute('dir', 'rtl');
    expect(await walk(page, me, clientId, number), 'every tappable thing is 44 px wide and high on a phone').toEqual(
      [],
    );
    // QA-580: a short reminder title starts at the right edge of its link in Arabic, not centred
    const { gap } = await reminderStartGap(page, me.id, 'اتصل بعلي');
    expect(gap, 'the words start at the start edge of their link, not centred in it').toBeLessThanOrEqual(2);
    // QA-584: short note titles in the notes list are a finger wide and high in Arabic too
    const notes = await noteLinkWidths(page, ['Hi', 'علي', 'Check']);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    for (const [title, { width, height }] of Object.entries(notes)) {
      expect(height, `the note link "${title}" is 44 px high on a phone`).toBeGreaterThanOrEqual(43.5);
      expect(width, `the note link "${title}" is 44 px wide on a phone`).toBeGreaterThanOrEqual(43.5);
    }
  });
});
