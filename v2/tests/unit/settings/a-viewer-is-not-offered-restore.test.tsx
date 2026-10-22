/**
 * QA-576: Recently deleted draws Restore only on a row the person may restore (can_restore not false).
 * Sabotage: tests/sabotage/screens.mjs "restore-offered-to-everyone".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { RecentlyDeleted, type DeletedRow } from '../../../src/modules/settings/screens/RecentlyDeleted';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const row = (id: string, can_restore?: boolean, restore_blocked?: string): DeletedRow => ({
  entity: 'contact',
  id,
  label: `Made up ${id}`,
  deleted_at: '2026-10-16T10:00:00Z',
  deleted_by: null,
  reason: null,
  can_restore,
  restore_blocked,
});

describe('Recently deleted offers Restore only where it works', () => {
  it('leaves the button off a row the person may not restore', () => {
    const out = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <RecentlyDeleted rows={[row('mine', true), row('theirs', false)]} people={{}} />
      </NextIntlClientProvider>,
    );
    expect(out).toContain('Made up theirs');
    expect(out.match(/data-deleted-restore/g)?.length, 'one button, on the row that may be restored').toBe(1);
  });

  it('says why in one line where it is refused, and draws no button (QA-585)', () => {
    const out = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <RecentlyDeleted
          rows={[
            row('owned', false, 'restore.blocked_by_duplicate'),
            row('cap', false, 'access.needs_capability'),
            row('no', false, 'restore.not_allowed'),
            row('other', false),
          ]}
          people={{}}
        />
      </NextIntlClientProvider>,
    );
    expect(out).not.toContain('data-deleted-restore');
    expect(out).toContain('Already has an owner');
    expect(out).toContain('Only someone who manages this can restore it');
    expect(out).toContain('You can&#x27;t restore this');
    expect(out).toContain('Can&#x27;t be restored');
  });
});
