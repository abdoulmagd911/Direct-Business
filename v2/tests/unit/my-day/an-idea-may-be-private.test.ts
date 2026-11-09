/**
 * An idea may be private (FIX-03 F241): the Idea preset offers Only me, and a
 * private choice on an idea stays private. A plain note keeps its private
 * choice, and an idea shared with everyone stays that way. Every value is
 * made up.
 */
import { describe, expect, it } from 'vitest';
import { quickCaptureArgs } from '../../../src/modules/my-day/quick-capture';

const day = '2026-11-03';

describe('an idea may be private', () => {
  it('keeps a private idea private', () => {
    expect(quickCaptureArgs('idea', 'An idea', { visibility: 'private', day })?.values.visibility).toBe('private');
  });
  it('keeps an idea shared with everyone as everyone', () => {
    expect(quickCaptureArgs('idea', 'An idea', { visibility: 'workspace', day })?.values.visibility).toBe('workspace');
  });
  it('keeps a private note private', () => {
    expect(quickCaptureArgs('note', 'A note', { visibility: 'private', day })?.values.visibility).toBe('private');
  });
});
