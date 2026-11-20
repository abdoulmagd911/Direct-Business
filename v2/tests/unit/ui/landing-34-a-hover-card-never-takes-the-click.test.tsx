// @vitest-environment jsdom
/**
 * Landing 34, item 9: clicking a partner's name drew a small "Loading" card over the list while the record was on its
 * way — the click's own focus counted as hover, and the card opened before its read had answered. The hover card now
 * opens only for a mouse that rests (or keyboard focus), only once its content is read, and a press on the name closes
 * it and calls off one about to open. A finger never opens it: a tap goes straight to the record.
 * Item 9/25: a press on a control inside a table row (the name's link, the row's Actions) is that control's alone — it
 * used to reach the row too and open the record a second time. Every name is made up.
 * Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pressIsControls } from '../../../src/ui/DataTable';
import { HoverCard, hoverOpens } from '../../../src/ui/HoverCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;

let root: Root | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

type Answer = { name: string };
function draw() {
  let land: (a: Answer) => void = () => {};
  const load = vi.fn(() => new Promise<Answer>((done) => (land = done)));
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <HoverCard<Answer>
        load={load}
        render={(d, state) => (d ? <span data-made-up-card>{d.name}</span> : <span data-made-up-loading>{state}</span>)}
      >
        <a href="#made-up-org" data-made-up-link onClick={(e) => e.preventDefault()}>
          Made-up Org
        </a>
      </HoverCard>,
    );
  });
  const link = document.querySelector('[data-made-up-link]') as HTMLAnchorElement;
  /** A pointer comes to rest on the name (React reads enter from the over event). */
  const rest = (pointerType: string) =>
    act(() => {
      const e = new MouseEvent('pointerover', { bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      link.dispatchEvent(e);
    });
  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const answer = () => act(async () => land({ name: 'Made-up Org · read' }));
  const card = () => document.querySelector('[data-hover-card]');
  return { load, link, rest, wait, answer, card };
}

describe('a hover card never takes the click and never sits there empty', () => {
  it('a resting mouse asks for the content, and the card opens only once it has been read', async () => {
    const { load, rest, wait, answer, card } = draw();
    rest('mouse');
    wait(400);
    expect(load).toHaveBeenCalledTimes(1);
    expect(card(), 'no empty "Loading" card while the read is out').toBeNull();
    await answer();
    expect(card()?.textContent).toContain('Made-up Org · read');
    expect(document.querySelector('[data-made-up-loading]')).toBeNull();
  });

  it('a press on the name calls off a card that was about to open', async () => {
    const { load, link, rest, wait, card } = draw();
    rest('mouse');
    wait(100);
    act(() => link.click());
    wait(1000);
    expect(load, 'the click is the link’s alone: nothing is read for a card').not.toHaveBeenCalled();
    expect(card()).toBeNull();
  });

  it('a press on the name while the read is out leaves no card when it lands', async () => {
    const { link, rest, wait, answer, card } = draw();
    rest('mouse');
    wait(400);
    act(() => link.click());
    await answer();
    expect(card()).toBeNull();
  });

  it('a press on the name closes the card that is open', async () => {
    const { link, rest, wait, answer, card } = draw();
    rest('mouse');
    wait(400);
    await answer();
    expect(card()).not.toBeNull();
    act(() => link.click());
    expect(card()).toBeNull();
  });

  it('a finger never opens it: touch has no hover', () => {
    const { load, rest, wait, card } = draw();
    rest('touch');
    wait(1000);
    expect(load).not.toHaveBeenCalled();
    expect(card()).toBeNull();
    expect(hoverOpens('touch')).toBe(false);
    expect(hoverOpens('pen')).toBe(false);
    expect(hoverOpens('mouse')).toBe(true);
  });

  it('the focus a click leaves on the name does not open it', () => {
    const { load, link, wait, card } = draw();
    // a click as the browser sends it: the press, the focus it leaves on the link, then the click itself
    act(() => {
      link.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      link.focus();
      link.click();
    });
    wait(1000);
    expect(load).not.toHaveBeenCalled();
    expect(card()).toBeNull();
  });

  it('the name is the card’s anchor, not a popover’s trigger', () => {
    const { link } = draw();
    expect(link.hasAttribute('aria-haspopup')).toBe(false);
    expect(link.hasAttribute('aria-expanded')).toBe(false);
    expect(link.hasAttribute('data-hover-trigger')).toBe(true);
  });
});

describe('a press on a control inside a table row is that control’s alone', () => {
  const inRow = (html: string, pick: string) => {
    const row = document.createElement('div');
    row.innerHTML = html;
    document.body.append(row);
    return row.querySelector(pick);
  };
  it('the name’s link, and anything inside it', () => {
    expect(pressIsControls(inRow('<a href="/partners/made-up"><bdi>Made-up Org</bdi></a>', 'bdi'))).toBe(true);
  });
  it('the row’s Actions button and its menu’s items', () => {
    expect(pressIsControls(inRow('<button><svg></svg></button>', 'svg'))).toBe(true);
    expect(pressIsControls(inRow('<div role="menu"><div role="menuitem">Open</div></div>', '[role=menuitem]'))).toBe(
      true,
    );
  });
  it('plain text in a cell is the row’s', () => {
    expect(pressIsControls(inRow('<span>4 Nov 2026</span>', 'span'))).toBe(false);
    expect(pressIsControls(null)).toBe(false);
  });
});
