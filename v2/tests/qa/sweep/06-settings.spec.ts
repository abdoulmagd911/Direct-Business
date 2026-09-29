/**
 * Settings and access are the admin's (V97, V125, V441): every settings and access door refuses a non-admin, in words,
 * with nothing written — through the Data API with their own session and through the app's /auth/admin/* routes with
 * their own browser session. The screens' side of the same rule (no-access state, no controls) is in 02 and 03.
 */
import { test } from '@playwright/test';
import { apiAs, fx, hydrated, info, inWords, said, signIn, sql, user, verdict, words } from './lib';

const AREA = 'settings';
const NON_ADMINS = ['head', 'manager', 'member', 'viewer', 'noclients', 'nolevels'];

async function requests(person: string): Promise<string> {
  return (
    (await sql<{ n: string }>(`select count(*)::text as n from audit.request where actor_id = $1`, [person]))[0]?.n ??
    '?'
  );
}

test('every settings and access door of the Data API refuses a non-admin, in words, writing nothing', async () => {
  const f = fx();
  const [ids] = await sql<{
    member_role: string;
    admin_role: string;
    dept: string;
    dept_v: number;
    role_v: number;
    m2_v: number;
  }>(
    `select (select id::text from core.role where key = 'member') as member_role,
            (select id::text from core.role where key = 'admin') as admin_role,
            (select id::text from core.department where code = 'commercial') as dept,
            (select version from core.department where code = 'commercial') as dept_v,
            (select version from core.role where key = 'member') as role_v,
            (select version from core.person where id = $1) as m2_v`,
    [user('member2').id],
  );
  if (!ids) throw new Error('no ids');
  const m2 = user('member2').id;
  for (const key of NON_ADMINS) {
    const me = user(key).id;
    const api = await apiAs(key);
    const calls: [string, Record<string, unknown>][] = [
      ['setting_set', { p_key: 'work.no_update_days', p_department: null, p_value: 9, p_reason: 'QA sweep' }],
      ['setting_clear', { p_key: 'work.no_update_days', p_department: null, p_reason: 'QA sweep' }],
      [
        'list_save',
        {
          p_list: 'priority',
          p_id: null,
          p_values: { key: `qa_${key}_${f.tag}`, name_en: 'Test', name_ar: 'تجربة' },
          p_reason: 'QA sweep',
        },
      ],
      ['access_set_person_level', { p_person: m2, p_page: 'overview', p_level: 'view', p_reason: 'QA sweep' }],
      [
        'access_set_person_level',
        { p_person: me, p_page: 'settings.org', p_level: 'full', p_reason: 'QA sweep: my own' },
      ],
      [
        'access_set_person_capability',
        { p_person: me, p_capability: 'org.sign_out', p_granted: true, p_reason: 'QA sweep: my own' },
      ],
      ['access_set_person_role', { p_person: me, p_role: ids.admin_role, p_reason: 'QA sweep: make me admin' }],
      ['access_set_role_level', { p_role: ids.member_role, p_page: 'overview', p_level: 'view', p_reason: 'QA sweep' }],
      [
        'person_update',
        { p_id: m2, p_changes: { job_title_en: 'Changed by a non-admin' }, p_version: ids.m2_v, p_reason: 'QA sweep' },
      ],
      ['person_switch', { p_id: m2, p_on: false, p_reason: 'QA sweep' }],
      ['person_create', { p_person: { full_name_en: 'Test Nobody', department_id: ids.dept }, p_reason: 'QA sweep' }],
      [
        'role_save',
        {
          p_id: ids.member_role,
          p_key: 'member',
          p_name_en: 'Team member (changed)',
          p_name_ar: 'عضو',
          p_sort: 40,
          p_version: ids.role_v,
          p_reason: 'QA sweep',
        },
      ],
      [
        'team_save',
        {
          p_id: null,
          p_department: ids.dept,
          p_code: `qa_t_${key}`,
          p_name_en: 'Test team',
          p_name_ar: 'فريق',
          p_reason: 'QA sweep',
        },
      ],
      [
        'department_save',
        {
          p_id: ids.dept,
          p_code: 'commercial',
          p_name_en: 'Commercial (changed)',
          p_name_ar: 'التجاري',
          p_version: ids.dept_v,
          p_reason: 'QA sweep',
        },
      ],
      [
        'side_field_save',
        {
          p_id: null,
          p_values: { side: 'client', key: `qa_${key}`, label_en: 'Test field', label_ar: 'حقل', type: 'text' },
          p_reason: 'QA sweep',
        },
      ],
      ['identifier_block_add', { p_kind: 'vat', p_match: 'exact', p_value: '300000000000013', p_reason: 'QA sweep' }],
      ['person_email_remove', { p_id: '00000000-0000-4000-8000-00000000abcd', p_reason: 'QA sweep' }],
      ['person_sign_out', { p_person: m2 }],
    ];
    for (const [fn, args] of calls) {
      const before = await requests(me);
      const r = await api(fn, args);
      const after = await requests(me);
      const label = fn === 'access_set_person_level' && args.p_person === me ? `${fn} (their own)` : fn;
      verdict(
        {
          area: AREA,
          user: key,
          screen: `(api) ${label}`,
          check: 'refused for a non-admin, in words, nothing written',
          detail: `${said(r)}${before !== after ? ` · ${Number(after) - Number(before)} requests written` : ''}`,
        },
        !r.ok && inWords(r) && before === after,
      );
      const req = (r.data as { request_id?: string } | null)?.request_id;
      if (r.ok && req) await (await apiAs('admin'))('undo', { p_request: req });
    }
    // reads of the settings pages: what a non-admin gets back
    for (const [fn, args] of [
      ['settings', { p_group: 'settings.org' }],
      ['settings_log', { p_limit: 5 }],
      ['access_matrix', {}],
      ['people', {}],
      ['access_of_person', { p_person: m2 }],
      ['person_devices', { p_person: m2 }],
      ['sign_in_log', { p_person: m2 }],
    ] as const) {
      const r = await api(fn, args);
      const strict = ['settings_log', 'access_of_person', 'person_devices', 'sign_in_log'].includes(fn);
      if (strict)
        verdict(
          {
            area: AREA,
            user: key,
            screen: `(api) ${fn}`,
            check: "an admin's read is refused, in words",
            detail: said(r),
          },
          !r.ok && inWords(r),
        );
      else
        info({
          area: AREA,
          user: key,
          screen: `(api) ${fn}`,
          check: 'what a non-admin reads',
          detail: said(r).slice(0, 140),
        });
    }
  }
});

test("the app's admin routes refuse a non-admin's browser session, in words, changing nothing", async ({ page }) => {
  const f = fx();
  const m2 = user('member2');
  const pw = async () =>
    (await sql<{ p: string }>(`select encrypted_password as p from auth.users where email = $1`, [m2.email]))[0]?.p ??
    '';
  const [someRequest] = await sql<{ id: string }>(
    `select id::text from audit.request where actor_id = $1 order by at desc limit 1`,
    [user('admin').id],
  );
  for (const key of ['head', 'manager', 'member', 'viewer']) {
    await page.context().clearCookies();
    await signIn(page, key, '/profile');
    await hydrated(page);
    const before = await pw();
    const routes: [string, Record<string, unknown>][] = [
      ['/auth/admin/password', { person_id: m2.id, reason: 'QA sweep' }],
      [
        '/auth/admin/emails',
        { person_id: user(key).id, email: `test.qa.extra.${key}.${f.tag}@example.test`, reason: 'QA sweep' },
      ],
      ['/auth/admin/sign-out', { person_id: m2.id }],
      ['/auth/admin/sync', { person_id: m2.id }],
      ['/auth/admin/undo', { request_id: someRequest?.id }],
    ];
    for (const [path, body] of routes) {
      const res = await page.request.post(path, { data: body });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: { kind?: string; key?: string };
        temporary_password?: string;
      } | null;
      const k = json?.error?.key;
      const kind = json?.error?.kind;
      const text = (k && words(`errors.${k}`)) || (kind && words(`errors.kind.${kind}`)) || null;
      verdict(
        {
          area: AREA,
          user: key,
          screen: `POST ${path}`,
          check: 'refused for a non-admin, in words',
          detail: `HTTP ${res.status()} ${kind ?? ''} ${k ?? JSON.stringify(json).slice(0, 80)} → "${text}"`,
        },
        res.status() >= 400 && json?.ok === false && !!kind && kind !== 'Unavailable' && !json?.temporary_password,
      );
    }
    verdict(
      {
        area: AREA,
        user: key,
        screen: 'POST /auth/admin/password',
        check: "the other person's password is unchanged",
        detail: before === (await pw()) ? 'unchanged' : 'CHANGED',
      },
      before === (await pw()),
    );
  }
  const emails = await sql<{ n: string }>(`select count(*)::text as n from core.person_email where email like $1`, [
    `test.qa.extra.%.${f.tag}@example.test`,
  ]);
  verdict(
    {
      area: AREA,
      screen: 'POST /auth/admin/emails',
      check: 'no email was added by a non-admin',
      detail: `${emails[0]?.n} added`,
    },
    emails[0]?.n === '0',
  );
});
