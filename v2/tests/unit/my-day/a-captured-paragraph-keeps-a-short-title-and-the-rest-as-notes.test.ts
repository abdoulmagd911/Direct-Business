/**
 * Finding 1 (26 Oct): a note captured as one paragraph used to put every word in its title (cut at 200, the rest lost)
 * and leave Notes empty. The title is now the first sentence when it fits the cap (V654 (9): about three lines on a
 * phone), else the words up to the cap and "…"; the rest goes to Notes, and nothing typed is lost.
 * Every value is made up.
 * Sabotage: tests/sabotage/row-3.mjs (a-captured-paragraph-is-all-title).
 */
import { describe, expect, it } from 'vitest';
import { quickCaptureArgs, splitTitle, TITLE_CAP } from '../../../src/modules/my-day/quick-capture';

const opts = { visibility: 'private', day: '2026-10-26' };
const paragraph =
  'Call the made-up client about the renewal. They asked for the new prices by Thursday and want the team list too.';

describe('a captured paragraph', () => {
  it('keeps its first sentence as the title and the rest as Notes', () => {
    expect(quickCaptureArgs('note', paragraph, opts)?.values).toEqual({
      visibility: 'private',
      happened_on: '2026-10-26',
      title: 'Call the made-up client about the renewal.',
      body: 'They asked for the new prices by Thursday and want the team list too.',
    });
  });

  it('with no sentence end in reach, cuts the title between words and carries the rest to Notes', () => {
    const words = 'made up words '.repeat(12).trim();
    const { title, rest } = splitTitle(words);
    expect(title.length).toBeLessThanOrEqual(TITLE_CAP + 1);
    expect(title.endsWith('…')).toBe(true);
    expect(`${title.slice(0, -1)} ${rest}`, 'nothing typed is lost').toBe(words);
  });

  it('keeps a short line whole, and the lines after it as Notes', () => {
    expect(quickCaptureArgs('idea', 'Short idea\nwith a second line', opts)?.values).toMatchObject({
      title: 'Short idea',
      body: 'with a second line',
    });
    expect(quickCaptureArgs('note', 'Short', opts)?.values).not.toHaveProperty('body');
  });

  it('puts the words past the title ahead of the next lines', () => {
    expect(
      quickCaptureArgs('reminder', `${paragraph}\nBring the file`, { ...opts, remindAt: '2026-10-27T06:00:00Z' })
        ?.values,
    ).toMatchObject({
      title: 'Call the made-up client about the renewal.',
      body: 'They asked for the new prices by Thursday and want the team list too.\nBring the file',
    });
  });
});
