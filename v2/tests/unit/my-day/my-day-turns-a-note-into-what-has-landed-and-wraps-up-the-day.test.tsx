/**
 * My day's rules without a browser (V433, V454): Turn into offers a logged meeting or call and a reminder now, and greys
 * a task and an action item until Tasks is built, an achievement until the KPIs page is; every block draws seven rows
 * and a "more" link; "/meeting" and "/checklist" pick the kind; Wrap up walks only the open captures of the day and
 * carries them to the next working day — Sunday after a Thursday; a private note's chip says "Only me"; a "turned
 * into" chip opens the organisation and a "from note" chip opens the note. The browser half is tests/e2e/my-day.spec.ts.
 * Sabotage: tests/sabotage/screens.mjs "turn-into-offers-a-task-too-soon", "block-draws-every-row",
 * "wrap-up-carries-to-a-friday", "private-note-reads-as-everyone".
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import {
  BLOCK_ROWS,
  blockOf,
  linkRoute,
  nextWorkingDay,
  noteRoute,
  openCaptures,
  parseCapture,
  turnLive,
  wrapUpChoices,
} from '../../../src/modules/my-day/logic';
import { FromNoteChip, LinkChip, VisibilityChip } from '../../../src/modules/my-day/screens/NoteBits';
import type { MyNote } from '../../../src/modules/my-day/types';

const html = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

const note = (over: Partial<MyNote> = {}): MyNote => ({
  id: 'n1',
  version: 1,
  kind: 'sticky',
  title: 'Made-up note',
  body: null,
  items: [],
  visibility: 'private',
  happened_on: '2026-10-01',
  logged_at: '2026-10-01T08:00:00Z',
  author_id: 'p1',
  mine: true,
  meeting_partner: null,
  meeting_on: null,
  finished_at: null,
  carried_to: null,
  done_at: null,
  links: [],
  ...over,
});

describe('Turn into', () => {
  it('offers a logged meeting or call and a reminder now', () => {
    expect(turnLive('activity', new Set())).toBe(true);
    expect(turnLive('reminder', new Set())).toBe(true);
  });
  it('a task waits for Tasks, an achievement for the KPIs page', () => {
    expect(turnLive('task', new Set()), 'a task waits for Tasks').toBe(false);
    expect(turnLive('action_item', new Set())).toBe(false);
    expect(turnLive('achievement', new Set(['tasks']))).toBe(false);
    expect(turnLive('task', new Set(['tasks']))).toBe(true);
    expect(turnLive('achievement', new Set(['kpis']))).toBe(true);
  });
});

describe('a block', () => {
  it('draws seven rows and a "more" link past them', () => {
    const rows = Array.from({ length: 10 }, (_, i) => i);
    const b = blockOf(rows, 10);
    expect(BLOCK_ROWS).toBe(7);
    expect(b.rows, 'seven rows').toHaveLength(7);
    expect(b.more).toBe(true);
    expect(blockOf(rows.slice(0, 7), 7).more, 'seven fit without "more"').toBe(false);
    expect(blockOf(rows.slice(0, 7), 12).more, 'the total counts, not what was read').toBe(true);
  });
});

describe('capture', () => {
  it('reads "/meeting" and "/checklist" as the kind, plain words as a note', () => {
    expect(parseCapture('/meeting Kick-off with the made-up client', 'sticky')).toEqual({
      kind: 'meeting',
      title: 'Kick-off with the made-up client',
    });
    expect(parseCapture('/checklist Offsite', 'sticky')).toEqual({ kind: 'checklist', title: 'Offsite' });
    expect(parseCapture('  Call back tomorrow ', 'sticky')).toEqual({ kind: 'sticky', title: 'Call back tomorrow' });
    expect(parseCapture('/unknown words', 'checklist'), 'an unknown word is text').toEqual({
      kind: 'checklist',
      title: '/unknown words',
    });
  });
});

describe('Wrap up today', () => {
  const day = '2026-10-01';
  it('walks only my open captures of the day', () => {
    const notes = [
      note({ id: 'open' }),
      note({ id: 'earlier', happened_on: '2026-09-29' }),
      note({ id: 'colleague', mine: false }),
      note({ id: 'done', done_at: '2026-10-01T10:00:00Z' }),
      note({ id: 'finished', kind: 'meeting', finished_at: '2026-10-01T10:00:00Z' }),
      note({ id: 'turned', links: [{ entity: 'reminder', id: 'r1' }] }),
      note({ id: 'later', carried_to: '2026-10-04' }),
      note({ id: 'arrived', carried_to: '2026-10-01', happened_on: '2026-09-30' }),
    ];
    expect(openCaptures(notes, day).map((n) => n.id)).toEqual(['open', 'earlier', 'arrived']);
  });
  it('carries to the next working day: Sunday after a Thursday', () => {
    expect(nextWorkingDay('2026-10-01'), 'Sunday after a Thursday').toBe('2026-10-04');
    expect(nextWorkingDay('2026-09-29')).toBe('2026-09-30');
    expect(nextWorkingDay('2026-10-03'), 'Saturday to Sunday').toBe('2026-10-04');
  });
  it('sends only the choices made, carry or done', () => {
    expect(wrapUpChoices({ a: 'carry', b: 'done', c: undefined })).toEqual([
      { note: 'a', choice: 'carry' },
      { note: 'b', choice: 'done' },
    ]);
  });
});

describe('the chips', () => {
  it('a private note says "Only me" — there is no admin override (V454)', () => {
    expect(html(<VisibilityChip visibility="private" />)).toContain('Only me');
    expect(html(<VisibilityChip visibility="team" />)).toContain('My team');
    expect(html(<VisibilityChip visibility="workspace" />)).toContain('Everyone');
  });
  it('"turned into" opens the organisation; a reminder names its time', () => {
    const call = {
      entity: 'activity' as const,
      id: 'a1',
      partner_id: 'org-1',
      partner_name_en: 'Test Org',
      type_en: 'Call',
    };
    expect(linkRoute(call)).toBe('/partners/org-1');
    const chip = html(<LinkChip link={call} />);
    expect(chip).toContain('href="/partners/org-1"');
    expect(chip).toContain('Call · Test Org');
    const reminder = html(<LinkChip link={{ entity: 'reminder', id: 'r1', remind_at: '2026-10-02T06:00:00Z' }} />);
    expect(reminder).toContain('Reminder · ');
    expect(reminder).not.toContain('href=');
  });
  it('"from note" opens the note', () => {
    expect(noteRoute('n1')).toBe('/my-day/notes/n1');
    expect(html(<FromNoteChip note={{ id: 'n1', title: 'Made-up note' }} />)).toContain('href="/my-day/notes/n1"');
  });
});
