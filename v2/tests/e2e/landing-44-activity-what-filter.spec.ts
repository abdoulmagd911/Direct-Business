/**
 * Landing 44 — the Activity page's What filter narrows the list (the Landing 33 live check of 22 Nov found
 * "What = Comment" changing the address while the list stayed as it was). On the real stack: an admin makes a
 * comment and a change of another kind, and one entry is logged the way the seed import of 20 Nov was — an
 * organisation and a comment written in one request. Picking Comment in What puts it in the address; every entry
 * left is a comment one — the organisation made is gone, and the seed-shaped entry shows its comment only, never
 * "Organisation added" — and it stays so on reload; without the choice everything is back.
 * Every value is made up. Sabotage: tests/sabotage/landing-44.mjs.
 */
import { expect, test } from '@playwright/test';
import { hydrated, signedInAdmin } from './support/landing-32';
import { callAs, sql } from './support/stack';

test('What = Comment leaves only comment entries, in the address and after a reload; without it the rest comes back', async ({
  page,
}) => {
  await signedInAdmin(page);
  const word = Math.random().toString(36).slice(2, 8);
  const made = await callAs(page.context(), 'partner_create', {
    p_partner: { trade_name_en: `Made Up Activity Org ${word}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const id = (made.body as { id: string }).id;
  const said = await callAs(page.context(), 'comment_add', {
    p_entity: 'partner',
    p_id: id,
    p_body: `Made-up remark ${word}`,
  });
  expect(said.status, JSON.stringify(said.body)).toBe(200);
  const commentId = (said.body as { id: string }).id;
  // the seed's shape: one request by the system that wrote an organisation and a comment together
  const seeded = `Made Up Seeded Org ${word}`;
  await sql(
    `with q as (insert into audit.request (actor_id, kind, label_key, at)
                values ('00000000-0000-4000-8000-000000000001', 'system', 'audit.unattended_write', now()) returning id)
     insert into audit.change (request_id, table_name, row_id, action, fields, after)
     select q.id, x.t, x.r, 'insert', '{}', x.a from q,
       (values ('partner.partner', $1::uuid, jsonb_build_object('trade_name_en', $2::text), 1),
               ('core.comment', $3::uuid, jsonb_build_object('body', 'Made-up seeded remark'), 2)) as x(t, r, a, o)
     order by x.o`,
    [id, seeded, commentId],
  );

  await page.goto('/activity');
  await hydrated(page);
  const rows = page.locator('[data-activity-changes] [data-history-row]');
  const created = rows.filter({ hasText: `Made Up Activity Org ${word}` });
  await expect(created.first(), 'the organisation made is in the whole log').toBeVisible();

  const what = page.locator('[data-activity-filters]').getByRole('combobox').nth(1);
  await what.click();
  await page.getByRole('option', { name: 'Comment', exact: true }).click();
  await expect(page, 'the choice is in the address').toHaveURL(/entity=[^&]*comment/);
  await expect(created, 'the organisation made is no comment: it is gone from the list').toHaveCount(0);
  await expect(rows.first(), 'the comment is listed').toBeVisible();
  for (const text of await rows.allInnerTexts()) expect(text, 'every entry left is a comment one').toMatch(/Comment/);
  await expect(rows.filter({ hasText: 'Organisation added' }), 'no entry is named Organisation added').toHaveCount(0);

  await page.reload();
  await hydrated(page);
  await expect(created, 'after a reload the list is still only comments').toHaveCount(0);
  await expect(rows.first()).toBeVisible();

  await page.goto('/activity');
  await hydrated(page);
  await expect(created.first(), 'without the choice the rest comes back').toBeVisible();
});
