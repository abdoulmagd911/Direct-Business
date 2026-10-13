/**
 * QA-208 by real clicks (#157's check, 7 Oct): an admin on their own person page. With one e-mail the page offers no
 * Remove (V219, the screen half). With a spare e-mail that has no sign-in of its own, the page offers Remove beside the
 * e-mail they are signed in with: removing it must be refused in words, or they are locked out (no e-mail left that
 * signs in). Uses the made-up QA account (an admin) so the other specs' admin is untouched; it locks that account out
 * when the database lets it through, so it is kept out of the full sweep:
 * QA_ROUND=1 tests/qa/sweep/run.sh -- --grep "desktop round: own email". Made-up people only (seed.mjs).
 */
import { expect, test } from '@playwright/test';
import { apiAs, hydrated, shot, signIn, sql, user, verdict } from './lib';

const AREA = 'round';

test('desktop round: own email — an admin cannot lock themselves out from their own person page', async ({ page }) => {
  test.setTimeout(240_000);
  const me = user('qa_test');
  const at = (detail: string) => ({ area: AREA, screen: '/people/:id (own)', user: 'qa_test (admin)', detail });
  await signIn(page, 'qa_test', `/people/${me.id}`);
  await hydrated(page);
  page.setDefaultTimeout(15_000);
  const removeButtons = page.locator('[data-person-email] [data-email-remove]');
  const before = await removeButtons.count();
  verdict(
    { ...at(`${before} Remove button(s)`), check: 'with one e-mail, their own page offers no Remove (V219)' },
    before === 0,
  );

  // a spare e-mail with no sign-in of its own (no password set, SIGN-10)
  const api = await apiAs('qa_test');
  const added = await api('person_email_add', {
    p_person: me.id,
    p_email: `made.up.spare.${Date.now()}@example.test`,
    p_primary: false,
    p_reason: 'Made-up: a spare mailbox',
  });
  expect(added.ok).toBe(true);
  await page.reload();
  await hydrated(page);
  const row = page.locator(`[data-person-email="${me.email.toLowerCase()}"]`);
  const offered = await row.locator('[data-email-remove]').count();
  if (offered === 0) {
    verdict(
      { ...at('no Remove beside the sign-in e-mail'), check: 'the e-mail they sign in with is not removable' },
      true,
    );
    return;
  }
  await row.locator('[data-email-remove]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Reason/).fill('Made-up: tidying up');
  await dialog.getByRole('button', { name: /^Remove/ }).click();
  await page.waitForTimeout(2_500);
  const said = (
    (await page
      .locator('[data-sonner-toast], [role=alert]')
      .allInnerTexts()
      .catch(() => [])) ?? []
  )
    .join(' | ')
    .replace(/\s+/g, ' ');
  const [left] = await sql<{ live: number; signs_in: number }>(
    `select count(*)::int as live,
            count(*) filter (where exists (select 1 from auth.users u where lower(u.email) = lower(e.email::text)))::int
              as signs_in
       from core.person_email e where e.person_id = $1 and e.deleted_at is null`,
    [me.id],
  );
  await shot(page, 'round-own-email-after-remove');
  await page.reload();
  const landed = new URL(page.url()).pathname;
  verdict(
    {
      ...at(
        `on screen: ${said.slice(0, 120)}; live e-mails ${left!.live}, with a sign-in ${left!.signs_in}; reload lands on ${landed}`,
      ),
      check:
        'removing the e-mail they sign in with, while the spare has no sign-in, is refused in words — never a lockout',
    },
    left!.signs_in >= 1 && !/sign-in|sign-out/.test(landed),
  );
});
