/**
 * Landing 34 (test-round fixes), the partner record's logic:
 *  - item 17: after Archive / Unarchive the record shows what was just said, until its re-read agrees;
 *  - item 32: after an edit the record shows the saved values (a note) at once, until its re-read has that version;
 *  - items 2/3: a failed read says why — stopped for time, no answer, refused — with a reference that carries no free
 *    text;
 *  - item 21: a press on Watch before its read has answered asks to watch;
 *  - item 9: only a mouse resting opens a hover card — a finger's touch is a press.
 * Made-up values only. Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { describe, expect, it } from 'vitest';
import { DbError, toDbError } from '../../../src/core/db/errors';
import { readFailure } from '../../../src/modules/partners/read-failure';
import {
  archiveLanded,
  archivedShown,
  savedEditLanded,
  withSavedEdit,
} from '../../../src/modules/partners/screens/record/saved-overlay';

describe('after Archive or Unarchive the record shows what was said', () => {
  it('Unarchive shows at once, though the card read still says archived', () => {
    expect(archivedShown('2026-11-19T08:00:00Z', false)).toBe(false);
  });
  it('Archive shows at once, though the card read still says not archived', () => {
    expect(archivedShown(null, true)).toBe(true);
  });
  it('with nothing said, the card read decides', () => {
    expect(archivedShown('2026-11-19T08:00:00Z', null)).toBe(true);
    expect(archivedShown(null, null)).toBe(false);
  });
  it('the saying goes once the re-read agrees, and stays while it does not', () => {
    expect(archiveLanded(null, false)).toBe(true);
    expect(archiveLanded('2026-11-19T08:00:00Z', false)).toBe(false);
    expect(archiveLanded(null, null)).toBe(false);
  });
});

describe('after an edit the record shows what was saved', () => {
  const card = { id: 'made-up-org', version: 4, notes: null as string | null, city: 'Made-up City' };
  const saved = { version: 5, changes: { notes: 'A made-up note' } };
  it('the saved note shows before the re-read lands', () => {
    expect(withSavedEdit(card, saved)).toEqual({ ...card, notes: 'A made-up note', version: 5 });
  });
  it('fields that were not edited stay as read', () => {
    expect(withSavedEdit(card, saved).city).toBe('Made-up City');
  });
  it('the re-read replaces the overlay: a card of that version or newer is shown as read', () => {
    const reread = { ...card, version: 5, notes: 'A made-up note' };
    expect(withSavedEdit(reread, saved)).toBe(reread);
    const newer = { ...card, version: 6, notes: 'Changed again by someone else' };
    expect(withSavedEdit(newer, saved).notes).toBe('Changed again by someone else');
    expect(savedEditLanded(reread, saved)).toBe(true);
    expect(savedEditLanded(card, saved)).toBe(false);
  });
  it('with nothing saved the card is the card read', () => {
    expect(withSavedEdit(card, null)).toBe(card);
    expect(savedEditLanded(card, null)).toBe(false);
  });
});

describe('a failed read says why', () => {
  it('a read the database stopped for time is a timeout, with its code', () => {
    const e = toDbError({ code: '57014', message: 'canceling statement due to statement timeout' });
    expect(readFailure(e)).toEqual({ kind: 'timeout', ref: 'Unavailable · 57014' });
  });
  it('a browser read that gave up waiting is a timeout too', () => {
    const e = new DbError('Unavailable', 'common.unavailable', 'partner_page timed out after 30s');
    expect(readFailure(e).kind).toBe('timeout');
  });
  it('a read that got no answer is the server not answering', () => {
    expect(readFailure(toDbError({ message: 'Internal server error.' }))).toEqual({
      kind: 'unavailable',
      ref: 'Unavailable',
    });
    expect(readFailure(new Error('made-up failure'))).toEqual({ kind: 'unavailable', ref: 'Unknown' });
  });
  it('a refusal is a refusal, never a failed read', () => {
    const e = toDbError({ code: '42501', message: 'access.needs_level' });
    expect(readFailure(e)).toEqual({ kind: 'refused', ref: 'PermissionDenied · access.needs_level' });
  });
  it('the reference never carries the error’s free text', () => {
    const e = toDbError({ code: '57014', message: 'canceling statement — Made-up Org 990001' });
    expect(readFailure(e).ref).not.toContain('Made-up');
  });
});
