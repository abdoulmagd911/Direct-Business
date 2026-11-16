/**
 * Landing 31 — the two undrawn pieces built in the V21 look. New invoice: the three actions are on the page once, in
 * the bar that stays at the foot of a narrow screen, with Save the one filled button; the kinds are a pill row. The
 * Import card: its three steps, lit as far as the import has come — the first, before a file is chosen — and it never
 * claims a permission it does not check ("Admins only": the card follows Full on Finance, as before).
 * Sabotage: tests/sabotage/landing-31-finance.mjs "new-invoice-has-two-save-buttons",
 * "new-invoice-bar-does-not-stay-in-reach", "import-steps-all-lit".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { FinanceImportSection } from '../../../src/modules/finance/screens/FinanceImportSection';
import { NewInvoice } from '../../../src/modules/finance/screens/NewInvoice';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const lists = {
  status: [{ key: 'fully_paid', name_en: 'Fully Paid', name_ar: null }],
  expenseStatus: [{ key: 'approved', name_en: 'Approved', name_ar: null }],
  product: [],
  service: [],
};

const page = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('New invoice', () => {
  const out = page(<NewInvoice today="2026-11-16" lists={lists as never} />);

  it('has its three actions once, Save the one filled button', () => {
    expect(out.match(/data-save="true"/g)?.length, 'one Save').toBe(1);
    expect(out.match(/data-save-new="true"/g)?.length, 'one Save + new').toBe(1);
    const bar = out.slice(out.indexOf('data-new-invoice-actions'));
    expect(bar, 'Save is in the bar').toContain('data-save="true"');
    expect(bar.match(/<button/g)?.length, 'Cancel, Save + new, Save').toBe(3);
    expect(bar.match(/(?<![\w:-])bg-primary(?![\w-])/g)?.length, 'one filled button in the bar').toBe(1);
    expect(/<button[^>]*data-save="true"[^>]*>/.exec(out)?.[0], 'and it is Save').toMatch(
      /(?<![\w:-])bg-primary(?![\w-])/,
    );
  });

  it('keeps the actions in reach on a narrow screen: the bar sticks to the foot', () => {
    const bar = /<div class="([^"]*)" data-new-invoice-actions/.exec(out)?.[1] ?? '';
    expect(bar, 'sticks where the page is narrow').toContain('@max-[639px]:sticky');
    expect(bar).toContain('@max-[639px]:bottom-3');
    expect(bar, 'beside the title where there is room').toContain('@min-[640px]:row-start-1');
  });

  it('offers its kinds as a pill row, and a list that cannot be read says so with Try again', () => {
    expect(out.match(/data-kind="/g)?.length).toBe(4);
    expect(out).toMatch(/role="radio"[^>]*class="[^"]*rounded-pill/);
    const failed = page(<NewInvoice today="2026-11-16" lists={null} />);
    expect(failed).toContain('data-state="failed"');
    expect(failed).toContain('Try again');
  });
});

describe('the Import card', () => {
  const step = (out: string, key: string) => new RegExp(`<li[^>]*data-import-step="${key}"[^>]*>`).exec(out)?.[0] ?? '';

  it('shows its three steps, the first one lit before a file is chosen', () => {
    const out = page(<FinanceImportSection />);
    for (const word of ['Choose file', 'Review', 'Done']) expect(out, word).toContain(word);
    expect(step(out, 'choose'), 'the first step is lit').toContain('data-on=""');
    expect(step(out, 'choose')).toContain('aria-current="step"');
    expect(step(out, 'review'), 'Review is not reached yet').not.toContain('data-on');
    expect(step(out, 'done'), 'Done is not reached yet').not.toContain('data-on');
    const arabic = page(<FinanceImportSection />, 'ar');
    for (const word of ['اختيار الملف', 'المراجعة', 'تم']) expect(arabic, word).toContain(word);
  });

  it('claims no permission it does not check, and nothing in it scrolls sideways', () => {
    const out = page(<FinanceImportSection />);
    expect(out).not.toContain('Admins only');
    expect(out).not.toContain('overflow-x-auto');
    expect(out, 'nothing is saved until Confirm is still said').toContain('Nothing is saved until you confirm');
  });
});
