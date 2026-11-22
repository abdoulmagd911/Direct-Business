// @vitest-environment jsdom
/**
 * Landing 37 (Finance F-C, A7 — CR-1594-23): the "Custom" period tab opens its From / To panel on the FIRST press.
 * The panel used to be drawn only once the server had answered the new address, so on a slow read the first press
 * showed nothing and a second press was made. Here the address never answers (the link goes nowhere): one press must
 * still light Custom and open the panel. The address stays in charge — when it moves on (Back, another tab's answer)
 * the tabs follow it and the panel closes. English and Arabic.
 * Sabotage: tests/sabotage/landing-37-finance.mjs "custom-period-waits-for-the-server".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { PeriodAsk } from '../../../src/modules/finance/period';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// the address never answers: a press on a tab changes nothing but what the switch itself draws
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; prefetch?: boolean }) => {
    // `prefetch` is the link's own word, not an anchor's
    const rest = { ...props };
    delete rest.prefetch;
    return <a {...rest}>{children}</a>;
  },
}));

const { PeriodSwitch } = await import('../../../src/modules/finance/screens/FinanceOverview');

const YTD: PeriodAsk = { key: 'ytd', from: '2026-01-01', to: '2026-11-22' };
const CUSTOM: PeriodAsk = { key: 'custom', from: '2026-01-01', to: '2026-11-22' };
const MTD: PeriodAsk = { key: 'mtd', from: '2026-11-01', to: '2026-11-22' };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = async (ask: PeriodAsk, locale: 'en' | 'ar' = 'en') => {
  if (!root) {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <PeriodSwitch ask={ask} />
      </NextIntlClientProvider>,
    );
  });
};
const tab = (key: string) => document.querySelector(`[data-finance-period-key="${key}"]`) as HTMLAnchorElement;
const panel = () => document.querySelector('[data-finance-custom-panel]');
const press = async (key: string) => {
  await act(async () => {
    // jsdom follows no link: the press is the click the tab hears
    tab(key).addEventListener('click', (e) => e.preventDefault(), { once: true });
    tab(key).click();
  });
};

describe('the Custom period opens on the first press', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`one press opens the From / To panel and lights Custom — before any answer (${locale})`, async () => {
      await draw(YTD, locale);
      expect(panel(), 'closed on Year to date').toBeNull();
      expect(tab('ytd').getAttribute('aria-current')).toBe('page');
      await press('custom');
      expect(panel(), 'the first press opens the From / To panel').not.toBeNull();
      expect(document.querySelector('[data-finance-from]'), 'with its From box').not.toBeNull();
      expect(document.querySelector('[data-finance-to]'), 'and its To box').not.toBeNull();
      expect(tab('custom').getAttribute('aria-current'), 'Custom is the lit tab').toBe('page');
      expect(tab('ytd').getAttribute('aria-current'), 'and Year to date no longer is').toBeNull();
    });
  }

  it('the panel stays open when the address answers Custom', async () => {
    await draw(YTD);
    await press('custom');
    await draw(CUSTOM);
    expect(panel()).not.toBeNull();
    expect(tab('custom').getAttribute('aria-current')).toBe('page');
  });

  it('the address stays in charge: when it moves to another period the panel closes', async () => {
    await draw(YTD);
    await press('custom');
    await draw(CUSTOM);
    await draw(MTD);
    expect(panel(), 'the address says Month to date: no panel').toBeNull();
    expect(tab('mtd').getAttribute('aria-current')).toBe('page');
    expect(tab('custom').getAttribute('aria-current')).toBeNull();
  });

  it('another tab is lit on its first press too, and closes the panel', async () => {
    await draw(CUSTOM);
    expect(panel(), 'open on a custom address').not.toBeNull();
    await press('qtd');
    expect(tab('qtd').getAttribute('aria-current')).toBe('page');
    expect(panel(), 'the panel belongs to Custom only').toBeNull();
  });
});
