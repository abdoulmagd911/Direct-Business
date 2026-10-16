/**
 * V493: there is no zodiac badge. An icon badge is still drawn; a zodiac one stored before the rule draws nothing.
 * Sabotage: tests/sabotage/no-zodiac.mjs "avatar-draws-a-zodiac-glyph".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../../../src/ui/Avatar';

const person = (badge: { kind: string; value: string | null }) => ({
  displayName: 'Test',
  badge: badge as never,
});

describe('the avatar badge (V493)', () => {
  it('draws an icon badge', () => {
    expect(renderToStaticMarkup(<Avatar person={person({ kind: 'icon', value: 'star' })} />)).toContain('<svg');
  });
  it('draws nothing for a stored zodiac sign', () => {
    const html = renderToStaticMarkup(<Avatar person={person({ kind: 'zodiac', value: 'leo' })} />);
    expect(html).not.toContain('♌');
    expect(html).not.toContain('aria-hidden="true" class="absolute');
  });
});
