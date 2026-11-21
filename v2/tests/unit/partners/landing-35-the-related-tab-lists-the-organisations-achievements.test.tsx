// @vitest-environment jsdom
/**
 * Landing 35 (the owner's check of 21 Nov: "add an achievement and confirm it shows on the client"): the record's
 * Related tab lists the achievements logged with the organisation — number, title (a link to the achievement's own
 * record), category, the day and who logged it, in the order the database answered (newest first) — from its own
 * read, asked when the tab is opened and not before, kept while the record is open and read again after a change.
 * A list that does not load says so with a Try again that reads again; none is one plain line. No amount is ever
 * drawn: an achievement's value is not revenue. Made-up values only.
 * Sabotage: tests/sabotage/landing-35-partner-achievements.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { DbError } from '../../../src/core/db/errors';

type Held = { fn: string; args: unknown; opts: unknown; answer: (v: unknown) => void; fail: (e: unknown) => void };
const asked = vi.hoisted(() => [] as Held[]);
vi.mock('@/core/db/rpc', () => ({
  rpc: (fn: string, args: unknown, opts: unknown) =>
    new Promise((answer, fail) => {
      asked.push({ fn, args, opts, answer, fail });
    }),
}));

const { PartnerAchievements } = await import('../../../src/modules/partners/screens/record/PartnerAchievements');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  asked.length = 0;
});

const PEOPLE = [
  { id: 'made-up-person', full_name_en: 'Made-up Logger', full_name_ar: 'مسجّل مختلق' },
  { id: 'made-up-other', full_name_en: 'Made-up Bystander', full_name_ar: null },
];
const ROW = {
  id: 'made-up-ach-2',
  number: 'ACH-2026-9902',
  title: 'Made-up later award',
  category: 'AWARD',
  category_en: 'Awards',
  category_ar: 'الجوائز',
  happened_on: '2026-09-21',
  logged_at: '2026-09-22T09:00:00+03:00',
  logged_by: 'made-up-person',
  owner_id: 'made-up-other',
  // a figure the database never sends; were one ever to ride along, the list must still draw no amount
  deal_value: 990001,
};
const OLDER = {
  ...ROW,
  id: 'made-up-ach-1',
  number: 'ACH-2026-9901',
  title: 'Made-up earlier award',
  happened_on: '2026-09-14',
};
const LIST = { rows: [ROW, OLDER], total: 2, more: false };
const NONE = { rows: [], total: 0, more: false };

const draw = (tab: string, more: { stamp?: number; partnerId?: string; locale?: 'en' | 'ar' } = {}) => {
  if (!root) {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={more.locale ?? 'en'} messages={more.locale === 'ar' ? ar : en}>
        <PartnerAchievements
          tab={tab}
          partnerId={more.partnerId ?? 'made-up-org'}
          stamp={more.stamp ?? 0}
          people={PEOPLE as never}
        />
      </NextIntlClientProvider>,
    );
  });
};
const section = () => document.querySelector('[data-partner-achievements]');
const state = () => section()?.getAttribute('data-partner-achievements-state') ?? null;
const rows = () => [...document.querySelectorAll('[data-partner-achievement]')];
const answer = (i: number, v: unknown) => act(async () => asked[i]!.answer(v));
const fail = (i: number, e: unknown) => act(async () => asked[i]!.fail(e));
const TIMEOUT = new DbError('Unavailable', 'common.unavailable', '57014 canceling statement due to statement timeout');

describe('the Related tab lists the organisation’s achievements', () => {
  it('the other tabs ask for nothing and draw nothing of it', () => {
    for (const tab of ['overview', 'discussion', 'codes', 'finance', 'history']) draw(tab);
    expect(asked).toHaveLength(0);
    expect(section()).toBeNull();
    expect(document.body.textContent).toBe('');
  });

  it('opening Related asks once for this organisation’s achievements and says it is loading', () => {
    draw('overview');
    draw('related');
    expect(asked.map((a) => [a.fn, a.args])).toEqual([['partner_achievements', { p_partner: 'made-up-org' }]]);
    expect(state()).toBe('loading');
    expect(section()?.querySelector('h2')?.textContent).toBe('Achievements');
    expect(section()?.querySelector('[data-state="loading"]')).not.toBeNull();
    expect(rows(), 'nothing is listed before it is read').toHaveLength(0);
  });

  it('each achievement is a row with its number, title, category, day and who logged it — newest first', async () => {
    draw('related');
    await answer(0, LIST);
    expect(state()).toBe('ready');
    expect(rows().map((r) => r.getAttribute('data-partner-achievement'))).toEqual(['ACH-2026-9902', 'ACH-2026-9901']);
    const first = rows()[0]!;
    expect(first.textContent).toContain('ACH-2026-9902');
    expect(first.textContent).toContain('Made-up later award');
    expect(first.textContent).toContain('Awards');
    expect(first.querySelector('[data-partner-achievement-day]')?.textContent).toBe('21 Sep 2026');
    expect(first.querySelector('[data-partner-achievement-by]')?.textContent).toBe('Logged by Made-up Logger');
    expect(rows()[1]!.textContent).toContain('Made-up earlier award');
  });

  it('the title opens the achievement’s own record', async () => {
    draw('related');
    await answer(0, LIST);
    const links = rows().map((r) => r.querySelector('a'));
    expect(links.map((a) => a?.getAttribute('href'))).toEqual([
      '/kpis/achievements/made-up-ach-2',
      '/kpis/achievements/made-up-ach-1',
    ]);
    expect(links[0]?.textContent).toBe('Made-up later award');
  });

  it('no amount is drawn beside an achievement: its value is not revenue', async () => {
    draw('related');
    await answer(0, LIST);
    const text = section()!.textContent ?? '';
    expect(text).not.toMatch(/990[,٬.]?001/);
    expect(text).not.toMatch(/SAR|ر\.س|﷼|Revenue|Value/i);
  });

  it('an organisation with none says so in one line', async () => {
    draw('related');
    await answer(0, NONE);
    expect(state()).toBe('empty');
    expect(rows()).toHaveLength(0);
    expect(section()?.querySelector('[data-state="empty"]')?.textContent).toBe(
      'No achievements logged for this organisation yet',
    );
  });

  it('a list that does not load says why, and Try again reads again', async () => {
    draw('related');
    await fail(0, TIMEOUT);
    expect(state()).toBe('failed');
    expect(section()?.textContent).toContain('Achievements could not be loaded. It took too long and was stopped.');
    expect(section()?.querySelector('[data-failure-ref]')?.textContent).toBe('Unavailable · 57014');
    expect(rows(), 'a failed list is never drawn as none').toHaveLength(0);
    expect(section()?.textContent).not.toContain('No achievements logged');
    await act(async () => (document.querySelector('[data-partner-achievements-retry]') as HTMLButtonElement).click());
    expect(asked).toHaveLength(2);
    expect(state(), 'the try is seen: the section is loading again').toBe('loading');
    await fail(1, TIMEOUT);
    expect(document.querySelector('[data-read-tried]')?.textContent).toBe('Tried again once: it still did not load.');
    await act(async () => (document.querySelector('[data-partner-achievements-retry]') as HTMLButtonElement).click());
    await answer(2, LIST);
    expect(state()).toBe('ready');
    expect(rows()).toHaveLength(2);
  });

  it('what was read is kept: away and back asks nothing again', async () => {
    draw('related');
    await answer(0, LIST);
    draw('overview');
    expect(section()).toBeNull();
    draw('related');
    expect(asked).toHaveLength(1);
    expect(rows()).toHaveLength(2);
  });

  it('after a change on the record the list is read again, the old one staying until it lands', async () => {
    draw('related');
    await answer(0, { rows: [OLDER], total: 1, more: false });
    draw('related', { stamp: 1 });
    expect(asked).toHaveLength(2);
    expect(rows().map((r) => r.getAttribute('data-partner-achievement'))).toEqual(['ACH-2026-9901']);
    await answer(1, LIST);
    expect(rows()).toHaveLength(2);
  });

  it('another organisation’s list is never shown on this one', async () => {
    draw('related');
    await answer(0, LIST);
    draw('related', { partnerId: 'made-up-second-org' });
    expect(asked[1]?.args).toEqual({ p_partner: 'made-up-second-org' });
    expect(rows(), 'the first organisation’s rows are gone while the second is read').toHaveLength(0);
    expect(state()).toBe('loading');
  });

  it('a list longer than the page says how many are shown', async () => {
    draw('related');
    await answer(0, { rows: [ROW, OLDER], total: 73, more: true });
    expect(document.querySelector('[data-partner-achievements-more]')?.textContent).toBe('Showing the newest 2 of 73');
    draw('related', { stamp: 1 });
    await answer(1, LIST);
    expect(document.querySelector('[data-partner-achievements-more]')).toBeNull();
  });

  it('in Arabic the heading, the category and who logged it are Arabic', async () => {
    draw('related', { locale: 'ar' });
    await answer(0, LIST);
    expect(section()?.querySelector('h2')?.textContent).toBe('الإنجازات');
    const first = rows()[0]!;
    expect(first.textContent).toContain('الجوائز');
    expect(first.textContent).not.toContain('Awards');
    expect(first.querySelector('[data-partner-achievement-by]')?.textContent).toBe('سجّله مسجّل مختلق');
    expect(first.textContent).toContain('ACH-2026-9902');
  });
});
