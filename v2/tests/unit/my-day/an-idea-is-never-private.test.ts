/**
 * An idea is never private-only: it belongs in the shared Ideas list, so a
 * private choice on an idea reads as shared with the team instead. A plain
 * note keeps its private choice, and an idea already shared with everyone
 * stays that way. Every value is made up.
 */
import { describe, expect, it } from 'vitest';
import { quickCaptureArgs } from '../../../src/modules/my-day/quick-capture';

const day = '2026-11-03';

describe('an idea is never private', () => {
  it('reads a private idea as shared with the team', () => {
    expect(quickCaptureArgs('idea', 'An idea', { visibility: 'private', day })?.values.visibility).toBe('team');
  });
  it('keeps an idea shared with everyone as everyone', () => {
    expect(quickCaptureArgs('idea', 'An idea', { visibility: 'workspace', day })?.values.visibility).toBe(
      'workspace',
    );
  });
  it('keeps a private note private', () => {
    expect(quickCaptureArgs('note', 'A note', { visibility: 'private', day })?.values.visibility).toBe('private');
  });
});
