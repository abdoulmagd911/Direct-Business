/**
 * V636: no profile colour. The initials sit on one soft tint with no ring in a colour of their own.
 * Sabotage: tests/sabotage/three-themes.mjs "the-avatar-draws-a-colour-ring-again".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../../../src/ui/Avatar';

describe('the avatar (V636)', () => {
  it('the initials have no colour ring and no chart colour', () => {
    const html = renderToStaticMarkup(<Avatar person={{ displayName: 'Test Person' }} />);
    expect(html).toContain('TP');
    expect(html, 'the initials have no colour ring').not.toContain('inset_0_0_0');
    expect(html).not.toMatch(/var\(--c[1-6]\)/);
  });
});
