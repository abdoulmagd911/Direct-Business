/**
 * Landing 34, item 22: a note's title lost its end in the middle of a word. Two causes: the note page's heading was cut
 * to one line by the browser (wherever the line ended), and a captured line whose last space sat in its first half was
 * cut at the 80-character cap itself. A title is now cut between words only (`cutAtWord`), and what is cut off is kept.
 * Every value is made up. Sabotage: tests/sabotage/landing-34-myday.mjs.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cutAtWord } from '../../../src/modules/my-day/logic';
import { quickCaptureArgs, splitTitle, TITLE_CAP } from '../../../src/modules/my-day/quick-capture';

describe('a title cut to a length', () => {
  it('ends at the last whole word that fits, and keeps the words after it', () => {
    expect(cutAtWord('Book the made-up hotels for the December stay', 30)).toEqual({
      head: 'Book the made-up hotels for',
      rest: 'the December stay',
    });
  });
  it('keeps a word that ends exactly at the cap', () => {
    expect(cutAtWord('made-up hotels in December', 14)).toEqual({ head: 'made-up hotels', rest: 'in December' });
  });
  it('leaves a text that fits as it is', () => {
    expect(cutAtWord('Short made-up title', 80)).toEqual({ head: 'Short made-up title', rest: '' });
  });
  it('cuts Arabic words between words too', () => {
    const { head, rest } = cutAtWord('حجز فنادق تجريبية لمؤتمر ديسمبر القادم', 20);
    expect(head).toBe('حجز فنادق تجريبية');
    expect(rest).toBe('لمؤتمر ديسمبر القادم');
  });
  it('cuts inside only one unbroken word longer than the cap, there being no space to cut at', () => {
    const { head, rest } = cutAtWord('x'.repeat(100), 80);
    expect(head).toHaveLength(80);
    expect(head + rest).toBe('x'.repeat(100));
  });
});

describe('a captured title', () => {
  it('is never cut inside a word, even when its last space sits in its first half', () => {
    const line = `Send the made-up list to ${'verylongmadeupword'.repeat(5)} today`;
    const { title, rest } = splitTitle(line);
    expect(title).toBe('Send the made-up list to…');
    expect(`${title.slice(0, -1)} ${rest}`, 'nothing typed is lost').toBe(line);
  });
  it('always ends on a whole word of the line, whatever the line', () => {
    const words = 'made-up hotels in Riyadh for the December stay of the team and the list of rooms to book'.split(' ');
    for (let from = 0; from < 6; from++) {
      const line = [...words.slice(from), ...words].join(' ');
      const { title } = splitTitle(line);
      expect(title.length).toBeLessThanOrEqual(TITLE_CAP + 1);
      expect(words, `"${title}"`).toContain(title.slice(0, -1).split(' ').pop());
    }
  });
  it("cuts a checklist's long first line between words as well", () => {
    const line = 'made-up row '.repeat(30).trim();
    const title = quickCaptureArgs('checklist', `${line}\nfirst item`, { visibility: 'private', day: '2026-11-18' })
      ?.values.title as string;
    expect(title.length).toBeLessThanOrEqual(200);
    expect(line.startsWith(`${title} `), `it ends on a whole word: …${title.slice(-20)}`).toBe(true);
  });
});

describe("a note's title on a phone", () => {
  const page = readFileSync('src/modules/my-day/screens/NotePage.tsx', 'utf8');
  const row = readFileSync('src/modules/my-day/screens/NoteBits.tsx', 'utf8');
  it('wraps on the note page instead of being cut to one line', () => {
    const heading = page.slice(page.indexOf('title={'), page.indexOf('meta={'));
    expect(heading).toContain('data-note-title');
    expect(heading).toMatch(/<bdi className="min-w-0 break-words" data-note-title>/);
    expect(heading).not.toMatch(/className="[^"]*\b(?:truncate|line-clamp-\d)\b/);
  });
  it('wraps on My notes too', () => {
    const from = row.indexOf('export function NoteRow');
    const link = row.slice(row.indexOf('href={noteRoute(note.id)}', from), row.indexOf('data-note-open'));
    expect(link).toContain('break-words');
    expect(link).not.toMatch(/\b(?:truncate|line-clamp-\d)\b/);
  });
});
