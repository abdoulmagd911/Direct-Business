// @vitest-environment jsdom
/**
 * Owner 13 Nov audit (B-partners): the Discount codes page wrote a hard "SAR" beside every figure, in Arabic too, and a
 * code with neither date showed "— — —". Its figures now carry the reader's currency word (common.sar), a code
 * names the organisation it belongs to, and a code with no dates shows no date line at all. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { CodeDetail, CodeRow } from '../../../src/modules/codes/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// jsdom has no scrollIntoView
Element.prototype.scrollIntoView = () => {};

const { CodesScreen } = await import('../../../src/modules/codes/screens/CodesScreen');

const row: CodeRow = {
  id: 'code-1',
  code: 'MADEUP10',
  valid_from: null,
  valid_to: null,
  state: 'active',
  total_discount: 120,
  total_collected: 900,
  units: 2,
  partner_id: 'p-1',
  partner_name: 'Made-up Travel',
  partner_name_ar: 'سفر تجريبي',
};
const detail: CodeDetail = {
  id: 'code-1',
  code: 'MADEUP10',
  valid_from: null,
  valid_to: null,
  state: 'active',
  partner_id: 'p-1',
  partner_name: 'Made-up Travel',
  partner_name_ar: 'سفر تجريبي',
  fee_percent: null,
  totals: { total_discount: 120, total_collected: 900, total_cost: null, total_profit: null, units: 2 },
  ledger: [],
  attributions: [],
};

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = async (locale: 'en' | 'ar', withDetail: CodeDetail | null) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <CodesScreen
          rows={[row]}
          detail={withDetail}
          companyRows={[]}
          partners={[]}
          full={false}
          selectedId={withDetail ? withDetail.id : null}
          listFailed={false}
          detailFailed={false}
          companiesFailed={false}
          files={[]}
          filesFailed={false}
        />
      </NextIntlClientProvider>,
    );
  });
};

describe('the codes page says its currency and dates in words', () => {
  it('writes the Arabic currency word in Arabic, never a hard SAR', async () => {
    await draw('ar', null);
    const text = document.body.textContent ?? '';
    expect(text).toContain(ar.common.sar);
    expect(text).not.toContain('SAR');
  });

  it('names the organisation a code belongs to, in the reader’s language', async () => {
    await draw('ar', null);
    expect(document.querySelector('[data-code-partner]')?.textContent).toBe('سفر تجريبي');
    act(() => root?.unmount());
    await draw('en', null);
    expect(document.querySelector('[data-code-partner]')?.textContent).toBe('Made-up Travel');
  });

  it('shows no date line for a code with neither date (it read "— — —")', async () => {
    await draw('en', detail);
    expect(document.querySelector('[data-code-validity]')).toBeNull();
    expect(document.body.textContent).not.toContain('— —');
  });

  it('says a one-sided validity in words', async () => {
    await draw('en', { ...detail, valid_from: '2026-11-01' });
    expect(document.querySelector('[data-code-validity]')?.textContent).toBe('From 1 Nov 2026');
  });
});
