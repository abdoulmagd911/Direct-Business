/**
 * The client priority scale is High / Medium / Low (FIX-30 F113, D16): the work-priority words (an executive
 * directive is a task word) never appear in a client picker — but a priority already stored on the record stays
 * offered in its own picker, so an existing value never vanishes. Every value is made up.
 */
import { describe, expect, it } from 'vitest';
import { clientPriorities, type ListEntry } from '../../../src/modules/partners/types';

const entry = (key: string): ListEntry => ({
  id: `id-${key}`,
  key,
  name_en: key,
  name_ar: null,
  sort: null,
  active: true,
});

const all = [entry('high'), entry('medium'), entry('low'), entry('executive_directive')];

describe('client priorities are High / Medium / Low', () => {
  it('shows only the client scale', () => {
    expect(clientPriorities(all).map((x) => x.key)).toEqual(['high', 'medium', 'low']);
  });

  it('keeps a stored value outside the scale in its own picker', () => {
    expect(clientPriorities(all, 'id-executive_directive').map((x) => x.key)).toEqual([
      'high',
      'medium',
      'low',
      'executive_directive',
    ]);
  });

  it('does not duplicate a stored value already on the scale', () => {
    expect(clientPriorities(all, 'id-high')).toHaveLength(3);
  });
});
