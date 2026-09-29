/**
 * The writes the screens offer (V97, V128, V141, V210): each role's own profile, the admin's settings, lists, people
 * and teams — each with its toast, and the toast's Undo read back from the database. Non-admins get no write controls
 * on Settings or on someone else's person page. Recently deleted has no screen yet: its doors are tried through the
 * Data API with each person's own session.
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAs, fx, hydrated, inWords, info, notBuilt, said, shot, signIn, sql, toast, user, verdict } from './lib';

const AREA = 'writes';

async function undoFromToast(
  page: Page,
  done: string | RegExp,
): Promise<{ offered: boolean; undone: boolean; line: string }> {
  const t = toast(page, done);
  await t.waitFor({ timeout: 15_000 }).catch(() => undefined);
  const button = t.getByRole('button', { name: 'Undo', exact: true });
  if (!(await button.count()))
    return { offered: false, undone: false, line: ((await t.textContent().catch(() => '')) ?? '').trim() };
  await button.click();
  const after = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: /Undone|cannot|not|refused|access/i })
    .last();
  await after.waitFor({ timeout: 15_000 }).catch(() => undefined);
  const line = ((await after.textContent().catch(() => '')) ?? '').trim();
  return { offered: true, undone: /Undone/.test(line), line };
}

for (const key of ['admin', 'head', 'manager', 'member', 'viewer', 'noclients', 'nolevels']) {
  test(`My profile as ${key}: a change saves, and Undo on the toast takes it back`, async ({ page }) => {
    const me = user(key);
    await signIn(page, key, '/profile');
    await hydrated(page);
    const before = (
      await sql<{ nickname_en: string | null }>(`select nickname_en from core.person where id = $1`, [me.id])
    )[0];
    const nick = `QA${fx().tag}${key.slice(0, 3)}`;
    await page.getByLabel('Nickname').fill(nick);
    await page.getByLabel('Nickname').press('Enter');
    await expect(toast(page, 'Profile saved')).toBeVisible();
    const saved = (
      await sql<{ nickname_en: string | null }>(`select nickname_en from core.person where id = $1`, [me.id])
    )[0];
    verdict(
      {
        area: AREA,
        user: key,
        screen: '/profile',
        check: 'a nickname change is saved',
        detail: `now ${saved?.nickname_en}`,
      },
      saved?.nickname_en === nick,
    );
    const u = await undoFromToast(page, 'Profile saved');
    const back = (
      await sql<{ nickname_en: string | null }>(`select nickname_en from core.person where id = $1`, [me.id])
    )[0];
    verdict(
      {
        area: AREA,
        user: key,
        screen: '/profile',
        check: 'Undo on the toast reverts it (read back)',
        detail: `offered ${u.offered}, "${u.line}", now ${back?.nickname_en ?? 'null'} (was ${before?.nickname_en ?? 'null'})`,
      },
      u.offered && u.undone && (back?.nickname_en ?? null) === (before?.nickname_en ?? null),
    );
    // a second save, now that the profile row exists: is its Undo any different?
    const current = (
      await sql<{ nickname_en: string | null }>(`select nickname_en from core.person where id = $1`, [me.id])
    )[0]?.nickname_en;
    await page.reload();
    await hydrated(page);
    await page.getByLabel('Nickname').fill(`${nick}b`);
    await page.getByLabel('Nickname').press('Enter');
    await expect(toast(page, 'Profile saved')).toBeVisible();
    const u2 = await undoFromToast(page, 'Profile saved');
    const back2 = (
      await sql<{ nickname_en: string | null }>(`select nickname_en from core.person where id = $1`, [me.id])
    )[0]?.nickname_en;
    verdict(
      {
        area: AREA,
        user: key,
        screen: '/profile',
        check: 'Undo on a second save (the profile row exists) reverts it (read back)',
        detail: `"${u2.line}", now ${back2 ?? 'null'} (was ${current ?? 'null'})`,
      },
      u2.undone && (back2 ?? null) === (current ?? null),
    );
    await page.reload();
    await hydrated(page);
    const field = await page.getByLabel('Nickname').inputValue();
    verdict(
      {
        area: AREA,
        user: key,
        screen: '/profile',
        check: 'after a reload the screen shows what the database holds',
        detail: `field "${field}"`,
      },
      field === (back2 ?? ''),
    );

    if (key !== 'admin') {
      // no write controls where the person has none
      await page.goto('/settings/work');
      await hydrated(page);
      const controls = await page.locator('[data-setting-change], [data-list-add], [data-list-archive]').count();
      verdict(
        {
          area: AREA,
          user: key,
          screen: '/settings/work',
          check: 'no settings controls for a non-admin',
          detail: `${controls} controls`,
        },
        controls === 0,
      );
      await page.goto(`/people/${user('member2').id}`);
      await hydrated(page);
      const personControls = await page
        .locator('[data-person-edit], [data-person-switch], [data-person-more], [data-email-add]')
        .count();
      const selects = await page.locator('[data-record-rail]').getByRole('combobox').count();
      verdict(
        {
          area: AREA,
          user: key,
          screen: '/people/[member2]',
          check: "no edit, switch, password or access controls on someone else's person page",
          detail: `${personControls} buttons, ${selects} selects`,
        },
        personControls === 0 && selects === 0,
      );
    }
  });
}

test('the admin: a setting, a list entry, a person and a team — each saved with its toast, each Undo read back', async ({
  page,
}) => {
  test.slow();
  await signIn(page, 'admin', '/settings/work');
  await hydrated(page);
  const tag = fx().tag;

  // a setting (effective-dated, with a reason and the database's preview)
  const card = page.locator('[data-setting="work.reminder_days_before_due"]');
  const readDays = async () =>
    (
      await sql<{ value: string }>(
        `select value::text as value from core.setting where key = 'work.reminder_days_before_due' and department_id is null and deleted_at is null
         order by valid_from desc, created_at desc limit 1`,
      )
    )[0]?.value ?? '(default)';
  const beforeDays = await readDays();
  const shownBefore = ((await card.locator('[data-setting-value]').textContent()) ?? '').trim();
  const next = shownBefore === '3' ? '4' : '3';
  await card.locator('[data-setting-change]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('New value').fill(next);
  await dialog.getByLabel('Reason').fill(`QA sweep setting ${tag}`);
  await dialog.locator('[data-setting-save]').click();
  await expect(toast(page, 'Setting saved')).toBeVisible();
  const savedDays = await readDays();
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/settings/work',
      check: 'a setting saves with its reason',
      detail: `${beforeDays} → ${savedDays}`,
    },
    savedDays === next,
  );
  const us = await undoFromToast(page, 'Setting saved');
  const afterDays = await readDays();
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/settings/work',
      check: 'Undo on the setting toast reverts it (read back)',
      detail: `"${us.line}", now ${afterDays} (was ${beforeDays})`,
    },
    us.undone && afterDays === beforeDays,
  );

  // a list entry: add, then Undo
  await page.reload();
  await hydrated(page);
  const list = page.locator('[data-list="priority"]');
  const key = `qa_${tag}`;
  await list.locator('[data-list-add]').click();
  await dialog.getByLabel('Key').fill(key);
  await dialog.getByLabel('Name', { exact: true }).fill(`Test priority ${tag}`);
  await dialog.getByLabel('Name (Arabic)').fill('أولوية تجريبية');
  await dialog.locator('[data-list-save]').click();
  await expect(toast(page, 'Entry saved')).toBeVisible();
  const added = (
    await sql<{ n: string }>(`select count(*)::text as n from work.priority where key = $1 and deleted_at is null`, [
      key,
    ])
  )[0]?.n;
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/settings/work',
      check: 'a list entry is added (Arabic name required)',
      detail: `${added} live rows`,
    },
    added === '1',
  );
  const ul = await undoFromToast(page, 'Entry saved');
  const live = (
    await sql<{ n: string }>(`select count(*)::text as n from work.priority where key = $1 and deleted_at is null`, [
      key,
    ])
  )[0]?.n;
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/settings/work',
      check: 'Undo on the new entry removes it (soft, read back)',
      detail: `"${ul.line}", ${live} live rows`,
    },
    ul.undone && live === '0',
  );

  // a person: job title on someone else's record, then Undo
  const target = user('member2');
  const title = async () =>
    (await sql<{ t: string | null }>(`select job_title_en as t from core.person where id = $1`, [target.id]))[0]?.t ??
    null;
  const titleBefore = await title();
  await page.goto(`/people/${target.id}`);
  await hydrated(page);
  await page.locator('[data-person-edit]').click();
  await dialog.getByLabel('Job title').fill(`Test title ${tag}`);
  await dialog.locator('[data-person-save]').click();
  await expect(toast(page, /updated/i)).toBeVisible();
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/people/[member2]',
      check: "an admin edits a person's job title",
      detail: `now ${await title()}`,
    },
    (await title()) === `Test title ${tag}`,
  );
  const up = await undoFromToast(page, /updated/i);
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/people/[member2]',
      check: 'Undo on the person toast reverts it (read back)',
      detail: `"${up.line}", now ${await title()}`,
    },
    up.undone && (await title()) === titleBefore,
  );

  // a refusal the admin meets on screen: a temporary password for a person with no allowed email yet
  await page.goto(`/people/${user('noemail').id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await dialog.getByLabel('Reason').fill(`QA sweep ${tag}`);
  await dialog.locator('[data-reason-save]').click();
  const refusedToast = page.locator('[data-sonner-toast]').last();
  await refusedToast.waitFor({ timeout: 15_000 }).catch(() => undefined);
  const refusedLine = ((await refusedToast.textContent().catch(() => '')) ?? '').trim();
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/people/[noemail]',
      check: 'Generate temporary password for a person with no allowed email is refused in its own words',
      detail: `toast "${refusedLine}" · the route answers password.no_email ("This person has no allowed email yet")`,
      shot: /did not answer/i.test(refusedLine) ? await shot(page, 'generate-password-no-email') : undefined,
    },
    /no allowed email/i.test(refusedLine),
  );

  // a team: add, then Undo
  await page.goto('/settings/org?tab=teams');
  await hydrated(page);
  const code = `qa_${tag}`;
  await page.locator('[data-team-add]').click();
  await dialog.getByLabel('Name', { exact: true }).fill(`Test team ${tag}`);
  await dialog.getByLabel('Code').fill(code);
  await dialog.getByLabel('Name (Arabic)').fill('فريق تجريبي');
  await dialog.locator('[data-team-save]').click();
  await expect(toast(page, 'Team saved')).toBeVisible();
  const ut = await undoFromToast(page, 'Team saved');
  const team = (
    await sql<{ n: string }>(`select count(*)::text as n from core.team where code = $1 and active`, [code])
  )[0]?.n;
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/settings/org?tab=teams',
      check: 'Undo on a new team removes it (read back)',
      detail: `"${ut.line}", ${team} active teams with the code`,
    },
    ut.undone && team === '0',
  );
});

test('Recently deleted and Restore (V141): remove, list, restore, and the refusals in words', async ({ page }) => {
  const f = fx();
  const admin = await apiAs('admin');
  const made = await admin('contract_save', {
    p_partner: f.orgs.alpha.id,
    p_id: null,
    p_values: { side: 'client', title: `Test contract to remove ${f.tag}`, start_on: f.today },
    p_reason: 'QA sweep',
  });
  const id = (made.data as { id?: string } | null)?.id ?? '';
  const removed = await admin('contracts_remove', { p_ids: [id], p_reason: `QA sweep remove ${f.tag}` });
  verdict(
    { area: AREA, user: 'admin', screen: '(api)', check: 'a contract is removed', detail: said(removed) },
    removed.ok,
  );

  const listed = await admin('recently_deleted', { p_limit: 200 });
  const inList = JSON.stringify(listed.data ?? '').includes(id);
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '(api) recently_deleted',
      check: 'Recently deleted lists it, with who and why',
      detail: inList ? 'listed' : said(listed),
    },
    listed.ok && inList,
  );

  for (const key of ['noclients', 'nolevels']) {
    const theirs = await (await apiAs(key))('recently_deleted', { p_limit: 200 });
    const seen = JSON.stringify(theirs.data ?? '').includes(id);
    verdict(
      {
        area: AREA,
        user: key,
        screen: '(api) recently_deleted',
        check: 'Recently deleted hides a Client-side record from a person who cannot see it',
        detail: seen ? 'LISTED' : said(theirs),
      },
      !seen,
    );
  }
  const viewer = await (await apiAs('viewer'))('restore', { p_entity: 'contract', p_id: id, p_reason: 'QA sweep' });
  verdict(
    {
      area: AREA,
      user: 'viewer',
      screen: '(api) restore',
      check: 'a viewer may not restore it — refused in words',
      detail: said(viewer),
    },
    !viewer.ok && inWords(viewer),
  );

  const restored = await admin('restore', { p_entity: 'contract', p_id: id, p_reason: `QA sweep restore ${f.tag}` });
  const back = await admin('contracts', { p_partner: f.orgs.alpha.id });
  const isBack = JSON.stringify(back.data ?? '').includes(id);
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '(api) restore',
      check: 'Restore brings the record back (read back)',
      detail: `${said(restored)} · back: ${isBack}`,
    },
    restored.ok && isBack,
  );

  // the screen
  await signIn(page, 'admin', '/recently-deleted');
  await hydrated(page);
  const screen = await page.getByText(`Test contract to remove ${f.tag}`).count();
  if (!screen)
    notBuilt({
      area: AREA,
      user: 'admin',
      screen: '/recently-deleted',
      check: 'a Recently deleted screen with Restore (V141, V401)',
      detail: 'no screen yet; the doors work through the Data API',
    });
});

test('Undo per request (V128): the author undoes; a viewer is refused in words; the undo is read back', async () => {
  const f = fx();
  const member = await apiAs('member');
  const added = await member('note_add', {
    p_entity: 'partner',
    p_id: f.orgs.alpha.id,
    p_kind: 'comment',
    p_body: `Test note to undo ${f.tag}`,
  });
  const note = added.data as { id?: string; request_id?: string } | null;
  verdict(
    {
      area: AREA,
      user: 'member',
      screen: '(api) note_add',
      check: "the Client side's owner adds a note",
      detail: said(added),
    },
    added.ok,
  );
  const byViewer = await (await apiAs('viewer'))('undo', { p_request: note?.request_id });
  verdict(
    {
      area: AREA,
      user: 'viewer',
      screen: '(api) undo',
      check: "a viewer cannot undo someone else's request — refused in words",
      detail: said(byViewer),
    },
    !byViewer.ok && inWords(byViewer),
  );
  const byOther = await (
    await apiAs('member2')
  )('note_edit', { p_id: note?.id, p_values: { body: 'changed by someone else' }, p_version: 1 });
  verdict(
    {
      area: AREA,
      user: 'member2',
      screen: '(api) note_edit',
      check: "only a note's author edits it — refused in words",
      detail: said(byOther),
    },
    !byOther.ok && inWords(byOther),
  );
  const undone = await member('undo', { p_request: note?.request_id });
  const notes = await member('notes', { p_entity: 'partner', p_id: f.orgs.alpha.id });
  const still = JSON.stringify(notes.data ?? '').includes(note?.id ?? '-');
  verdict(
    {
      area: AREA,
      user: 'member',
      screen: '(api) undo',
      check: 'the author undoes their note (read back: gone from the timeline)',
      detail: `${said(undone)} · still listed: ${still}`,
    },
    undone.ok && !still,
  );
  const views = await (
    await apiAs('member2')
  )('view_save', { p_id: f.views.member, p_page: 'clients', p_name: 'Taken over', p_query: {} });
  verdict(
    {
      area: AREA,
      user: 'member2',
      screen: '(api) view_save',
      check: "someone else's saved view cannot be changed — refused in words",
      detail: said(views),
    },
    !views.ok && inWords(views),
  );
  const removeView = await (await apiAs('member2'))('views_remove', { p_ids: [f.views.member], p_reason: 'QA sweep' });
  verdict(
    {
      area: AREA,
      user: 'member2',
      screen: '(api) views_remove',
      check: "someone else's saved view cannot be removed — refused in words",
      detail: said(removeView),
    },
    !removeView.ok && inWords(removeView),
  );
});

test('writes on screens that are not built yet are listed, not passed', async ({ page }) => {
  await signIn(page, 'member', '/tasks');
  await hydrated(page);
  const offered = await page.locator('main button').count();
  for (const s of [
    '/tasks',
    '/partners?view=clients',
    '/pipeline',
    '/projects',
    '/finance',
    '/kpis',
    '/reports',
    '/appraisal',
    '/my-day',
  ])
    notBuilt({
      area: AREA,
      user: 'member',
      screen: s,
      check: 'create / edit / remove / restore on the screen',
      detail: 'placeholder page (Nothing here yet)',
    });
  info({
    area: AREA,
    user: 'member',
    screen: '/tasks',
    check: 'buttons in the placeholder main area',
    detail: `${offered}`,
  });
  await shot(page, 'placeholder-tasks-member');
});
