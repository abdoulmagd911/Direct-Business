import { describe, expect, it } from 'vitest';
import { FORBIDDEN } from '../../../scripts/checks/forbidden-words.mjs';
import { BANNED, bannedIn } from '../../../src/core/words/banned';

// V404: what the check refuses in the code, the app refuses in a typed value — one list, kept equal here.
describe('the app refuses a typed value with a banned word', () => {
  it('names the word', () => {
    expect(bannedIn('Government (B2G) clients')).toBe('B2G');
    expect(bannedIn('Our company')).toBe('Company');
    expect(bannedIn('Gross margin')).toBe('Margin');
    expect(bannedIn('Government')).toBeNull();
    expect(bannedIn('Companion')).toBeNull();
  });
  it('carries every word of the check', () => {
    const words = new Set(BANNED.map(([, w]) => w));
    for (const [, w] of FORBIDDEN) expect(words.has(w), w).toBe(true);
  });
});
