/**
 * The owner's phone screenshots (22 Oct): a long title on a card must wrap or end in an ellipsis — never be cut off at
 * either edge, never push the page sideways — at 375 px and 320 px. One long title with spaces and one unbroken run of
 * letters (an address, a code) on each list: Tasks (the list and My day's Today), Clients, Notes and Reminders (My day).
 * Every value is made up. Sabotages: tests/sabotage/long-titles.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, sql } from './support/stack';
import { seed } from './support/taps';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

const SPACED =
  'Mark the whole of the made-up long title that runs on and on across several words and keeps going past the edge';
const UNBROKEN = 'UNBROKENTITLE'.repeat(7);

/** Where a marked title is cut off or pushes the page: every element holding the mark, against the screen and each clipping ancestor. */
const problems = (page: Page, mark: string) =>
  page.evaluate((m) => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1)
      out.push(`the page scrolls sideways (${document.documentElement.scrollWidth} px in ${vw} px)`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !(n.textContent ?? '').includes(m)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const words = (n.textContent ?? '').slice(0, 24);
      if (r.left < -0.5 || r.right > vw + 0.5)
        out.push(`"${words}" sticks out of the screen (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible') continue;
        const ar = a.getBoundingClientRect();
        if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5)
          out.push(
            `"${words}" is cut off by a ${a.tagName.toLowerCase()} (${Math.round(r.left)}–${Math.round(r.right)} in ${Math.round(ar.left)}–${Math.round(ar.right)})`,
          );
      }
      // one line that ends in an ellipsis is fine; text running past its own box without one is not
      const own = getComputedStyle(el);
      if (
        el.scrollWidth > el.clientWidth + 1 &&
        own.textOverflow !== 'ellipsis' &&
        own.overflowX === 'visible' &&
        r.right > vw
      )
        out.push(`"${words}" runs past its box with no ellipsis`);
    }
    return out;
  }, mark);

for (const width of [375, 320]) {
  test(`a long title wraps or ends in an ellipsis on every list, never cut off — at ${width} px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 800 });
    const { me } = await seed(page);
    const ctx = page.context();
    const bad: string[] = [];
    const made = async (title: string, kind: 'task' | 'client' | 'note' | 'reminder', mark: string) => {
      if (kind === 'task') {
        const r = await callAs(ctx, 'task_create', { p_values: { title: title.slice(0, 190) } });
        expect(r.status, JSON.stringify(r.body)).toBe(200);
        await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [
          (r.body as { number: string }).number,
        ]);
      } else if (kind === 'client') {
        const r = await callAs(ctx, 'partner_create', {
          p_partner: { trade_name_en: title.slice(0, 190), sides: [{ side: 'client', type: 'corporate' }] },
        });
        expect(r.status, JSON.stringify(r.body)).toBe(200);
      } else if (kind === 'note') {
        const r = await callAs(ctx, 'note_capture', { p_kind: 'sticky', p_values: { title, visibility: 'private' } });
        expect(r.status, JSON.stringify(r.body)).toBe(200);
      } else {
        const r = await callAs(ctx, 'note_capture', {
          p_kind: 'reminder',
          p_values: { title, remind_at: new Date(Date.now() + 86_400_000).toISOString() },
        });
        expect(r.status, JSON.stringify(r.body)).toBe(200);
        await sql(
          `update core.reminder r set remind_at = core.clock() + interval '2 minutes'
             from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
          [me.id, title],
        );
      }
      return mark;
    };
    const marks: Record<string, string[]> = { '/tasks': [], '/clients': [], '/my-day': [] };
    for (const [form, text] of [
      ['spaced', SPACED],
      ['unbroken', UNBROKEN],
    ] as const) {
      const k = `${form.slice(0, 2)}${width}${Math.random().toString(36).slice(2, 5)}`;
      const t = (what: string) => `${k}${what} ${text}`.replace(/ $/, '');
      const title = (what: string) => (form === 'unbroken' ? `${k}${what}${text}` : t(what));
      marks['/tasks']!.push(await made(title('T'), 'task', `${k}T`));
      marks['/clients']!.push(await made(title('C'), 'client', `${k}C`));
      marks['/my-day']!.push(await made(title('N'), 'note', `${k}N`));
      marks['/my-day']!.push(await made(title('R'), 'reminder', `${k}R`));
      marks['/my-day']!.push(`${k}T`);
    }
    for (const [path, list] of Object.entries(marks)) {
      await page.goto(path);
      await hydrated(page);
      for (const mark of list) {
        bad.push(...(await problems(page, mark)).map((x) => `${path}: ${x}`));
      }
    }
    expect(Array.from(new Set(bad)), 'no long title is cut off or pushes the page sideways').toEqual([]);
  });
}
