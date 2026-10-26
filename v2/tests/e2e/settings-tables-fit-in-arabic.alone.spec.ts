/**
 * QA-592: the People and Teams tables of Settings → People & access do not scroll sideways in Arabic at 1,280 and 1,440 px —
 * the content of every table box fits the box (content width against box width), and so does the page. The cut date
 * (a last sign-in written "26 أكتوبر 026") is written the one way: day, short month, a four-figure year. Arabic is on for the
 * length of the case, which is why this file runs alone. Every value is made up.
 * Sabotages: tests/sabotage/settings-tables-arabic.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { setPrefs } from './helpers';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

async function withArabic(run: () => Promise<void>) {
  const admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: QA-592 specs', $1)`,
    [admin.id],
  );
  try {
    await run();
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
}

/** Every box that scrolls sideways inside the Settings page, and the page itself: how far its content runs past it. */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1)
      out.push(`the page scrolls sideways (${document.documentElement.scrollWidth} in ${vw})`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *'))) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
      if (el.scrollWidth > el.clientWidth + 1)
        out.push(
          `${el.tagName.toLowerCase()}${el.closest('[data-people]') ? ' (people)' : el.closest('[data-teams]') ? ' (teams)' : ''}: content ${el.scrollWidth} px in a box of ${el.clientWidth} px`,
        );
    }
    return out;
  });

for (const width of [1280, 1440]) {
  test(`People and Teams tables fit their box in Arabic — at ${width} px`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await withArabic(async () => {
      const admin = await makePerson({ admin: true });
      // a few made-up colleagues with Arabic names, a job title, a team and a last sign-in, so the rows are realistic
      // a department and a team with the long Arabic names real ones have
      const tag = Math.random().toString(36).slice(2, 7);
      const [dept] = await sql<{ id: string }>(
        `insert into core.department (code, name_en, name_ar) values ($1, 'Made-up department', 'قسم خدمة العملاء للشركات الكبرى والمؤسسات الحكومية') returning id`,
        [`d_${tag}`],
      );
      const [team] = await sql<{ id: string }>(
        `insert into core.team (department_id, code, name_en, name_ar) values ($1, $2, 'Made-up team', 'فريق حسابات الشركات الكبرى والمؤسسات الحكومية والتعليمية') returning id`,
        [dept!.id, `t_${tag}`],
      );
      for (const name of ['عبد الرحمن محمد الشهري', 'نورة بنت خالد القحطاني', 'سلطان بن فهد العتيبي']) {
        const p = await makePerson();
        await sql(
          `update core.person set full_name_ar = $2, job_title_ar = 'مسؤول حسابات رئيسي', department_id = $3, team_id = $4 where id = $1`,
          [p.id, name, dept!.id, team!.id],
        );
        await sql(
          `insert into core.sign_in_log (person_id, email, provider, result, at) values ($1, $2, 'email', 'ok', now() - interval '3 days')`,
          [p.id, p.email],
        );
      }
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, admin.email, '/my-day');
      await hydrated(page);
      await setPrefs(context, { locale: 'ar' });
      for (const tab of ['people', 'teams']) {
        await page.goto(`/settings/org?tab=${tab}`);
        await hydrated(page);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        expect(await overflow(page), `the ${tab} table fits its box in Arabic`).toEqual([]);
      }
      // the last sign-in date is whole: day, short month, a four-figure year, and inside the table's box (it was cut to "026")
      await page.goto('/settings/org?tab=people');
      await hydrated(page);
      const cells = page.locator('[data-person-last-sign-in]');
      await expect(cells.first()).toBeVisible();
      for (const cell of await cells.all()) {
        const text = (await cell.innerText()).trim();
        if (!/\d/.test(text)) continue;
        expect(text, 'the date has its four-figure year').toMatch(/\d{1,2} \S+ \d{4}$/);
        const inside = await cell.evaluate((td) => {
          const box = td.closest('.overflow-x-auto')!.getBoundingClientRect();
          const r = td.getBoundingClientRect();
          return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
        });
        expect(inside, 'the last sign-in date is inside the table box').toBe(true);
      }
    });
  });
}
