/**
 * QA-578: the bell's unread number was passed to the icon button as its content and never drawn (the label said "2 unread",
 * no number showed). An icon button draws its icon and then whatever is put inside it.
 * Sabotage: tests/sabotage/screens.mjs "icon-button-drops-its-content".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../../../src/ui/IconButton';

describe('an icon button', () => {
  it('draws a badge put inside it, after the icon', () => {
    const out = renderToStaticMarkup(
      <IconButton label="2 unread" icon={<svg data-icon />}>
        <span data-badge>2</span>
      </IconButton>,
    );
    expect(out).toMatch(/<span data-badge="[^"]*">2<\/span>/);
    expect(out.indexOf('data-icon')).toBeLessThan(out.indexOf('data-badge'));
  });
});
