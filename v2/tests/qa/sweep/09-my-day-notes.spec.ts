/**
 * My day's Capture, Turn into and Wrap up (#139 P3-13 and #138 P3-14; V183–V188, V433, V454), tried the way people get
 * them wrong: the toast's Undo right after Turn into, a double click on its save, colleagues reading the call a private
 * note became (an admin included), and a browser whose own date is not Riyadh's. Its own made-up people (seed.mjs,
 * CATALOGUE_PEOPLE n_*). NOT BUILT where api.note_capture is missing (v2/main before #139).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiAs, fx, hydrated, info, notBuilt, said, signIn, sql, toast, verdict } from './lib';
import { V2_DIR } from './paths.mjs';

const AREA = 'my-day';
type Where = { screen?: string; user?: string; detail?: string };
const check = (expected: string, w: Where, ok: boolean) => verdict({ area: AREA, ...w, check: expected }, ok);
const tag = () => `${fx().tag}${Math.random().toString(36).slice(2, 6)}`;

/** Built when both halves are in: the data (P3-13, #139) and My day's screens with Turn into (P3-14, #138). */
async function built(): Promise<boolean> {
  if (!existsSync(join(V2_DIR, 'src', 'modules', 'my-day', 'screens', 'TurnDialogs.tsx'))) return false;
  const [r] = await sql<{ ok: boolean }>(
    `select to_regprocedure('api.note_capture(text,jsonb,uuid[])') is not null and
            exists (select 1 from pg_catalog.pg_proc where proname = 'note_turn_into') as ok`,
  );
  return !!r?.ok;
}

/** A client organisation and a private sticky note, both the author's, through the api as they would make them. */
async function orgAndNote(t: string): Promise<{ org: string; orgId: string; noteId: string }> {
  const author = await apiAs('n_author');
  const org = `Test Org Notes ${t}`;
  const made = await author('partner_create', {
    p_partner: { trade_name_en: org, sides: [{ side: 'client', type: 'corporate' }] },
  });
  if (!made.ok) throw new Error(`partner_create: ${said(made)}`);
  const cap = await author('note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Private QA note ${t}`, visibility: 'private' },
  });
  if (!cap.ok) throw new Error(`note_capture: ${said(cap)}`);
  return { org, orgId: (made.data as { id: string }).id, noteId: (cap.data as { id: string }).id };
}

/** On a note's own page: Turn into → a logged call on `org`, the first outcome; `save` clicks the dialog's save. */
async function turnIntoCall(page: Page, org: string, save: (b: Locator) => Promise<void>) {
  await page.locator('[data-turn-into]').click();
  await page.locator('[data-turn-kind="activity"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-partner-search]').fill(org);
  await dialog.locator('[data-partner-hit]').first().click();
  await dialog.getByLabel('Outcome').click();
  await page.getByRole('option').first().click();
  await save(dialog.locator('[data-log-from-note-save]'));
}

const liveCalls = async (orgId: string) =>
  (
    await sql<{ n: number }>(
      `select count(*)::int as n from core.note where entity_id = $1 and kind = 'activity' and deleted_at is null`,
      [orgId],
    )
  )[0]!.n;
const links = async (noteId: string) =>
  (
    await sql<{ all: number; live: number }>(
      `select count(*)::int as all, count(*) filter (where deleted_at is null)::int as live
         from my.note_link where note_id = $1`,
      [noteId],
    )
  )[0]!;

async function settle(read: () => Promise<number>, want: number, ms = 15_000): Promise<number> {
  const until = Date.now() + ms;
  let n = await read();
  while (n !== want && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 500));
    n = await read();
  }
  return n;
}

test("Turn into, then the toast's Undo: the call leaves the organisation and the note is open again", async ({
  page,
}) => {
  if (!(await built()))
    return notBuilt({ area: AREA, check: 'Turn into and Undo (P3-13 data or P3-14 screens not built)' });
  const t = tag();
  const { org, orgId, noteId } = await orgAndNote(t);
  await signIn(page, 'n_author', `/my-day/notes/${noteId}`);
  await hydrated(page);
  await turnIntoCall(page, org, (b) => b.click());
  const logged = toast(page, `logged on ${org}`);
  const seen = await logged
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check('Turn into a call says where it was logged', { screen: '/my-day/notes/:id', user: 'n_author' }, seen);
  check(
    'one call on the organisation',
    { screen: '/my-day/notes/:id', user: 'n_author' },
    (await liveCalls(orgId)) === 1,
  );
  await logged.getByRole('button', { name: 'Undo', exact: true }).click();
  const calls = await settle(() => liveCalls(orgId), 0);
  const l = await links(noteId);
  check(
    "the toast's Undo removes the call from the organisation",
    { screen: '/my-day/notes/:id', user: 'n_author', detail: `live calls ${calls}` },
    calls === 0,
  );
  check(
    'and the note no longer says it became one',
    { screen: '/my-day/notes/:id', user: 'n_author', detail: `links ${l.live} live of ${l.all}` },
    l.live === 0,
  );
  await page.reload();
  await hydrated(page);
  const chips = await page.locator('[data-note-links] [data-turned-into]').count();
  const again = await page.locator('[data-turn-into]').isVisible();
  check(
    'its page shows no "turned into" chip and offers Turn into again',
    { screen: '/my-day/notes/:id', user: 'n_author', detail: `chips ${chips}, Turn into ${again}` },
    chips === 0 && again,
  );
});

test('a double click on Turn into’s save logs one call, not two', async ({ page }) => {
  if (!(await built())) return notBuilt({ area: AREA, check: 'Turn into, double click (not built)' });
  const t = tag();
  const { org, orgId, noteId } = await orgAndNote(t);
  await signIn(page, 'n_author', `/my-day/notes/${noteId}`);
  await hydrated(page);
  await turnIntoCall(page, org, (b) => b.dblclick());
  await toast(page, `logged on ${org}`)
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(2_000);
  const calls = await liveCalls(orgId);
  const l = await links(noteId);
  check(
    'one call on the organisation and one link on the note',
    { screen: '/my-day/notes/:id', user: 'n_author', detail: `calls ${calls}, links ${l.all}` },
    calls === 1 && l.all === 1,
  );
});

test('colleagues reading the organisation see the call a private note became, never the note itself (V454)', async ({
  page,
}) => {
  if (!(await built())) return notBuilt({ area: AREA, check: 'from-note chip for colleagues (not built)' });
  const t = tag();
  const { org, orgId, noteId } = await orgAndNote(t);
  await signIn(page, 'n_author', `/my-day/notes/${noteId}`);
  await hydrated(page);
  await turnIntoCall(page, org, (b) => b.click());
  await toast(page, `logged on ${org}`).waitFor({ timeout: 15_000 });
  for (const reader of ['admin', 'n_peer']) {
    await page.context().clearCookies();
    await signIn(page, reader, `/partners/${orgId}`);
    await hydrated(page);
    const main = page.getByRole('main');
    const reached = await main
      .getByText(org)
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!reached) {
      info({ area: AREA, user: reader, screen: '/partners/:id', check: 'the organisation is not theirs to read here' });
      continue;
    }
    const call = page.locator('[data-note-kind="activity"]');
    const calls = await call.count();
    const chips = await page.locator('[data-from-note]').count();
    const title = await main.getByText(`Private QA note ${t}`).count();
    check(
      'the call is on the organisation, with no "from note" chip',
      { screen: '/partners/:id', user: reader, detail: `calls ${calls}, chips ${chips}` },
      calls >= 1 && chips === 0,
    );
    // the call's line is the note's text, shown to its author in Turn into's dialog and editable there before saving
    info({
      area: AREA,
      user: reader,
      screen: '/partners/:id',
      check: `the call's line carries the note's text as its author saved it (title shown ${title}×)`,
    });
    await page.goto(`/my-day/notes/${noteId}`);
    await hydrated(page);
    const notePage = await page.locator('[data-note-page]').count();
    check(
      'and the note’s address shows them nothing of it',
      { screen: '/my-day/notes/:id', user: reader, detail: `note page ${notePage}` },
      notePage === 0,
    );
  }
});

// A browser whose own date is not Riyadh's at the moment the test runs: UTC+14 from 13:00 Riyadh (already tomorrow
// there), UTC−11 before 14:00 Riyadh (still yesterday). The day a capture keeps, the date a row shows, Wrap up's next
// working day and a reminder's "tomorrow" must all be Riyadh's (V40, PRF-139); #138's own specs do not run My day under
// the moved clock.
const riyadhHour = Number(
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(new Date()),
);
const FAR_ZONE = riyadhHour >= 13 ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago';
const dayIn = (zone: string, d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: zone });
const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nextWorkingDay = (day: string) => {
  let d = plusDays(day, 1);
  while ([5, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = plusDays(d, 1);
  return d;
};
const shown = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', ...opts }).format(new Date(`${day}T12:00:00Z`));

test.describe(() => {
  test.use({ timezoneId: FAR_ZONE });
  test(`a browser on ${FAR_ZONE} time still captures, shows and wraps up on Riyadh's day`, async ({ page }) => {
    if (!(await built())) return notBuilt({ area: AREA, check: "Riyadh's day on a far browser (not built)" });
    const t = tag();
    const riyadh = dayIn('Asia/Riyadh');
    const local = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    if (local === riyadh) info({ area: AREA, check: `the far browser's date equals Riyadh's at this hour (${local})` });
    await signIn(page, 'n_tz', '/my-day');
    await hydrated(page);
    const title = `Far clock QA ${t}`;
    await page.locator('[data-capture-input]').fill(title);
    await page.locator('[data-capture-input]').press('Enter');
    await toast(page, 'Note filed')
      .waitFor({ timeout: 15_000 })
      .catch(() => undefined);
    const [row] = await sql<{ id: string; happened_on: string }>(
      `select id, happened_on::text from my.note where title = $1 and deleted_at is null`,
      [title],
    );
    check(
      "the capture keeps Riyadh's day, not the browser's",
      { screen: '/my-day', user: 'n_tz', detail: `stored ${row?.happened_on}, Riyadh ${riyadh}, browser ${local}` },
      row?.happened_on === riyadh,
    );
    const line = page.locator('[data-my-note]', { hasText: title });
    const text = ((await line.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
    const want = shown(riyadh, { day: 'numeric', month: 'short' });
    check(
      "its row shows Riyadh's date",
      { screen: '/my-day', user: 'n_tz', detail: `row "${text.slice(0, 120)}", want "${want}"` },
      text.includes(want),
    );

    await page.locator('[data-wrap-open]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator(`[data-wrap-note="${row?.id}"]`)).toBeVisible();
    const said_ = ((await dialog.textContent()) ?? '').replace(/\s+/g, ' ');
    // as the dialog writes it ("Sun, 4 Oct 2026"): weekday, day and month, whatever punctuation sits between
    const nd = nextWorkingDay(riyadh);
    const next = [{ weekday: 'short' }, { day: 'numeric', month: 'short' }].map((o) =>
      shown(nd, o as Intl.DateTimeFormatOptions),
    );
    check(
      "Wrap up carries to the working day after Riyadh's today",
      { screen: '/my-day · Wrap up', user: 'n_tz', detail: `want "${next.join(' ')}" in "${said_.slice(0, 160)}"` },
      new RegExp(`${next[0]},? ${next[1]}`).test(said_),
    );
    await page.keyboard.press('Escape');

    await page.goto(`/my-day/notes/${row?.id}`);
    await hydrated(page);
    await page.locator('[data-turn-into]').click();
    await page.locator('[data-turn-kind="reminder"]').click();
    const at = await page.getByRole('dialog').locator('input[type="datetime-local"]').inputValue();
    const tomorrow = plusDays(riyadh, 1);
    check(
      "a reminder's default is tomorrow in Riyadh, 09:00",
      { screen: '/my-day/notes/:id · Reminder', user: 'n_tz', detail: `default ${at}, want ${tomorrow}T09:00` },
      at === `${tomorrow}T09:00`,
    );
  });
});
