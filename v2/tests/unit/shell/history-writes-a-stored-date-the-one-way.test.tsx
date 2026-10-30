/**
 * W-daily 13: a history line that shows a date a column held (a due day, a moment) writes it `19 Oct 2026` /
 * `19 Oct 2026, 09:30`, never `2026-10-19`. Every value is made up.
 * Sabotage: tests/sabotage/one-date-everywhere.mjs "history-prints-a-stored-date-raw".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ActivityTimeline, type HistoryRow } from '../../../src/ui/record/ActivityTimeline';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const row: HistoryRow = {
  request_id: 'r1',
  at: '2026-10-01T08:00:00Z',
  actor_id: null,
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes: [
    {
      entity: 'task',
      id: 'a',
      action: 'update',
      fields: ['due_on', 'closed_at'],
      before: { due_on: '2026-10-19', closed_at: null },
      after: { due_on: '2026-10-21', closed_at: '2026-10-20T06:30:00+00:00' },
    },
  ],
};

describe('a history line writes a stored date the one way', () => {
  const out = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ActivityTimeline rows={[row]} people={{}} onChanged={() => {}} />
    </NextIntlClientProvider>,
  );
  it('shows the day as 19 Oct 2026 and the moment as 20 Oct 2026, 09:30', () => {
    expect(out).toContain('19 Oct 2026');
    expect(out).toContain('21 Oct 2026');
    expect(out).toContain('20 Oct 2026, 09:30');
  });
  it('never shows 2026-10-19 or an ISO moment as words on the screen', () => {
    const words = out.replace(/<[^>]*>/g, ' ');
    expect(words).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
