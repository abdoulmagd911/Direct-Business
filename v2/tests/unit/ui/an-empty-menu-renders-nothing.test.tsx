// @vitest-environment jsdom
/**
 * An empty menu renders nothing (FIX-42 F110): when every item is gated away — a Viewer on a record they only
 * read — the ⋯ menu must not open as a blank white box. The guard lives in MenuContent itself, so any menu whose
 * items are all conditional is covered. Every value is made up.
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../../src/ui/Menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = (children: ReactNode) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      <Menu open>
        <MenuTrigger asChild>
          <button type="button">⋯</button>
        </MenuTrigger>
        <MenuContent>{children}</MenuContent>
      </Menu>,
    );
  });
};

describe('an empty menu', () => {
  it('renders no menu when every item is gated away', () => {
    draw(null);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('renders the menu when an item is there', () => {
    draw(<MenuItem onSelect={() => {}}>Made-up action</MenuItem>);
    expect(document.querySelector('[role="menu"]')?.textContent).toContain('Made-up action');
  });
});
