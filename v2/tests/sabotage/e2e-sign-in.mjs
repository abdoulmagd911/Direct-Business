// Sabotages for the sign-in E2E specs (P3-2): each plants one mistake in the app and the named spec must go red for
// that reason. The runner builds the app first, so every edit still compiles. Run: node scripts/sabotage.mjs --kind e2e
const e2e = (spec) => `e2e:tests/e2e/${spec}.spec.ts`;
const REFUSAL_LINE = "getByRole('main').getByRole('alert')";

export const sabotages = [
  {
    name: 'e2e-first-page-draws-nothing',
    breaks: [e2e('the-app-serves-its-first-page')],
    expect: 'Commercial Workspace',
    edits: [
      {
        file: 'src/modules/org/screens/SignIn.tsx',
        find: `<h1 className="text-3xl">{t('app.name')}</h1>`,
        replace: '{null}',
      },
    ],
  },
  {
    name: 'e2e-sign-in-forgets-the-device',
    breaks: [e2e('an-allowed-email-signs-in-with-the-emailed-code')],
    expect: 'signs in',
    edits: [
      {
        file: 'src/core/auth/actions.ts',
        find: "const done = await db.rpc('sign_in_complete', {",
        replace: "const done = await serviceDb().rpc('sign_in_complete', {",
      },
      {
        file: 'src/core/auth/password-actions.ts',
        find: "const done = await db.rpc('sign_in_complete', {",
        replace: "const done = await serviceDb().rpc('sign_in_complete', {",
      },
    ],
  },
  {
    name: 'e2e-codes-for-anyone',
    // Both doors: the code door's spec runs under SIGN_IN_METHOD=code; password.spec.ts holds the same promise.
    breaks: [e2e('password'), e2e('a-switched-off-person-is-refused-at-once-with-the-message')],
    expect: REFUSAL_LINE,
    edits: [
      {
        file: 'src/core/auth/actions.ts',
        find: "if (check.data === 'not_listed' || check.data === 'switched_off') return { ok: false, error: check.data };",
        replace: '',
      },
      {
        file: 'src/core/auth/actions.ts',
        find: "if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };",
        replace: "if (!check.data) return { ok: false, error: 'unavailable' };",
      },
      {
        file: 'src/core/auth/password-actions.ts',
        find: "if (check.data === 'not_listed' || check.data === 'switched_off') return { ok: false, error: check.data };",
        replace: '',
      },
      {
        file: 'src/core/auth/password-actions.ts',
        find: "if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };",
        replace: "if (!check.data) return { ok: false, error: 'unavailable' };",
      },
    ],
  },
  // ---- the password door (owner, 29 Sep 13:50)
  {
    name: 'password-too-short-accepted',
    breaks: [e2e('password')],
    expect: 'the server refuses a short password',
    edits: [
      {
        file: 'src/core/auth/password-rules.ts',
        find: 'password.length >= MIN_PASSWORD',
        replace: 'password.length >= 1',
      },
    ],
  },
  {
    name: 'must-change-not-enforced',
    breaks: [e2e('password')],
    expect: 'set-password',
    edits: [
      {
        file: 'src/core/auth/require-me.ts',
        find: 'if (await mustChangePassword()) redirect(`/set-password?next=${encodeURIComponent(here)}`);',
        replace: 'void mustChangePassword;',
      },
    ],
  },
  {
    name: 'e2e-deep-links-forget-where',
    breaks: [e2e('a-signed-out-deep-link-returns-to-the-same-address')],
    expect: 'next=%2Fpartners%2Fsome-partner',
    edits: [
      {
        file: 'src/core/db/proxy-session.ts',
        find: 'return redirectWith(request, response, `${to}?next=${encodeURIComponent(here)}`);',
        replace: 'return redirectWith(request, response, `${to}?next=%2F`);',
      },
    ],
  },
  {
    name: 'e2e-gate-draws-first',
    breaks: [e2e('no-content-is-drawn-before-me-is-known')],
    expect: 'a refused session gets no content',
    edits: [
      {
        file: 'src/core/auth/require-me.ts',
        find: "if (me.status !== 'ok') redirect(`/auth/sign-out?next=${encodeURIComponent(here)}`);",
        replace: "if (me.status !== 'ok') return me as never;",
      },
    ],
  },
  {
    name: 'e2e-gate-lets-refusals-in',
    breaks: [e2e('a-device-idle-for-31-days-asks-for-a-new-code-while-one-used-yesterday-does-not')],
    expect: 'the idle device asks for a new code',
    edits: [
      {
        file: 'src/core/auth/require-me.ts',
        find: "if (me.status !== 'ok') redirect(",
        replace: "if (me.status === 'not_listed' || me.status === 'switched_off') redirect(",
      },
      { file: 'src/core/auth/require-me.ts', find: '  return me;', replace: '  return me as never;' },
      {
        file: 'src/core/db/proxy-session.ts',
        find: "if (state === 'signed_out') {",
        replace: "if (state === 'never') {",
      },
    ],
  },
  {
    name: 'e2e-refused-devices-not-told-why',
    breaks: [
      e2e('signing-out-a-device-from-another-refuses-its-next-request'),
      e2e('an-admin-signing-a-person-out-refuses-their-next-request'),
    ],
    expect: REFUSAL_LINE,
    edits: [
      {
        file: 'src/app/auth/sign-out/route.ts',
        find: "if (reason) params.set('reason', reason);",
        replace: 'void reason;',
      },
    ],
  },
  {
    name: 'e2e-removed-email-not-banned',
    breaks: [e2e('an-admin-allows-an-email-and-removing-it-refuses-its-sign-in')],
    expect: "the removed email's auth user is banned",
    edits: [
      {
        file: 'src/core/auth/allow-list.ts',
        find: 'for (const authUserId of removed.ban) await setBanned(authUserId, true);',
        replace: 'for (const authUserId of removed.ban) void authUserId;',
      },
    ],
  },
  {
    name: 'e2e-undo-leaves-the-ban',
    breaks: [e2e('undoing-an-email-removal-lifts-its-ban')],
    expect: 'the undone removal lifts the ban',
    edits: [
      {
        file: 'src/core/auth/allow-list.ts',
        find: 'for (const personId of done.auth_resync ?? []) synced += (await syncPerson(personId)).synced;',
        replace: 'for (const personId of done.auth_resync ?? []) void personId;',
      },
    ],
  },
];
