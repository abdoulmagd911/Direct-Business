/**
 * W47 (V635): from the click on a link that leaves the page to the arrival of the next, the app shows a bar and says
 * Loading to a screen reader; a click that stays, opens a new tab or leaves the app shows nothing. Made-up addresses.
 * Sabotage: tests/sabotage/list-pages-one-round.mjs "a-click-on-a-link-shows-no-bar".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PendingBar, leavesThisPage } from '../../../src/ui/shell/NavProgress';

const here = { origin: 'https://app.example.test', pathname: '/my-day', search: '' };
const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, extra: Partial<HTMLAnchorElement> = {}) => ({
  href: new URL(href, here.origin).href,
  target: '',
  download: '',
  ...extra,
});

describe('a click on a link shows Loading at once', () => {
  it('a tab switch, a Settings group or a query change leaves the page', () => {
    expect(leavesThisPage(link('/tasks'), plain, here)).toBe(true);
    expect(leavesThisPage(link('/my-day?tab=team'), plain, here)).toBe(true);
  });
  it('the page we are on, a new tab, a download, a modified click and another site do not', () => {
    expect(leavesThisPage(link('/my-day'), plain, here)).toBe(false);
    expect(leavesThisPage(link('/tasks', { target: '_blank' }), plain, here)).toBe(false);
    expect(leavesThisPage(link('/file', { download: 'a.pdf' }), plain, here)).toBe(false);
    expect(leavesThisPage(link('/tasks'), { ...plain, ctrlKey: true }, here)).toBe(false);
    expect(leavesThisPage(link('https://other.example.test/tasks'), plain, here)).toBe(false);
    expect(leavesThisPage(null, plain, here)).toBe(false);
  });
  it('the bar says Loading to a screen reader', () => {
    const html = renderToStaticMarkup(<PendingBar label="Loading" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading');
  });
});
