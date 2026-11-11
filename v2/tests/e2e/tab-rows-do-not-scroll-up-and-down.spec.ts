/**
 * A tab row scrolls sideways when it must, and never up and down (the supervisor's finding after #263: the My day row
 * showed a small scrollbar with arrows). At 375 px and at 1,440 px, on every page that has a tab row: each row has no
 * vertical overflow (scrollHeight <= clientHeight) and no scrollbar of its own, in either direction. Every value is made
 * up. Sabotages: tests/sabotage/tab-rows.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const tag = () => Math.random().toString(36).slice(2, 8);

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const WIDTHS = [375, 1440] as const;

/** What each tab row on the page measures: the overflow up and down, and the room a scrollbar would take. */
const measure = (page: Page) =>
  page.locator('[data-tabs]').evaluateAll((rows) =>
    rows
      .filter((r) => (r as HTMLElement).offsetParent !== null)
      .map((r) => {
        const el = r as HTMLElement;
        const cs = getComputedStyle(el);
        const border = (side: string) => parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0;
        return {
          name: el.getAttribute('aria-label') ?? el.tagName,
          overflowY: el.scrollHeight - el.clientHeight,
          bar:
            el.offsetWidth -
            el.clientWidth -
            border('left') -
            border('right') +
            (el.offsetHeight - el.clientHeight - border('top') - border('bottom')),
        };
      }),
  );

/** The rows, once they have settled: a row measured while its tabs are still laying out (font loading, late tab
 * render) can show a transient vertical overflow, so poll until every visible row is clean (30 s). If the poll
 * times out, fall through — the caller's one-shot expects below then fail with the row's own message, so a
 * genuine overflow is still reported precisely. (Landing 11, #1581 triage: the one-shot measure right after
 * hydrated() is the same class as :512 — hydrated() gates only on the root-layout marker.) */
const measureSettled = async (page: Page, must: boolean) => {
  try {
    await expect
      .poll(
        async () => {
          const rows = await measure(page);
          return rows.every((r) => r.overflowY <= 0 && r.bar <= 0) && (!must || rows.length > 0);
        },
        { timeout: 30_000 },
      )
      .toBe(true);
  } catch {
    // fall through to the one-shot expects, which fail with the row's own message
  }
  return measure(page);
};

for (const width of WIDTHS) {
  test(`no tab row scrolls up and down or shows a scrollbar — at ${width} px`, async ({ page }) => {
    // Landing 8 (#1578 triage): 54 s of the 60 s budget under load at 1440 px, and 60 s timeouts at
    // hydrated() under load at both widths — 120 s is the budget, not the product.
    test.setTimeout(120_000);
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    const made = await callAs(page.context(), 'partner_create', {
      p_partner: { trade_name_en: `Test Org Tab Rows ${tag()}`, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const pages = [
      { path: '/my-day', must: true },
      { path: '/tasks', must: true },
      { path: `/clients/${(made.body as { id: string }).id}`, must: true },
      { path: '/settings/org', must: false },
      { path: '/activity', must: false },
    ];
    let rows = 0;
    for (const p of pages) {
      await page.goto(p.path);
      await hydrated(page);
      const found = await measureSettled(page, p.must);
      if (p.must) expect(found.length, `${p.path} has a tab row`).toBeGreaterThan(0);
      rows += found.length;
      for (const r of found) {
        expect(r.overflowY, `the "${r.name}" tab row on ${p.path} does not scroll up and down`).toBeLessThanOrEqual(0);
        expect(r.bar, `the "${r.name}" tab row on ${p.path} shows no scrollbar`).toBeLessThanOrEqual(0);
      }
    }
    // the bell's panel has the one row made of buttons rather than links
    await page.goto('/my-day');
    await hydrated(page);
    await page.locator('[data-bell]').click();
    await expect(page.locator('[data-notifications-panel] [data-tabs]')).toBeVisible();
    const bell = await measureSettled(page, true);
    expect(bell.length, 'the bell panel has a tab row').toBeGreaterThan(0);
    for (const r of bell) {
      expect(r.overflowY, `the "${r.name}" tab row in the bell panel does not scroll up and down`).toBeLessThanOrEqual(
        0,
      );
      expect(r.bar, `the "${r.name}" tab row in the bell panel shows no scrollbar`).toBeLessThanOrEqual(0);
    }
    // the keyboard focus ring sits inside the row, so the row's clipping does not cut it
    await page.goto('/my-day');
    await hydrated(page);
    const firstTab = page.locator('[data-tabs] a').first();
    await firstTab.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(firstTab, 'the first tab has keyboard focus').toBeFocused();
    const ring = await firstTab.evaluate((el) => {
      const cs = getComputedStyle(el);
      const row = el.closest('[data-tabs]')!;
      const a = el.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      return {
        offset: parseFloat(cs.outlineOffset),
        drawn: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        top: a.top - r.top,
        bottom: r.bottom - a.bottom,
      };
    });
    expect(ring.drawn, 'the focused tab shows a ring').toBe(true);
    expect(ring.offset, 'the focus ring is drawn inside the tab, not around it').toBeLessThan(0);
    expect(ring.top, 'the tab sits inside the row at the top').toBeGreaterThanOrEqual(0);
    expect(ring.bottom, 'the tab sits inside the row at the bottom').toBeGreaterThanOrEqual(0);
    expect(rows, 'tab rows were found and measured').toBeGreaterThanOrEqual(3);
  });
}
