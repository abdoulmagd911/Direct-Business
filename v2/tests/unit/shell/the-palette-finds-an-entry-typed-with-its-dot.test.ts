/**
 * Finding 6 (26 Oct): the palette shows "Create · Capture" but did not find it when typed with the dot. It now matches
 * the words as shown, whatever the case, dots, dashes or spaces.
 * Sabotage: tests/sabotage/row-3.mjs (the-palette-reads-the-dot-as-a-letter).
 */
import { describe, expect, it } from 'vitest';
import { paletteMatches } from '../../../src/ui/shell/palette-match';

describe('the palette finds an entry the way it reads', () => {
  it('finds "Create · Capture" typed with its dot, without it, or in part', () => {
    for (const typed of ['Create · Capture', 'create · capture', 'Create Capture', 'create  capture', 'capture', ''])
      expect(paletteMatches('Create · Capture', typed), typed).toBe(true);
  });
  it('and nothing that does not read that way', () => {
    expect(paletteMatches('Create · Capture', 'create task')).toBe(false);
    expect(paletteMatches('Create · Task', 'create · capture')).toBe(false);
  });
});
