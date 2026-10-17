/**
 * A row of My notes names what it was captured as (the Architect's ruling V641): Note, Idea, Checklist, Reminder or
 * Meeting, in English and Arabic; a read that predates the field falls back to the note's own kind. Names are made up.
 * Sabotage: tests/sabotage/capture-polish.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { NoteRow } from '../../../src/modules/my-day/screens/NoteBits';
import type { MyNote } from '../../../src/modules/my-day/types';

const note = (over: Partial<MyNote>): MyNote => ({
  id: 'n1',
  version: 1,
  kind: 'sticky',
  title: 'Made-up newsletter idea',
  body: null,
  items: [],
  visibility: 'private',
  happened_on: '2026-10-17',
  logged_at: '2026-10-17T08:00:00+03:00',
  author_id: 'p1',
  mine: true,
  meeting_partner: null,
  meeting_on: null,
  finished_at: null,
  carried_to: null,
  done_at: null,
  mentions: [],
  links: [],
  ...over,
});
const draw = (n: MyNote, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      <ul>
        <NoteRow note={n} />
      </ul>
    </NextIntlClientProvider>,
  );

describe('a row of My notes', () => {
  it('names the kind it was captured as, in English and in Arabic', () => {
    const words = {
      note: ['Note', 'ملاحظة'],
      idea: ['Idea', 'فكرة'],
      checklist: ['Checklist', 'قائمة مهام'],
      reminder: ['Reminder', 'تذكير'],
      meeting: ['Meeting', 'اجتماع'],
    } as const;
    for (const [kind, [english, arabic]] of Object.entries(words)) {
      const n = note({ capture_kind: kind as MyNote['capture_kind'] });
      const enHtml = draw(n);
      expect(enHtml, `${kind}: the chip`).toContain(`data-note-captured-as="${kind}"`);
      expect(enHtml, `${kind}: its English word`).toContain(`>${english}</span>`);
      expect(draw(n, 'ar'), `${kind}: its Arabic word`).toContain(`>${arabic}</span>`);
    }
  });
  it('falls back to the own kind of a read that predates the field', () => {
    expect(draw(note({ kind: 'checklist' }))).toContain('data-note-captured-as="checklist"');
    expect(draw(note({ kind: 'meeting' }))).toContain('data-note-captured-as="meeting"');
    expect(draw(note({ kind: 'sticky' }))).toContain('data-note-captured-as="note"');
  });
});
