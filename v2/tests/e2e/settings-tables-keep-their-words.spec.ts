/**
 * Settings → People & access on a wide screen: the People, Teams, Departments and Access tables use the whole width of the
 * content, and no word in a header or a cell breaks in the middle ("Departme nt", "Partnersh ips") at 1,568, 1,440 or
 * 1,280 px. The Arabic page is checked in app-settings.alone.spec.ts. Every value is made up.
 * Sabotages: tests/sabotage/settings-width.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { brokenWords } from './support/broken-words';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [1568, 1440, 1280]) {
  test(`the Settings tables keep their words whole — at ${width} px`, async ({ page }) => {
    test.setTimeout(120_000);
    const admin = await makePerson({ admin: true });
    const tag = Math.random().toString(36).slice(2, 6);
    // the long words of real department names, in a made-up department, team and person
    const [dept] = await sql<{ id: string }>(
      `insert into core.department (code, name_en, name_ar) values ($1, 'Partnerships Development', 'الشراكات والتطوير') returning id`,
      [`w_${tag}`],
    );
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar) values ($1, $2, 'Commercial Partnerships', 'الشراكات التجارية') returning id`,
      [dept!.id, `t_${tag}`],
    );
    const p = await makePerson();
    await sql(
      `update core.person set department_id = $2, team_id = $3, job_title_en = 'Development lead' where id = $1`,
      [p.id, dept!.id, team!.id],
    );
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, admin.email, '/settings/org?tab=people');
    await hydrated(page);

    const content = async (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const frame = await page
      .locator('[data-settings-groups] + div')
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    for (const [tab, selector] of [
      ['people', '[data-people]'],
      ['teams', '[data-teams]'],
      ['access', '[data-access-matrix]'],
    ] as const) {
      await page.goto(`/settings/org?tab=${tab}`);
      await hydrated(page);
      expect(await brokenWords(page, `${selector} table`), `no word of the ${tab} table breaks in the middle`).toEqual(
        [],
      );
      expect(await content(selector), `the ${tab} tab uses the whole width of the content`).toBeGreaterThanOrEqual(
        frame - 2,
      );
    }
  });
}
