/**
 * The oversight's signed-out walk of production (1 Oct, W31–W36), as checks on the built app, each failing until it is
 * built: W31 the security headers on every page, signed out and in (QA-215, Builder A); W32 an address under /api or an
 * address that does not exist answers 401 or 404 — never a redirect to the door that a browser follows to a 200 sign-in
 * page (QA-216, Builder A); W35 the door's fields tell the browser what they are (Builder B); W36 the door in Arabic once
 * an admin has switched Arabic on (Builder C). Plus the security walk of W33: the admin-only and server-only doors and
 * routes, called as a member and as a viewer, are refused. Made-up people only (seed.mjs).
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type APIResponse } from '@playwright/test';
import { apiAs, fx, hydrated, info, notBuilt, said, signIn, sql, user, verdict } from './lib';

const AREA = 'http';
type Where = { screen?: string; user?: string; detail?: string };
const check = (id: string, expected: string, w: Where, ok: boolean) =>
  verdict({ area: AREA, ...w, check: `${id} · ${expected}` }, ok);

/** W31: what a page must carry so it cannot be framed, sniffed or leak its address (QA-215). */
function securityHeaders(id: string, where: Where, r: APIResponse) {
  const h = r.headers();
  const csp = h['content-security-policy'] ?? '';
  const seen = `status ${r.status()}; CSP "${csp.slice(0, 80)}"; X-Frame-Options "${h['x-frame-options'] ?? ''}"; nosniff "${h['x-content-type-options'] ?? ''}"; Referrer-Policy "${h['referrer-policy'] ?? ''}"`;
  const w = { ...where, detail: seen };
  check(id, 'a Content-Security-Policy', w, csp.length > 0);
  check(
    id,
    'no framing by another site (frame-ancestors, or X-Frame-Options DENY or SAMEORIGIN)',
    w,
    /frame-ancestors\s+('none'|'self')/.test(csp) || /^(DENY|SAMEORIGIN)$/i.test(h['x-frame-options'] ?? ''),
  );
  check(id, 'X-Content-Type-Options: nosniff', w, (h['x-content-type-options'] ?? '').toLowerCase() === 'nosniff');
  check(
    id,
    'a Referrer-Policy that keeps the address in the app',
    w,
    /^(no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin)$/i.test(h['referrer-policy'] ?? ''),
  );
}

test('W31 · QA-215: the security headers, signed out and signed in', async ({ request, page }) => {
  securityHeaders('W31 · QA-215', { screen: '/sign-in', user: 'signed out' }, await request.get('/sign-in'));
  await signIn(page, 'member', '/my-day');
  securityHeaders(
    'W31 · QA-215',
    { screen: '/my-day', user: 'member' },
    await page.request.get('/my-day', { maxRedirects: 0 }),
  );
});

test('W32 · QA-216: /api and unknown addresses answer 401 or 404, never the door', async ({ request, page }) => {
  const answer = async (r: Promise<APIResponse>) => {
    const res = await r;
    return { status: res.status(), to: res.headers()['location'] ?? '' };
  };
  for (const [method, path] of [
    ['GET', '/api'],
    ['GET', '/api/anything'],
    ['POST', '/api/anything'],
  ] as const) {
    const a = await answer(request.fetch(path, { method, maxRedirects: 0 }));
    check(
      'W32 · QA-216',
      `${method} ${path} signed out answers 401 or 404`,
      { screen: path, user: 'signed out', detail: `${a.status}${a.to ? ` → ${a.to}` : ''}` },
      a.status === 401 || a.status === 404,
    );
  }
  const unknown = await answer(request.get('/no/such/address', { maxRedirects: 0 }));
  check(
    'W32 · QA-216',
    'an address that does not exist answers 404 signed out',
    {
      screen: '/no/such/address',
      user: 'signed out',
      detail: `${unknown.status}${unknown.to ? ` → ${unknown.to}` : ''}`,
    },
    unknown.status === 404,
  );
  await signIn(page, 'member', '/my-day');
  for (const path of ['/no/such/address', '/api/anything']) {
    const a = await answer(page.request.get(path, { maxRedirects: 0 }));
    check(
      'W32 · QA-216',
      `${path} signed in answers 404 (the Not found page may show, with status 404)`,
      { screen: path, user: 'member', detail: `${a.status}${a.to ? ` → ${a.to}` : ''}` },
      a.status === 404,
    );
  }
});

test('W35: the door tells the browser what its fields are', async ({ page }) => {
  await page.goto('/sign-in');
  const fields = await page
    .locator('input')
    .evaluateAll((els) => els.map((e) => `${(e as HTMLInputElement).type}=${(e as HTMLInputElement).autocomplete}`));
  check(
    'W35',
    'the email is autocomplete "username" (or "email") and the password "current-password"',
    { screen: '/sign-in', user: 'signed out', detail: fields.join(', ') },
    fields.some((f) => /^email=(username|email)$/.test(f)) && fields.includes('password=current-password'),
  );
});

test('W36: once Arabic is switched on, the door offers it and an Arabic choice reads right to left', async ({
  page,
}) => {
  const [built] = await sql<{ ok: boolean }>(`select to_regprocedure('api.app_settings()') is not null as ok`);
  if (!built?.ok)
    return notBuilt({
      area: AREA,
      screen: '/sign-in',
      check: 'W36 · the door in Arabic (Arabic cannot be switched on before api.app_settings, #136 — V214)',
    });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, core.riyadh_today(), 'QA W36: made up', $1)`,
    [user('admin').id],
  );
  try {
    await page.goto('/sign-in');
    const button = page.locator('[data-door-language]:visible');
    const offered = await button.isVisible().catch(() => false);
    check('W36', 'the door offers Arabic', { screen: '/sign-in', user: 'signed out' }, offered);
    if (offered) {
      await button.click();
      await page.waitForLoadState('load');
      const html = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
      const heading = (await page.locator('h1').first().textContent()) ?? '';
      check(
        'W36',
        'and choosing it reads Arabic, right to left',
        { screen: '/sign-in', user: 'signed out', detail: `${html}; "${heading}"` },
        html === 'ar/rtl' && /[؀-ۿ]/.test(heading),
      );
    }
  } finally {
    await sql(`delete from core.setting where key = 'app.arabic_enabled' and reason = 'QA W36: made up'`);
  }
});

// ---------------------------------------------------------------- W33's security walk: admin-only doors as others
test('W33 · the admin-only and server-only doors refuse a member and a viewer', async () => {
  const f = fx();
  const other = user('member2');
  const [roles] = await sql<{ admin: string; member: string; dept: string; version: number }>(
    `select (select id::text from core.role where key = 'admin') as admin,
            (select id::text from core.role where key = 'member') as member,
            (select department_id::text from core.person where id = $1) as dept,
            (select version from core.person where id = $1) as version`,
    [other.id],
  );
  const [req] = await sql<{ id: string }>(
    `select id::text from audit.request where actor_id = $1 order by at desc limit 1`,
    [user('admin').id],
  );
  for (const key of ['member', 'viewer']) {
    const me = user(key);
    const api = await apiAs(key);
    const doors: [string, Record<string, unknown>][] = [
      ['access_set_person_level', { p_person: me.id, p_page: 'settings.org', p_level: 'full', p_reason: 'qa' }],
      ['access_set_person_role', { p_person: me.id, p_role: roles!.admin, p_reason: 'qa' }],
      ['access_set_role_level', { p_role: roles!.member, p_page: 'finance', p_level: 'full', p_reason: 'qa' }],
      [
        'person_update',
        { p_id: other.id, p_changes: { job_title_en: 'QA probe' }, p_version: roles!.version, p_reason: 'qa' },
      ],
      ['person_create', { p_person: { full_name_en: `Test Probe ${f.tag}` }, p_reason: 'qa' }],
      [
        'person_email_add',
        { p_person: other.id, p_email: `test.probe.${f.tag}@example.test`, p_primary: false, p_reason: 'qa' },
      ],
      ['person_switch', { p_id: other.id, p_on: false, p_reason: 'qa' }],
      ['person_account_set', { p_id: me.id, p_account: 'admin_account', p_reason: 'qa' }],
      ['person_password_set', { p_person: other.id, p_reason: 'qa', p_replace: true }],
      ['person_sign_out', { p_person: other.id, p_device: null }],
      [
        'setting_set',
        { p_key: 'app.arabic_enabled', p_department: null, p_value: true, p_valid_from: f.today, p_reason: 'qa' },
      ],
      [
        'role_save',
        {
          p_id: null,
          p_key: `qa_${f.tag}`,
          p_name_en: 'QA probe',
          p_name_ar: 'اختبار',
          p_sort: 99,
          p_version: null,
          p_reason: 'qa',
        },
      ],
      [
        'team_save',
        {
          p_id: null,
          p_department: roles!.dept,
          p_code: `qa_${f.tag}`,
          p_name_en: 'QA probe',
          p_name_ar: 'اختبار',
          p_lead: null,
          p_version: null,
          p_reason: 'qa',
        },
      ],
      ['identifier_block_add', { p_kind: 'email', p_match: 'domain', p_value: 'probe.example.test', p_reason: 'qa' }],
      ['people_without_password', {}],
      ['auth_ticket_issue', { p_kind: 'undo', p_target: randomUUID(), p_person: me.id }],
      ['auth_user_of', { p_email: user('admin').email }],
      ['person_auth_link', { p_email: other.email, p_auth_user_id: randomUUID() }],
      ['undo', { p_request: req?.id ?? randomUUID() }],
    ];
    for (const [fn, args] of doors) {
      const a = await api(fn, args);
      check('W33', `api.${fn} refuses a ${key}`, { screen: `api.${fn}`, user: key, detail: said(a) }, !a.ok);
    }
    // reads of another person's private figures: refused, or nothing of theirs
    for (const [fn, args] of [
      ['sign_in_log', { p_person: other.id, p_before: null, p_limit: 20 }],
      ['person_devices', { p_person: other.id }],
    ] as const) {
      const a = await api(fn, args);
      const rows = Array.isArray(a.data) ? a.data.length : a.data ? 1 : 0;
      check(
        'W33',
        `api.${fn} of a colleague gives a ${key} nothing`,
        { screen: `api.${fn}`, user: key, detail: a.ok ? `${rows} row(s)` : said(a) },
        !a.ok || rows === 0,
      );
    }
  }
});

test("W33 · the app's admin routes refuse a member", async ({ page }) => {
  await signIn(page, 'member', '/my-day');
  await hydrated(page);
  const other = user('member2');
  for (const [path, body] of [
    ['/auth/admin/emails/remove', { id: randomUUID(), reason: 'qa' }],
    ['/auth/admin/switch', { id: other.id, on: false, reason: 'qa' }],
    ['/auth/admin/sync', { person_id: other.id }],
    ['/auth/admin/undo', { request_id: randomUUID() }],
  ] as const) {
    const r = await page.request.post(path, { data: body, maxRedirects: 0 });
    check(
      'W33',
      `POST ${path} refuses a member (401, 403 or 404)`,
      { screen: path, user: 'member', detail: `${r.status()} ${(await r.text()).slice(0, 120)}` },
      [401, 403, 404].includes(r.status()),
    );
  }
  info({ area: AREA, check: 'W33 · the admin routes were called with the member’s own session cookies' });
  expect(true).toBe(true);
});
