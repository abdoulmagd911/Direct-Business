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
  wrapUpSteps,
} from '../../../src/modules/my-day/logic';
import { FromNoteChip, LinkChip, VisibilityChip } from '../../../src/modules/my-day/screens/NoteBits';
import type { MyNote, TurnedInto } from '../../../src/modules/my-day/types';

const html = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

const turned = (over: Partial<TurnedInto> = {}): TurnedInto => ({
  entity: 'note',
  id: 'a1',
  made_at: '2026-10-01T09:00:00Z',
  made_by: 'p1',
  partner_id: null,
  type: null,
  happened_on: null,
  remind_at: null,
  sent_at: null,
  ...over,
});

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
  meeting_partner_id: null,
  meeting_on: null,
  finished_at: null,
  carried_to: null,
  done_at: null,
  mentions: [],
  turned_into: [],
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
  it("walks only my open captures: not a colleague's, not a finished meeting, not one already turned into something", () => {
    const notes = [
      note({ id: 'open' }),
      note({ id: 'earlier', happened_on: '2026-09-29' }),
      note({ id: 'colleague', mine: false }),
      note({ id: 'finished', kind: 'meeting', finished_at: '2026-10-01T10:00:00Z' }),
      note({ id: 'turned', turned_into: [turned({ entity: 'reminder', id: 'r1' })] }),
    ];
    expect(openCaptures(notes).map((n) => n.id)).toEqual(['open', 'earlier']);
  });
  it('shows the next working day: Sunday after a Thursday', () => {
    expect(nextWorkingDay('2026-10-01'), 'Sunday after a Thursday').toBe('2026-10-04');
    expect(nextWorkingDay('2026-09-29')).toBe('2026-09-30');
    expect(nextWorkingDay('2026-10-03'), 'Saturday to Sunday').toBe('2026-10-04');
  });
  it('sends only the choices made, carry or done, as api.note_wrap_up takes them', () => {
    expect(wrapUpSteps({ a: 'carry', b: 'done', c: undefined })).toEqual([
      { id: 'a', action: 'carry' },
      { id: 'b', action: 'done' },
    ]);
  });
});

describe('the chips', () => {
  const org = { id: 'org-1', number: 'DK-P-1', trade_name_en: 'Test Org', trade_name_ar: null };
  const names = {
    partners: { 'org-1': org },
    types: [{ id: 't1', key: 'call', name_en: 'Call', name_ar: 'مكالمة', sort: 1, active: true }],
  };
  it('a private note says "Only me" — there is no admin override (V454)', () => {
    expect(html(<VisibilityChip visibility="private" />)).toContain('Only me');
    expect(html(<VisibilityChip visibility="team" />)).toContain('My team');
    expect(html(<VisibilityChip visibility="workspace" />)).toContain('Everyone');
  });
  it('"turned into" opens the organisation; a reminder names its time', () => {
    const call = turned({ partner_id: 'org-1', type: 'call' });
    expect(linkRoute(call)).toBe('/partners/org-1');
    const chip = html(<LinkChip link={call} names={names} />);
    expect(chip).toContain('href="/partners/org-1"');
    expect(chip).toContain('Call · Test Org');
    const reminder = html(
      <LinkChip link={turned({ entity: 'reminder', remind_at: '2026-10-02T06:00:00Z' })} names={names} />,
    );
    expect(reminder).toContain('Reminder · ');
    expect(reminder).not.toContain('href=');
  });
  it('"from note" opens the note', () => {
    expect(noteRoute('n1')).toBe('/my-day/notes/n1');
    expect(html(<FromNoteChip note={{ note_id: 'n1', title: 'Made-up note' }} />)).toContain('href="/my-day/notes/n1"');
  });
});
