/**
 * QA-225: the audit log can record a delete; its row reads "<what> deleted", never a raw key, and an action the log has no
 * words for reads "Change". Sabotage: tests/sabotage/screens.mjs "activity-delete-has-no-words".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ActivityTimeline, type HistoryRow } from '../../../src/ui/record/ActivityTimeline';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const row = (action: string): HistoryRow => ({
  request_id: 'r1',
  at: '2026-10-01T10:00:00Z',
  actor_id: 'p1',
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes: [{ entity: 'core.person', id: 'x', action, fields: [], before: null, after: null }] as HistoryRow['changes'],
});

const html = (action: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <ActivityTimeline rows={[row(action)]} people={{}} />
    </NextIntlClientProvider>,
  );

describe('the activity log words for what happened', () => {
  it('reads a deleted record as "deleted", not as a key', () => {
    const out = html('delete');
    expect(out, 'a deleted record has words').toContain('deleted');
    expect(out).not.toContain('activity.actions');
  });
  it('reads an action it has no words for as "Change"', () => {
    const out = html('zap');
    expect(out).toContain('Change');
    expect(out).not.toContain('activity.actions');
  });
});
