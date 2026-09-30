/**
 * The oversight's production walk (29 Sep, W items; QA-LOG round 19), re-tested on the built app: the items #127 (V216)
 * fixed, each check named with its QA number and W item — PASS or FAIL (a real defect: the test fails too, softly, so
 * the other checks still run), INFO where what was seen is for a person to judge. Its own made-up people (seed.mjs,
 * CATALOGUE_PEOPLE w_*), so it runs beside the other specs without sharing a switch, a change or a bell.
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAs, fx, hydrated, info, said, signIn, sql, toast, user, verdict, words } from './lib';

const AREA = 'walk';
type Where = { screen?: string; user?: string; detail?: string };
const check = (id: string, expected: string, w: Where, ok: boolean) =>
  verdict({ area: AREA, ...w, check: `${id} · ${expected}` }, ok);
const note = (id: string, expected: string, w: Where) => info({ area: AREA, ...w, check: `${id} · ${expected}` });
/** A column name shown as it is stored (`can_sign_in`), never in words. */
const RAW_KEY = /^[a-z]+(?:_[a-z0-9]+)+$/;
/** A raw user agent, or a MIME type, where the screen should name the thing. */
const USER_AGENT = /Mozilla\/|AppleWebKit|HeadlessChrome|Gecko\//;
const MIME = /\b(?:application|image|text|video|audio)\/[\w.+-]+/g;

/** The ids and labels of the text fields under `scope` that do not turn the browser's autofill off. */
async function autofilled(page: Page, scope: string): Promise<{ total: number; open: string[] }> {
  return page
    .locator(
      `${scope} input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=search]):not([type=password]), ${scope} textarea`,
    )
    .evaluateAll((els) => ({
      total: els.length,
      open: els
        .filter((e) => (e.getAttribute('autocomplete') ?? '') !== 'off')
        .map((e) => {
          const label =
            (e as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
            e.getAttribute('aria-label') ||
            e.getAttribute('placeholder') ||
            e.getAttribute('name') ||
            e.id;
          return `"${label}" (${e.getAttribute('type') ?? e.tagName.toLowerCase()}, autocomplete=${e.getAttribute('autocomplete') ?? 'unset'})`;
        }),
    }));
}

test('QA-201 · W23: the switch toast says switched off, then switched on', async ({ page }) => {
  const target = user('w_switch');
  await signIn(page, 'admin', `/people/${target.id}`);
  await hydrated(page);
  const flip = async (want: RegExp, button: RegExp) => {
    await expect(page.locator('[data-person-switch]')).toHaveText(button, { timeout: 15_000 });
    await page.locator('[data-person-switch]').click();
    await page.getByRole('dialog').getByLabel('Reason').fill(`QA walk: switch ${fx().tag}`);
    await page.getByRole('dialog').locator('[data-reason-save]').click();
    const seen = await toast(page, want)
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    const all = (await page.locator('[data-sonner-toast]').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim());
    return { seen, text: all.join(' | ') };
  };
  const off = await flip(/switched off/i, /Switch off/);
  check(
    'QA-201',
    'switching a person off says "… switched off", never "Allowed"',
    { screen: '/people/:id', user: 'admin', detail: off.text },
    off.seen && !/Allowed/.test(off.text),
  );
  const on = await flip(/switched on/i, /Switch on/);
  check(
    'QA-201',
    'switching them back on says "… switched on"',
    { screen: '/people/:id', user: 'admin', detail: on.text },
    on.seen && !/Allowed/.test(on.text),
  );
});

test('QA-202 · W25: an undo entry offers no Undo of its own', async ({ page }) => {
  const target = user('w_undo');
  const admin = await apiAs('admin');
  const [row] = await sql<{ version: number }>(`select version from core.person where id = $1`, [target.id]);
  const changed = await admin('person_update', {
    p_id: target.id,
    p_changes: { job_title_en: `Walk title ${fx().tag}` },
    p_version: row?.version,
    p_reason: 'QA walk: a change to undo',
  });
  const request = (changed.data as { request_id?: string } | null)?.request_id;
  const undone = request ? await admin('undo', { p_request: request }) : changed;
  await signIn(page, 'admin', '/activity');
  await hydrated(page);
  const undoRows = page.locator('[data-activity-changes] [data-history-row][data-kind="undo"]');
  await undoRows
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  const n = await undoRows.count();
  const withButton = await undoRows.filter({ has: page.locator('[data-undo-request]') }).count();
  check(
    'QA-202',
    'an undo entry is shown, and offers no Undo of its own',
    {
      screen: '/activity',
      user: 'admin',
      detail: `${n} undo entr${n === 1 ? 'y' : 'ies'}, ${withButton} with an Undo button; the change ${said(changed)}; the undo ${said(undone)}`,
    },
    undone.ok && n > 0 && withButton === 0,
  );
});

test('QA-190, QA-191 · W6, W7: the change log names fields in words, once each, and a system entry collapses', async ({
  page,
}) => {
  await signIn(page, 'admin', '/activity');
  await hydrated(page);
  const rows = page.locator('[data-activity-changes] [data-history-row]');
  await rows
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  const data = await rows.evaluateAll((els) =>
    els.map((el) => ({
      kind: el.getAttribute('data-kind') ?? '',
      label: (el.querySelector('.font-medium')?.textContent ?? '').trim(),
      fields: Array.from(el.querySelectorAll('[data-history-field]')).map((f) => ({
        key: f.getAttribute('data-history-field') ?? '',
        text: (f.textContent ?? '').trim(),
      })),
    })),
  );
  const twice = data.filter((r) => new Set(r.fields.map((f) => f.key)).size !== r.fields.length);
  const raw = data.flatMap((r) => r.fields.map((f) => f.text.split(':')[0]!.trim()).filter((t) => RAW_KEY.test(t)));
  const long = data.filter((r) => r.kind !== 'ui' && r.kind !== 'undo' && r.fields.length > 8);
  const where = { screen: '/activity', user: 'admin' };
  check(
    'QA-190',
    'no entry names the same field twice',
    {
      ...where,
      detail: `${data.length} entries; ${twice.length} with a field twice${twice
        .slice(0, 3)
        .map((r) => ` · "${r.label}" (${r.kind}): ${r.fields.map((f) => f.text).join(' / ')}`)
        .join('')}`,
    },
    data.length > 0 && twice.length === 0,
  );
  check(
    'QA-190',
    'every field is named in words, never by its column',
    { ...where, detail: raw.length ? [...new Set(raw)].slice(0, 6).join(', ') : 'none' },
    raw.length === 0,
  );
  check(
    'QA-191',
    'a system or job entry never lists more than 8 fields (it says "N fields")',
    { ...where, detail: `${long.length} long machine entries` },
    long.length === 0,
  );
});

test('QA-204 · W27: Ctrl K shows no empty group, open or searched', async ({ page }) => {
  await signIn(page, 'member', '/my-day');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  const opened = await page
    .locator('[cmdk-root]')
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const empty = () =>
    page.locator('[cmdk-group]').evaluateAll((gs) =>
      gs
        .filter((g) => !(g as HTMLElement).hidden && (g as HTMLElement).offsetParent !== null)
        .filter((g) => !g.querySelector('[cmdk-item]'))
        .map((g) => (g.querySelector('[cmdk-group-heading]')?.textContent ?? '?').trim()),
    );
  const first = await empty();
  await page.keyboard.type('zqxj');
  await page.waitForTimeout(800);
  const searched = await empty();
  check(
    'QA-204',
    'Ctrl K opens, and no group heading shows without entries',
    {
      screen: 'Ctrl K',
      user: 'member',
      detail: `opened: ${opened}; empty groups when open: ${first.join(', ') || 'none'}; after "zqxj": ${searched.join(', ') || 'none'}`,
    },
    opened && first.length === 0 && searched.length === 0,
  );
});

test('QA-205 · W29: the empty bell says what it is for, and Mark all read is off', async ({ page }) => {
  await signIn(page, 'w_bell', '/my-day');
  await hydrated(page);
  await page.locator('[data-bell]').click();
  const none = words('notifications.none') ?? '';
  const lineShown = await page
    .getByText(none, { exact: false })
    .first()
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const mark = page.getByRole('button', { name: words('notifications.markAllRead') ?? 'Mark all read' });
  const markOff = (await mark.count()) === 0 || (await mark.first().isDisabled());
  check(
    'QA-205',
    `the empty bell says "${none}", and Mark all read cannot be pressed`,
    { screen: 'the bell', user: 'w_bell', detail: `line shown: ${lineShown}; Mark all read off: ${markOff}` },
    none !== '' && lineShown && markOff,
  );
});

test('QA-200 · W21: no record field invites the browser to autofill it', async ({ page }) => {
  await signIn(page, 'admin', '/profile');
  await hydrated(page);
  const profile = await autofilled(page, 'main');
  await page.goto(`/people/${user('w_undo').id}`);
  await hydrated(page);
  await page.locator('[data-person-edit]').click();
  await page.getByRole('dialog').waitFor();
  const edit = await autofilled(page, '[role=dialog]');
  await page.keyboard.press('Escape');
  await page.goto('/settings/org');
  await hydrated(page);
  const add = page.locator('[data-person-add]').first();
  let added = { total: 0, open: [] as string[] };
  if (await add.count()) {
    await add.click();
    await page.getByRole('dialog').waitFor();
    added = await autofilled(page, '[role=dialog]');
    await page.keyboard.press('Escape');
  }
  const open = [...profile.open.map((f) => `My profile: ${f}`), ...edit.open.map((f) => `Edit person: ${f}`)];
  open.push(...added.open.map((f) => `Add person: ${f}`));
  check(
    'QA-200',
    'every text field on My profile, Edit person and Add person turns autofill off',
    {
      screen: '/profile, /people/:id, /settings/org',
      user: 'admin',
      detail: `fields: My profile ${profile.total}, Edit person ${edit.total}, Add person ${added.total}; open: ${open.join(', ') || 'none'}`,
    },
    profile.total > 0 && edit.total > 0 && open.length === 0,
  );
});

test('QA-192 · W9: the sign-in logs name the device in words, never the raw user agent', async ({ page, browser }) => {
  await signIn(page, 'member', `/people/${user('member').id}`);
  await hydrated(page);
  const own = page.locator('[data-sign-in-row]');
  await own
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  const ownText = await own.allInnerTexts();
  const ctx = await browser.newContext();
  const adminPage = await ctx.newPage();
  await signIn(adminPage, 'admin', '/activity?tab=signIns');
  await hydrated(adminPage);
  const log = adminPage.locator('[data-activity-sign-ins] tbody tr');
  await log
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  const logText = await log.allInnerTexts();
  await ctx.close();
  const raw = [...ownText, ...logText].filter((t) => USER_AGENT.test(t));
  check(
    'QA-192',
    'one\'s own sign-in log and Activity · Sign-ins name the device ("Chrome · Linux")',
    {
      screen: '/people/:own, /activity?tab=signIns',
      user: 'member, admin',
      detail: `${ownText.length} own rows, ${logText.length} log rows; raw: ${raw.length ? raw[0]!.slice(0, 120) : 'none'}`,
    },
    ownText.length > 0 && logText.length > 0 && raw.length === 0,
  );
});

test('QA-198, QA-199 · W19, W20: settings groups are never blank, and file types are named', async ({ page }) => {
  await signIn(page, 'admin', '/settings/performance');
  const emptyLine = words('settings.emptyGroup') ?? '';
  for (const group of ['performance', 'finance']) {
    await page.goto(`/settings/${group}`);
    await hydrated(page);
    const rows = await page.locator('[data-setting-change], [data-list-add]').count();
    const says = emptyLine !== '' && (await page.getByText(emptyLine).count()) > 0;
    check(
      'QA-198',
      `Settings → ${group} shows its settings or says it has none yet`,
      { screen: `/settings/${group}`, user: 'admin', detail: `${rows} settings or lists; empty line: ${says}` },
      rows > 0 || says,
    );
  }
  await page.goto('/settings/app');
  await hydrated(page);
  const text = await page.getByRole('main').innerText();
  const mimes = text.match(MIME) ?? [];
  check(
    'QA-199',
    'Settings → App names file types (PDF, Excel…), never MIME types',
    { screen: '/settings/app', user: 'admin', detail: mimes.length ? mimes.slice(0, 4).join(', ') : 'none' },
    mimes.length === 0,
  );
  const label = words('setting.app.go_live_on') ?? 'Go-live';
  const at = text.indexOf(label);
  note('QA-199', 'what Settings → App shows for the go-live date (V400)', {
    screen: '/settings/app',
    user: 'admin',
    detail: at < 0 ? `"${label}" not on the page` : text.slice(at, at + 140).replace(/\s+/g, ' '),
  });
});
