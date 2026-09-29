/**
 * A person's page names a read that failed (QA on #92, #114): when one of its optional reads fails for a reason other
 * than access — here the sign-in log, made to fail for one made-up person only — the page still opens, the failed read
 * shows the failed state with Try again, and no empty or no-access state stands in for it; Try again reads once more.
 * Sabotage: tests/sabotage/screens.mjs "failed-read-drawn-as-empty".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('a failed sign-in log read is named with Try again, never drawn as empty', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const person = await makePerson();
  // api.sign_in_log is a thin wrapper over core.sign_in_log: for this one person it now fails like a server would
  const [orig] = await sql<{ def: string }>(
    `select pg_get_functiondef('api.sign_in_log(uuid, timestamptz, int)'::regprocedure) as def`,
  );
  await sql(
    `create or replace function api.sign_in_log(p_person uuid default null, p_before timestamptz default null, p_limit int default 50)
     returns jsonb language plpgsql stable security invoker set search_path = '' as $$
     begin
       if p_person = '${person.id}'::uuid then raise exception using errcode = 'P0001', message = 'common.unavailable'; end if;
       return core.sign_in_log(p_person, p_before, p_limit);
     end $$`,
  );
  try {
    await signIn(page, admin.email, `/people/${person.id}`);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible();
    const failed = page.locator('[data-state="failed"]');
    await expect(failed, 'the failed read is named').toBeVisible();
    await expect(failed).toContainText('Sign-in log could not be loaded');
    await expect(failed.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]'), 'a failure is not drawn as no access').toHaveCount(0);
    // the other reads still drew: the devices list is there
    await expect(page.getByText('Devices').first()).toBeVisible();
    // the read works again: Try again brings the log
    await sql(orig!.def);
    await failed.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('[data-state="failed"]')).toHaveCount(0);
    await expect(page.getByText('Sign-in log').first()).toBeVisible();
  } finally {
    await sql(orig!.def);
  }
});
