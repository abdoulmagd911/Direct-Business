// @vitest-environment jsdom
/**
 * Architect's order of 16 Oct (builder B): New client / New supplier shows no Tier box until the Settings list has
 * something to choose from (an empty box is a dead end), and Log activity's disabled Save says in one line, in English
 * and in Arabic, what is still to choose. Every value is made up (rule 7).
 * Sabotages: tests/sabotage/log-activity.mjs "an-empty-tier-box-is-shown", "a-disabled-save-says-nothing".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { ListEntry } from '../../../src/modules/partners/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ person: { id: 'p1' } }) }));

const { NewPartnerDialog } = await import('../../../src/modules/partners/screens/NewPartnerDialog');
const { LogActivityDialog } = await import('../../../src/modules/partners/screens/record/LogActivityDialog');

const entry = (n: string, extra: Partial<ListEntry> = {}) =>
  ({ id: `id-${n}`, key: n, name_en: `Made-up ${n}`, name_ar: `اختبار ${n}`, ...extra }) as unknown as ListEntry;
const ME = { person: { id: 'p1' }, capabilities: [] } as never;
const ORG = { people: [] } as never;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        {node}
      </NextIntlClientProvider>,
    );
  });
};
const newPartner = (tiers: ListEntry[]) =>
  draw(
    <NewPartnerDialog
      open
      onOpenChange={() => {}}
      side="client"
      me={ME}
      org={ORG}
      types={[entry('hotel')]}
      tiers={tiers}
      onCreated={() => {}}
    />,
  );

describe('a box with no choices is not shown (New client, New supplier)', () => {
  it('shows no Tier box while the Settings list is empty', () => {
    newPartner([]);
    expect(document.querySelector('[data-partner-form]')).not.toBeNull();
    expect(document.body.textContent, 'the Type box is still there').toContain('Type');
    expect(document.body.textContent, 'an empty Tier box is not drawn').not.toContain('Tier');
  });
  it('shows the Tier box once the list has an entry', () => {
    newPartner([entry('gold')]);
    expect(document.body.textContent).toContain('Tier');
  });
});

describe('Log activity says why Save is off, in one line', () => {
  const log = (locale: 'en' | 'ar', types = [entry('call', { id: 't1' })]) =>
    draw(
      <LogActivityDialog
        open
        onOpenChange={() => {}}
        partnerId="x"
        types={types}
        outcomes={[entry('answered', { activity_type_id: 't1' } as never)]}
        onDone={() => {}}
      />,
      locale,
    );
  it('says to choose a type when the list has none, in English', () => {
    log('en', []);
    const why = document.querySelector('[data-activity-why]');
    expect(why?.textContent, 'the line under the form').toContain('Choose a type');
    expect(document.querySelector('[data-activity-save]')).toHaveProperty('disabled', true);
  });
  it('says to choose the outcome once the type has opened on Call (22 Oct), in English', () => {
    log('en');
    expect(document.querySelector('[data-activity-why]')?.textContent).toContain('Choose an outcome');
  });
  it('says it in Arabic with the boxes’ own words', () => {
    log('ar', []);
    expect(document.querySelector('[data-activity-why]')?.textContent).toContain('اختر النوع');
  });
});
