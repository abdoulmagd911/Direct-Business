import { afterEach, describe, expect, it } from 'vitest';
import { longDate, periodLabel } from '@/core/print/report/format';
import type { ReportDoc } from '@/core/print/report/model';
import { renderReportPdf } from './pdf-tools';
import { renderReportPptx } from './pptx-tools';

/**
 * PRF-139 (the scenario catalogue, oversight 29 Sep 16:03): a report prints the same whatever the computer's time
 * zone — the tests run in UTC, a person's browser in Riyadh, a traveller's anywhere. Its period and dates are
 * Riyadh calendar days (D20), so a month, a quarter and a year that start at Riyadh's midnight keep their names in
 * every zone and in both languages, and the PDF and the PPTX are the same bytes. The moved clock is
 * `two-renderings-of-the-same-report-are-identical`.
 * Sabotages: `period-read-in-the-computers-zone`, `pdf-dated-in-the-computers-zone` (tests/sabotage/export.mjs).
 */
const ZONES = ['UTC', 'Asia/Riyadh', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;
const original = process.env.TZ;

afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

async function inEveryZone<T>(run: () => T | Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (const tz of ZONES) {
    process.env.TZ = tz;
    out.push(await run());
  }
  return out;
}

type Period = Pick<ReportDoc, 'kind' | 'period'>;
const period = (kind: ReportDoc['kind'], start: string, end: string): Period => ({ kind, period: { start, end } });

describe("a report's period and dates", () => {
  it.each([
    [period('monthly', '2026-12-01', '2026-12-31'), 'December 2026', 'ديسمبر 2026'],
    [period('monthly', '2027-01-01', '2027-01-31'), 'January 2027', 'يناير 2027'],
    [period('monthly', '2028-02-01', '2028-02-29'), 'February 2028', 'فبراير 2028'],
    [period('quarterly', '2026-10-01', '2026-12-31'), 'Q4 2026', 'الربع الرابع 2026'],
    [period('quarterly', '2027-01-01', '2027-03-31'), 'Q1 2027', 'الربع الأول 2027'],
  ])('%o is named the same in every zone', async (p, en, ar) => {
    for (const [e, a] of await inEveryZone(() => [periodLabel(p, 'en'), periodLabel(p, 'ar')])) {
      expect(e, 'the period in English, in every zone').toBe(en);
      expect(a, 'the period in Arabic, in every zone').toBe(ar);
    }
  });

  it.each([
    ['2026-12-31', '31 December 2026', '31 ديسمبر 2026'],
    ['2027-01-01', '1 January 2027', '1 يناير 2027'],
    ['2028-02-29', '29 February 2028', '29 فبراير 2028'],
  ])('%s prints as the same day in every zone', async (iso, en, ar) => {
    for (const [e, a] of await inEveryZone(() => [longDate(iso, 'en'), longDate(iso, 'ar')])) {
      expect(e, 'the date in English, in every zone').toBe(en);
      expect(a, 'the date in Arabic, in every zone').toBe(ar);
    }
  });
});

describe('the files', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`are the same PDF bytes in every zone (${lang})`, { timeout: 120_000 }, async () => {
      const files = await inEveryZone(() => renderReportPdf(lang));
      for (const f of files) expect(f.equals(files[0]!), 'the same PDF in every zone').toBe(true);
    });

    it(`are the same PPTX bytes in every zone (${lang})`, { timeout: 120_000 }, async () => {
      const files = await inEveryZone(async () => Buffer.from(await renderReportPptx(lang)));
      for (const f of files) expect(f.equals(files[0]!), 'the same PPTX in every zone').toBe(true);
    });
  }
});
