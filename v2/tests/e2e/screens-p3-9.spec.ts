/**
 * Screenshots of the P3-9a screens: the Clients list with organisations (saved views, the search, the table or the
 * cards on a phone) and an organisation's record with both sides on, a status, a logged call and a note — four themes
 * at 1,500 and 400 px; axe finds no serious issue on either.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { THEMES, fitToPage, setPrefs, shot } from './helpers';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** Six organisations on the Client side, one of them a key partner with the supplier side on and a call logged. */
async function stage(context: BrowserContext, tag: string) {
  const create = async (partner: Record<string, unknown>) => {
    const r = await callAs(context, 'partner_create', { p_partner: partner });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return (r.body as { id: string }).id;
  };
  const types = ['corporate', 'agencies', 'government', 'individuals', 'corporate'];
  for (let i = 0; i < types.length; i += 1) {
    await create({ trade_name_en: `Shot Org ${tag} ${i}`, sides: [{ side: 'client', type: types[i] }] });
  }
  const id = await create({
    trade_name_en: `Shot Key Org ${tag}`,
    trade_name_ar: `منشأة اللقطة ${tag}`,
    key_partner: true,
    sides: [
      { side: 'client', type: 'corporate' },
      { side: 'supplier_partner', type: 'supplier' },
    ],
  });
  let r = await callAs(context, 'partner_status_set', { p_id: id, p_side: 'client', p_status: 'active' });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  r = await callAs(context, 'activity_log', {
    p_partner: id,
    p_type: 'call',
    p_outcome: 'answered',
    p_body: 'Called to confirm the season rates.',
    p_next_step: 'Send the offer',
    p_next_step_on: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  r = await callAs(context, 'note_add', {
    p_entity: 'partner',
    p_id: id,
    p_kind: 'comment',
    p_body: 'A made-up note.',
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return id;
}

async function noSeriousIssue(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    what,
  ).toEqual([]);
}

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · P3-9 · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width: 1500, height: 900 });
      const admin = await makePerson({ admin: true });
      const tag = `${theme}${width}${Date.now().toString(36)}`;
      await signIn(page, admin.email, '/clients');
      await hydrated(page);
      const id = await stage(context, tag);

      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/clients?q=${encodeURIComponent(`Org ${tag}`)}`);
      await hydrated(page);
      // the table's name links at 1,500 px; the cards on a phone
      await expect(page.locator(width === 400 ? '[data-partner-card]' : '[data-partner-link]')).toHaveCount(6);
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`clients-${theme}-${width}`) });
      await noSeriousIssue(page, 'the Clients list');

      await page.goto(`/clients/${id}`);
      await hydrated(page);
      await expect(page.getByRole('heading', { level: 1, name: `Shot Key Org ${tag}` })).toBeVisible();
      await expect(page.locator('[data-partner-notes]')).toContainText('Called to confirm');
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`partner-record-${theme}-${width}`) });
      await noSeriousIssue(page, 'the organisation record');
    });
  }
}
