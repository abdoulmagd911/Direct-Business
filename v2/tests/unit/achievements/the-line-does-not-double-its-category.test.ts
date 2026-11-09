/**
 * FIX-36 F073: a line's category prefix is not doubled at render — "Cost saving: Cost saving: …" shows one copy.
 * The stored line is untouched; only the display strips the duplicate.
 */
import { describe, expect, it } from 'vitest';
import { displayLine } from '../../../src/modules/perf/types';

describe('displayLine', () => {
  it('strips one copy when the title already starts with the prefix', () => {
    expect(displayLine('Cost saving: Cost saving: Renegotiated the rate')).toBe('Cost saving: Renegotiated the rate');
  });
  it('leaves a line whose title only names the prefix alone', () => {
    expect(displayLine('Cost saving: Cost saving')).toBe('Cost saving: Cost saving');
  });
  it('leaves a line that does not double', () => {
    expect(displayLine('Cost saving: Renegotiated the rate')).toBe('Cost saving: Renegotiated the rate');
  });
  it('leaves a line with no prefix at all', () => {
    expect(displayLine('Renegotiated the rate')).toBe('Renegotiated the rate');
  });
});
