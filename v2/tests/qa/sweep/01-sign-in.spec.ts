/**
 * The password door (V212, V431, V441), as a stranger, a person, a switched-off person, a person whose password must
 * change and a person who keeps typing the wrong one. Every check writes a PASS / FAIL / NOT BUILT line; a FAIL fails
 * the test too (softly, so the other checks still run).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  apiAs,
  fx,
  hydrated,
  info,
  notBuilt,
  refusalLine,
  said,
  shot,
  signIn,
  sql,
  toast,
  submitAndSettle,
  tryDoor,
  user,
  verdict,
} from './lib';

const AREA = 'sign-in';

async function refusal(page: Page): Promise<string> {
  const line = refusalLine(page);
  await line.waitFor({ timeout: 15_000 }).catch(() => undefined);
  return ((await line.textContent().catch(() => '')) ?? '').trim();
}
/** Words, not a key, a code or silence (V110). */
const isWords = (s: string) =>
  s.length > 3 && !/^[a-z_]+(\.[a-z_]+)+$/.test(s) && !/unavailable|not available/i.test(s);

test('the door: the right password, a wrong one, an unknown email; no code door while the password door is on', async ({
  page,
}) => {
  const door = user('door');
  await page.goto('/sign-in?next=%2Ftasks');
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  const codeBits =
    (await page.locator('[data-step="code"], [data-door="code"]').count()) +
    (await page.getByRole('button', { name: /send code/i }).count()) +
    (await page.getByLabel('Digit 1 of 6').count()) +
    (await page.getByText(/6-digit code|resend code/i).count());
  verdict(
    {
      area: AREA,
      screen: '/sign-in',
      check: 'the code door is not offered (SIGN_IN_METHOD=password)',
      detail: `${codeBits} code-door elements`,
    },
    codeBits === 0,
  );
  verdict(
    {
      area: AREA,
      screen: '/sign-in',
      check: 'says "Forgot your password? Ask your admin." and offers no reset by e-mail',
    },
    (await page.getByText('Forgot your password? Ask your admin.').count()) === 1 &&
      (await page.getByRole('link', { name: /forgot|reset/i }).count()) === 0,
  );

  await tryDoor(page, door.email, 'Not-the-password-123');
  const wrong = await refusal(page);
  verdict(
    {
      area: AREA,
      user: 'door',
      screen: '/sign-in',
      check: 'a wrong password is refused in words',
      detail: `"${wrong}"`,
    },
    isWords(wrong) && /\/sign-in/.test(page.url()),
  );

  const stranger = `test.qa.nobody.${fx().tag}@example.test`;
  await tryDoor(page, stranger, 'Not-the-password-123');
  const unknown = await refusal(page);
  verdict(
    {
      area: AREA,
      screen: '/sign-in',
      check: 'an unknown email reads the same as a wrong password (no hint whether the email exists)',
      detail: `unknown email: "${unknown}" · wrong password: "${wrong}"`,
      shot: await shot(page, 'sign-in-unknown-email'),
    },
    unknown === wrong,
  );

  await tryDoor(page, door.email, fx().password);
  await page.waitForURL(/\/tasks$/, { timeout: 20_000 }).catch(() => undefined);
  verdict(
    {
      area: AREA,
      user: 'door',
      screen: '/sign-in',
      check: 'the right password signs in and returns to the deep link',
      detail: page.url(),
    },
    /\/tasks$/.test(page.url()) && (await hydrated(page)),
  );
  const log = await sql<{ result: string }>(`select result from core.sign_in_log where email = $1 order by at, id`, [
    door.email,
  ]);
  info({
    area: AREA,
    user: 'door',
    check: 'the sign-in log for this person',
    detail: log.map((r) => r.result).join(', '),
  });
});

test('a switched-off person cannot sign in, and is told only after the right password', async ({ page, browser }) => {
  const target = user('switchoff');
  await signIn(page, 'admin', `/people/${target.id}`);
  await hydrated(page);
  await page.locator('[data-person-switch]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill(`QA sweep: switch off ${fx().tag}`);
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, /switched off/i)).toBeVisible();

  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fmy-day');
  await tryDoor(their, target.email, fx().password);
  const right = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'switchoff',
      screen: '/sign-in',
      check: 'a switched-off person is refused with the right password, in words',
      detail: `"${right}"`,
    },
    isWords(right) && /\/sign-in/.test(their.url()),
  );
  await tryDoor(their, target.email, 'Not-the-password-123');
  const wrongPw = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'switchoff',
      screen: '/sign-in',
      check: 'with a wrong password a switched-off account is not revealed (reads as a wrong password)',
      detail: `"${wrongPw}"`,
      shot: await shot(their, 'sign-in-switched-off-wrong-password'),
    },
    !/switched off/i.test(wrongPw),
  );
  // The auth server itself: a switched-off person holds no session that reads anything (V144: banned at once).
  let reads = 'no session';
  try {
    const api = await apiAs('switchoff');
    const org = await api('org');
    reads = said(org);
    verdict(
      {
        area: AREA,
        user: 'switchoff',
        check: 'a session taken straight from the auth server reads nothing',
        detail: reads,
      },
      !org.ok,
    );
  } catch (e) {
    verdict(
      {
        area: AREA,
        user: 'switchoff',
        check: 'a session taken straight from the auth server reads nothing',
        detail: String(e).slice(0, 160),
      },
      true,
    );
  }
  await ctx.close();
});

/** The session cookie (chunked `sb-…-auth-token[.n]`) decoded, and a way to write it back changed. */
async function sessionCookie(ctx: BrowserContext) {
  const all = await ctx.cookies();
  const chunks = all
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const first = chunks[0];
  if (!first) return null;
  let raw = chunks.map((c) => decodeURIComponent(c.value)).join('');
  const b64 = raw.startsWith('base64-');
  if (b64) raw = Buffer.from(raw.slice(7), 'base64url').toString('utf8');
  const session = JSON.parse(raw) as Record<string, unknown>;
  const base = first.name.replace(/\.\d+$/, '');
  const write = async (next: Record<string, unknown>) => {
    const text = JSON.stringify(next);
    const value = b64 ? `base64-${Buffer.from(text, 'utf8').toString('base64url')}` : encodeURIComponent(text);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += 3180) parts.push(value.slice(i, i + 3180));
    await ctx.clearCookies({ name: new RegExp(`^${base.replace(/[-]/g, '\\-')}(\\.\\d+)?$`) });
    await ctx.addCookies(
      parts.map((v, i) => ({
        name: parts.length === 1 ? base : `${base}.${i}`,
        value: v,
        domain: first.domain,
        path: first.path,
        httpOnly: first.httpOnly,
        secure: first.secure,
        sameSite: first.sameSite,
        expires: first.expires,
      })),
    );
  };
  return { session, write, original: chunks };
}

test('a generated temporary password must be changed before any page; the old one stops working', async ({
  page,
  browser,
}) => {
  test.slow();
  const target = user('mustchange');
  await signIn(page, 'admin', `/people/${target.id}`);
  await hydrated(page);
  const since = new Date();
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill(`QA sweep: first sign-in ${fx().tag}`);
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, 'Temporary password generated')).toBeVisible();
  const temporary = ((await page.locator('[data-temporary-password]').textContent()) ?? '').trim();
  verdict(
    {
      area: AREA,
      user: 'admin',
      screen: '/people/[id]',
      check: 'Generate temporary password shows a random one of 14+ characters once (V441)',
      detail: `${temporary.length} characters`,
    },
    temporary.length >= 14,
  );
  const logged = await sql<{ n: string }>(
    `select count(*)::text as n from audit.request where at >= $1 and actor_id = $2 and label_key ilike '%password%'`,
    [since, user('admin').id],
  );
  if (logged[0]?.n === '0')
    notBuilt({
      area: AREA,
      user: 'admin',
      check: 'every generate is logged in the settings/access log (V441)',
      detail: 'no audit.request row for the generate (route NEED, builder A P3-2b)',
    });
  else
    verdict(
      { area: AREA, user: 'admin', check: 'every generate is logged (V441)', detail: `${logged[0]?.n} rows` },
      true,
    );

  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fmy-day');
  await tryDoor(their, target.email, fx().password);
  const oldRefused = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/sign-in',
      check: 'the password before the generate no longer works',
      detail: `"${oldRefused}"`,
    },
    /\/sign-in/.test(their.url()) && oldRefused.length > 0,
  );
  await tryDoor(their, target.email, temporary);
  await their.waitForURL(/\/set-password/, { timeout: 20_000 }).catch(() => undefined);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/set-password',
      check: 'the temporary password lands on "Choose a new password"',
      detail: their.url(),
    },
    /\/set-password/.test(their.url()),
  );
  for (const path of [
    '/my-day',
    '/profile',
    '/activity',
    '/settings/org',
    `/people/${target.id}`,
    '/partners?view=clients',
  ]) {
    await their.goto(path);
    verdict(
      {
        area: AREA,
        user: 'mustchange',
        screen: path,
        check: 'any page sends a must-change person back to set their password',
        detail: their.url(),
      },
      /\/set-password/.test(their.url()),
    );
  }

  // The gate reads the flag from the session cookie: can a person skip it by editing their own cookie?
  const cookie = await sessionCookie(ctx);
  const userPart = cookie?.session.user as { app_metadata?: Record<string, unknown> } | undefined;
  if (cookie && userPart?.app_metadata) {
    await cookie.write({
      ...cookie.session,
      user: { ...userPart, app_metadata: { ...userPart.app_metadata, must_change_password: false } },
    });
    await their.goto('/my-day');
    const skipped = !/\/set-password|\/sign-in/.test(their.url());
    verdict(
      {
        area: AREA,
        user: 'mustchange',
        screen: '/my-day',
        check:
          'the must-change gate cannot be skipped by editing the session cookie (the flag is read from the signed token)',
        detail: skipped ? `edited cookie reached ${their.url()}` : `still sent to ${their.url()}`,
        shot: skipped ? await shot(their, 'must-change-skipped-by-cookie') : undefined,
      },
      !skipped,
    );
    await ctx.clearCookies();
    await ctx.addCookies(cookie.original);
  } else {
    info({
      area: AREA,
      user: 'mustchange',
      check: 'must-change cookie edit',
      detail: 'the session cookie carries no user part; not tried',
    });
  }

  // The flag guards pages; the Data API is not a page.
  try {
    const api = await apiAs('mustchange', temporary);
    const me = await api('org');
    info({
      area: AREA,
      user: 'mustchange',
      check: 'before choosing a password, api.* still answers the temporary session (the gate is on pages only — V212)',
      detail: said(me),
    });
  } catch (e) {
    info({
      area: AREA,
      user: 'mustchange',
      check: 'api.* with the temporary password',
      detail: String(e).slice(0, 160),
    });
  }

  await their.goto('/set-password?next=%2Fmy-day');
  await hydrated(their);
  const save = their.locator('[data-set-password-save]');
  await their.getByLabel('New password', { exact: true }).fill('short1');
  await their.getByLabel('New password again').fill('short1');
  await save.evaluate((b) => b.removeAttribute('disabled'));
  await submitAndSettle(their, save);
  const short = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/set-password',
      check: 'a password under 10 characters is refused by the server, in words',
      detail: `"${short}"`,
    },
    isWords(short) && /\/set-password/.test(their.url()),
  );
  const own = `Own-QA-${fx().tag}-pass`;
  await their.getByLabel('New password', { exact: true }).fill(own);
  await their.getByLabel('New password again').fill(`${own}x`);
  await submitAndSettle(their, save);
  const mismatch = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/set-password',
      check: 'two different passwords are refused in words',
      detail: `"${mismatch}"`,
    },
    isWords(mismatch) && mismatch !== short,
  );
  await their.getByLabel('New password again').fill(own);
  await submitAndSettle(their, save);
  await their.waitForURL(/\/my-day/, { timeout: 20_000 }).catch(() => undefined);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/set-password',
      check: 'setting their own password lets them in',
      detail: their.url(),
    },
    /\/my-day/.test(their.url()),
  );
  await their.request.post('/auth/sign-out');
  await ctx.clearCookies();
  await their.goto('/sign-in');
  await tryDoor(their, target.email, temporary);
  const tempAfter = await refusal(their);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/sign-in',
      check: 'the temporary password stops working once their own is set',
      detail: `"${tempAfter}"`,
    },
    /\/sign-in/.test(their.url()) && tempAfter.length > 0,
  );
  await tryDoor(their, target.email, own);
  await their
    .waitForURL((u) => !/\/sign-in|\/set-password/.test(u.pathname), { timeout: 20_000 })
    .catch(() => undefined);
  verdict(
    {
      area: AREA,
      user: 'mustchange',
      screen: '/sign-in',
      check: 'their own password signs in with no second must-change',
      detail: their.url(),
    },
    !/\/sign-in|\/set-password/.test(their.url()),
  );
  await ctx.close();
});

test('after many wrong passwords the account is locked and the right one is refused until unlocked', async ({
  page,
}) => {
  const target = user('lockme');
  const N = 10;
  await page.goto('/sign-in');
  let last = '';
  for (let i = 0; i < N; i++) {
    await tryDoor(page, target.email, `Wrong-password-${i}-x`);
    last = await refusal(page);
    await expect(refusalLine(page)).toBeVisible();
  }
  verdict(
    {
      area: AREA,
      user: 'lockme',
      screen: '/sign-in',
      check: `the ${N}th wrong password is still refused in words`,
      detail: `"${last}"`,
    },
    isWords(last) || /too many/i.test(last),
  );
  await tryDoor(page, target.email, fx().password);
  await page.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  const signedIn = !/\/sign-in/.test(page.url());
  if (signedIn)
    notBuilt({
      area: AREA,
      user: 'lockme',
      screen: '/sign-in',
      check: `a lockout after ${N} wrong passwords`,
      detail:
        'the right password still signs in: no lockout exists in the code or the settings (V212/V431 name none); only the auth server limit per address (sign-ins 200 per 5 min) applies',
    });
  else
    verdict(
      {
        area: AREA,
        user: 'lockme',
        screen: '/sign-in',
        check: `locked after ${N} wrong passwords`,
        detail: `"${await refusal(page)}"`,
      },
      true,
    );
});
